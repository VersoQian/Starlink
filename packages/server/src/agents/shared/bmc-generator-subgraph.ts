/**
 * Shared ReAct subgraph factory for BMC-generating agents (market / product /
 * finance). These three agents share identical structure differing only in:
 *   - which state field receives the output (marketNodes/productNodes/financeNodes)
 *   - the domain allow-list
 *   - the AgentType used in node metadata signature
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import {
  SystemMessage,
  HumanMessage,
  type AIMessage,
  type BaseMessage
} from '@langchain/core/messages'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { KnowledgeEvidence } from '@starlink/shared'

import type { AgentProfile } from '../../capabilities/profile-schema.js'
import {
  extractAndParseJSON,
  normalizeDomainNodes,
  readModelText,
  type MacraNodeData,
  type BusinessModel,
  type AgentType,
  type CCBMCDomain
} from './parsing.js'

// ============== Config ==============

export type BmcOutputField = 'marketNodes' | 'productNodes' | 'financeNodes'

export interface BmcGeneratorConfig {
  outputField: BmcOutputField
  domains: readonly CCBMCDomain[]
  agentType: AgentType
  loggerName: string
}

// ============== State factory ==============

/**
 * Blackboard view passed from the top-level graph into a generator subgraph.
 *
 * `contextPrompt`, `crossContextPrompt` and `supervisorDirectivePrompt` are
 * pre-rendered strings — the top-level graph owns the truth (full
 * `WorkspaceContextSnapshot`, full sibling-agent outputs, full
 * `SupervisorDirective` shape) and renders the slice each agent needs into a
 * markdown block. We pass strings rather than typed objects to keep the
 * subgraph state schema decoupled from the top-level types.
 */
export function makeBmcGeneratorState() {
  return Annotation.Root({
    traceId: Annotation<string>(),
    workspaceId: Annotation<string>(),
    userId: Annotation<string>(),
    question: Annotation<string>(),
    roundNumber: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
    knowledgeEvidence: Annotation<KnowledgeEvidence[]>({
      reducer: (_a, b) => b,
      default: () => []
    }),
    contextPrompt: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
    crossContextPrompt: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
    supervisorDirectivePrompt: Annotation<string>({
      reducer: (_a, b) => b,
      default: () => ''
    }),
    /**
     * Pre-rendered user-skill block (server fetched). Empty when memory
     * read is disabled, the user has no extracted skills yet, or the
     * benchmark uses a fresh userId. Renders below `supervisorDirective`
     * so per-user calibration influences round-2+ revisions explicitly.
     */
    userSkillPrompt: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
    messages: Annotation<BaseMessage[]>({
      reducer: (a, b) => a.concat(b),
      default: () => []
    }),
    marketNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] }),
    productNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] }),
    financeNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] })
  })
}

export const BmcGeneratorState = makeBmcGeneratorState()
export type BmcGeneratorStateType = typeof BmcGeneratorState.State

// ============== Prompt helpers ==============

function renderKnowledgeContext(evidence: KnowledgeEvidence[]): string {
  if (!evidence.length) return ''
  const list = evidence
    .slice(0, 6)
    .map((e, i) => {
      const body =
        (e as { content?: string; title?: string }).content ??
        (e as { title?: string }).title ??
        ''
      return `${i + 1}. ${body}`
    })
    .join('\n')
  return `\n\n参考资料（来自知识库）：\n${list}\n`
}

function getRevisionSuffix(round: number): string {
  if (round <= 1) return ''
  return `\n\n**重要：这是第 ${round} 轮修正。请根据上面的修正指导调整你的分析。**`
}

/**
 * Assemble the full prompt visible to a single generator from the blackboard.
 *
 * Order matters — agents read top-down:
 *   1. role-specific system prompt (from agent.yaml)
 *   2. user question (the case)
 *   3. workspace context (canvas summary + memories + recent messages)
 *   4. cross-agent context (what siblings have written this round)
 *   5. supervisor directive (critic's revision guidance, if any)
 *   6. retrieved knowledge evidence
 *   7. round suffix
 *
 * Each non-empty block is wrapped with a clear section header so the LLM can
 * navigate. Empty blocks are omitted to keep the prompt tight.
 */
function buildSystemPrompt(profile: AgentProfile, state: BmcGeneratorStateType): string {
  const sections: string[] = [profile.system_prompt, `\n\n用户问题：${state.question}`]
  if (state.contextPrompt) sections.push('\n\n' + state.contextPrompt.trim())
  if (state.crossContextPrompt) sections.push('\n\n' + state.crossContextPrompt.trim())
  if (state.supervisorDirectivePrompt) sections.push('\n\n' + state.supervisorDirectivePrompt.trim())
  if (state.userSkillPrompt) {
    sections.push(
      '\n\n## 用户长期画像（仅供你 calibrate cell 内容深度 + 用词，不要在回答里复述）\n' +
        state.userSkillPrompt.trim()
    )
  }
  sections.push(renderKnowledgeContext(state.knowledgeEvidence ?? []))
  sections.push(getRevisionSuffix(state.roundNumber))
  return sections.join('')
}

