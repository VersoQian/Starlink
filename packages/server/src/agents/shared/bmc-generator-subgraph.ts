/**
 * Shared ReAct subgraph factory for BMC-generating agents (market / product /
 * finance). These three agents share identical structure differing only in:
 *   - which state field receives the output (marketNodes/productNodes/financeNodes)
 *   - the domain allow-list
 *   - the AgentType used in node metadata signature
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { ToolNode } from '@langchain/langgraph/prebuilt'
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

function buildSystemPrompt(profile: AgentProfile, state: BmcGeneratorStateType): string {
  return (
    profile.system_prompt +
    `\n\n用户问题：${state.question}` +
    renderKnowledgeContext(state.knowledgeEvidence ?? []) +
    getRevisionSuffix(state.roundNumber)
  )
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

  const modelWithTools =
    lcTools.length > 0 && 'bindTools' in model
      ? (model as unknown as {
          bindTools: (t: StructuredToolInterface[]) => BusinessModel
        }).bindTools(lcTools)
      : model

  const callLLM = async (
    state: BmcGeneratorStateType
  ): Promise<Partial<BmcGeneratorStateType>> => {
    const firstCall = state.messages.length === 0
    const inputMessages = firstCall
      ? [new SystemMessage(buildSystemPrompt(profile, state)), new HumanMessage(state.question)]
      : state.messages

    const response = await modelWithTools.invoke(inputMessages as Array<SystemMessage | HumanMessage>)
    return { messages: firstCall ? [...inputMessages, response as BaseMessage] : [response as BaseMessage] }
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
    return { [cfg.outputField]: validated } as Partial<BmcGeneratorStateType>
  }

  const shouldUseTools = (state: BmcGeneratorStateType): 'tools' | 'parse' => {
    const lastMsg = state.messages.at(-1)
    if (!lastMsg || lastMsg._getType() !== 'ai') return 'parse'
    const ai = lastMsg as AIMessage
    return ai.tool_calls && ai.tool_calls.length > 0 ? 'tools' : 'parse'
  }

  const toolNode = new ToolNode(lcTools)

  return new StateGraph(BmcGeneratorState)
    .addNode('call-llm', callLLM)
    .addNode('tools', toolNode)
    .addNode('parse', parseNode)
    .addEdge(START, 'call-llm')
    .addConditionalEdges('call-llm', shouldUseTools, { tools: 'tools', parse: 'parse' })
    .addEdge('tools', 'call-llm')
    .addEdge('parse', END)
    .compile()
}