// ============== Subgraph factory ==============

export function buildBmcGeneratorSubgraph(
  profile: AgentProfile,
  model: BusinessModel | null,
  lcTools: StructuredToolInterface[],
  cfg: BmcGeneratorConfig
) {
  if (!model) {
    return new StateGraph(BmcGeneratorState)
      .addNode('noop', async () => ({ [cfg.outputField]: [] } as Partial<BmcGeneratorStateType>))
      .addEdge(START, 'noop')
      .addEdge('noop', END)
      .compile()
  }

  // ReAct loop is now delegated to LangGraph's `createReactAgent` prebuilt
  // (replaces the manual `call-llm ⇄ tools` cycle we used to hand-roll).
  // Built ONCE at compile time; the per-state system prompt is rendered
  // by the `invoke-agent` outer node and prepended as the first message
  // when invoking. The prebuilt also auto-tags spans for LangSmith
  // tracing in the right "react agent" semantic, which our manual
  // version didn't.
  //
  // Why we still wrap it in an outer StateGraph instead of just registering
  // the prebuilt directly: we need the `parse` node — `extractAndParseJSON`
  // with partial-recovery for malformed JSON, plus `normalizeDomainNodes`
  // to validate and slot output into the agent-specific output field
  // (marketNodes / productNodes / financeNodes). Those are domain-specific
  // and don't fit the prebuilt's `responseFormat` (which expects strict
  // structured output, not JSON-with-recovery).
  const reactAgent = createReactAgent({
    llm: model as unknown as Parameters<typeof createReactAgent>[0]['llm'],
    tools: lcTools
  })

  const invokeAgent = async (
    state: BmcGeneratorStateType
  ): Promise<Partial<BmcGeneratorStateType>> => {
    const systemPromptText = buildSystemPrompt(profile, state)
    const result = (await reactAgent.invoke({
      messages: [
        new SystemMessage(systemPromptText),
        new HumanMessage(state.question)
      ]
    })) as { messages: BaseMessage[] }
    return { messages: result.messages }
  }

  const parseNode = async (
    state: BmcGeneratorStateType
  ): Promise<Partial<BmcGeneratorStateType>> => {
    const lastAI = [...state.messages]
      .reverse()
      .find((m) => m._getType() === 'ai') as AIMessage | undefined
    if (!lastAI) return { [cfg.outputField]: [] } as Partial<BmcGeneratorStateType>

    const content = readModelText(lastAI)
    const nodes = extractAndParseJSON(content, cfg.loggerName)
    if (nodes.length === 0) return { [cfg.outputField]: [] } as Partial<BmcGeneratorStateType>

    const validated = normalizeDomainNodes(nodes, {
      allowedDomains: cfg.domains,
      agentType: cfg.agentType,
      round: state.roundNumber
    })

    // P11.11 · Sub-agent visibility. Walk all AIMessages in the ReAct
    // session and collect tool names invoked. Attach to each generated
    // node's metadata.subAgentsInvoked so the frontend drawer can render
    // "本 cell 由以下 sub-agent 协作生成: persona-clusterer / market-sizer / ...".
    // The metadata schema is .passthrough() so this extra field is preserved.
    const subAgentsInvoked: string[] = []
    const seen = new Set<string>()
    for (const msg of state.messages) {
      if (msg._getType() !== 'ai') continue
      const toolCalls = (msg as AIMessage).tool_calls ?? []
      for (const tc of toolCalls) {
        const name = (tc as { name?: string }).name
        if (typeof name === 'string' && !seen.has(name)) {
          seen.add(name)
          subAgentsInvoked.push(name)
        }
      }
    }

    if (subAgentsInvoked.length > 0) {
      for (const node of validated) {
        const existing = (node.metadata ?? {}) as Record<string, unknown>
        ;(node.metadata as Record<string, unknown>) = {
          ...existing,
          subAgentsInvoked
        }
      }
    }

    return { [cfg.outputField]: validated } as Partial<BmcGeneratorStateType>
  }

  return new StateGraph(BmcGeneratorState)
    .addNode('invoke-agent', invokeAgent)
    .addNode('parse', parseNode)
    .addEdge(START, 'invoke-agent')
    .addEdge('invoke-agent', 'parse')
    .addEdge('parse', END)
    .compile()
}
