/**
 * Critic (Advisor) · Phase 2.5 F5 · Real LLM-driven subgraph + HITL scaffold.
 *
 * Subgraph topology:
 *   START → detect-conflicts → [hasHighSev && HITL_ENABLED ?]
 *                                ├─ yes → await-human → END
 *                                └─ no  → END
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
  interrupt,
  Command,
  type BaseCheckpointSaver
} from '@langchain/langgraph'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

import {
  makeProfileGetter,
  profileToAdvisorDescriptor,
  registerAdvisor,
  type RelevanceScorer
} from '../../capabilities/index.js'
import { createLLMModelFor } from '../../services/llm-factory.js'
import {
  type MacraNodeData,
  type BusinessModel
} from '../../services/business-langgraph.js'
import { AGENT_TYPES } from '../shared/parsing.js'
import { createAuditLogger } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:agents:critic')

// ============== Exports for outer graph ==============

export const CriticOutputSchema = z.object({
  conflicts: z.array(
    z.object({
      label: z.string(),
      description: z.string(),
      severity: z.enum(['high', 'medium', 'low']),
      conflictType: z.enum([
        'resource-goal',
        'compliance-business',
        'channel-product',
        'other'
      ]),
      relatedAgents: z.array(z.string())
    })
  )
})

export type CriticOutput = z.infer<typeof CriticOutputSchema>

export type CriticConflict = MacraNodeData & {
  relatedAgents?: string[]
}

// Re-exported from `./parser.js` so unit tests can import the parser
// without triggering this module's `ready` IIFE (which awaits agent.yaml
// loading + LLM-model construction — fine in production but hostile to
// dist/-based test runners that don't ship the yaml alongside graph.js).
import { parseHumanDecision, type CriticHumanDecision } from './parser.js'
export type { CriticHumanDecision }
export { parseHumanDecision }

// ============== State ==============

/**
 * Blackboard view consumed by the critic subgraph (parity with the BMC
 * generators; see bmc-generator-subgraph.ts:44 for the canonical shape).
 *
 * - `nodesSummary`           ← cross-agent context: union of market+product+finance nodes
 * - `workspaceContext`       ← workspace canvas + memories (from buildWorkspaceContextPrompt)
 * - `supervisorDirective`    ← previous round's revision directive; lets round-2+ critic
 *                              avoid re-flagging conflicts the supervisor already routed
 *                              to a generator for fix
 * - `knowledgeEvidence`      ← retrieved facts; lets critic check claims against evidence
 *                              instead of relying purely on internal consistency
 */
export const CriticSubgraphState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  roundNumber: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  nodesSummary: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  workspaceContext: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  supervisorDirective: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  knowledgeEvidence: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  conflicts: Annotation<CriticConflict[]>({ reducer: (_a, b) => b, default: () => [] }),
  humanDecision: Annotation<CriticHumanDecision>({
    reducer: (_a, b) => b,
    default: () => ({ kind: 'none' })
  }),
  humanOverride: Annotation<string>({ reducer: (_a, b) => b, default: () => '' })
})

export type CriticSubgraphStateType = typeof CriticSubgraphState.State

// ============== Profile ==============

const here = dirname(fileURLToPath(import.meta.url))
const getProfile = makeProfileGetter(join(here, 'agent.yaml'))

// ============== Helpers ==============

function isHitlEnabled(): boolean {
  return process.env.HITL_ENABLED === 'true'
}

function hasHighSeverity(conflicts: CriticConflict[]): boolean {
  return conflicts.some((c) => c.severity === 'high')
}

function toCriticConflicts(
  raw: CriticOutput['conflicts'],
  round: number
): CriticConflict[] {
  return raw.map((c) => ({
    id: `conflict-${nanoid(8)}`,
    type: 'conflict-alert' as const,
    label: c.label,
    content:
      `**冲突类型**：${c.conflictType}\n\n` +
      `**原因**：${c.description}\n\n` +
      `**相关 Agent**：${c.relatedAgents.join(', ')}`,
    severity: c.severity,
    conflictType: c.conflictType,
    relatedAgents: c.relatedAgents,
    metadata: {
      agent_signature: AGENT_TYPES.CRITIC,
      confidence: 'high' as const,
      stage: 'review' as const,
      tags: [`round-${round}`]
    }
  }))
}

function ruleBasedCriticCheck(nodesSummary: string): CriticConflict[] {
  const conflicts: CriticConflict[] = []
  const hasHighEnd = /高端|中产|premium|奢侈/.test(nodesSummary)
  const hasLowPrice = /低价|降价|廉价|平价/.test(nodesSummary)
  if (hasHighEnd && hasLowPrice) {
    conflicts.push({
      id: `conflict-${nanoid(8)}`,
      type: 'conflict-alert',
      label: '定价策略冲突',
      content:
        '**冲突类型**：channel-product\n\n' +
        '**原因**：目标客户定位高端，但定价策略倾向低价。\n\n' +
        '**相关 Agent**：Market_Agent, Finance_Agent',
      severity: 'high',
      conflictType: 'channel-product',
      relatedAgents: [AGENT_TYPES.MARKET, AGENT_TYPES.FINANCE],
      metadata: {
        agent_signature: AGENT_TYPES.CRITIC,
        confidence: 'medium',
        stage: 'review'
      }
    })
  }
  return conflicts
}

// ============== Nodes ==============

function makeDetectConflictsNode(model: BusinessModel | null, systemPrompt: string) {
  return async (
    state: CriticSubgraphStateType
  ): Promise<Partial<CriticSubgraphStateType>> => {
    if (!state.nodesSummary) {
      return { conflicts: [] }
    }

    if (!model) {
      return { conflicts: ruleBasedCriticCheck(state.nodesSummary) }
    }

    try {
      const structured = model.withStructuredOutput(CriticOutputSchema, {
        name: 'ConflictAnalysis',
        strict: true
      })

      const sections: string[] = [
        systemPrompt,
        `\n\n## 商业模型各维度内容\n${state.nodesSummary}`
      ]
      if (state.workspaceContext) sections.push('\n\n' + state.workspaceContext.trim())
      if (state.supervisorDirective) {
        sections.push(
          '\n\n## Supervisor 上一轮修正指导（仅供参考，避免重复标记已分发待修的冲突）\n' +
            state.supervisorDirective.trim()
        )
      }
      if (state.knowledgeEvidence) {
        sections.push(
          '\n\n## 知识库证据\n' +
            state.knowledgeEvidence.trim() +
            '\n\n如果某个 claim 与上方证据矛盾，应作为冲突标出。'
        )
      }
      sections.push(
        '\n\n如果没有发现冲突，返回空数组 conflicts=[]。不要制造不存在的冲突。'
      )
      const prompt = sections.join('')

      const response = await structured.invoke([
        new SystemMessage(prompt),
        new HumanMessage(state.question)
      ])

      return {
        conflicts: toCriticConflicts(response.conflicts, state.roundNumber)
      }
    } catch (err) {
      // P11.17 · log + tag the LLM failure so the user / wire panel sees
      // the degradation. Previously this silent fallback returned
      // rule-based heuristic conflicts that look identical to LLM ones,
      // hiding the fact that semantic conflict detection is offline.
      // The conflicts are still returned (best-effort), but each entry
      // gets a 'degraded:rule-based' tag in metadata.tags so downstream
      // moderator + frontend can flag them.
      auditLogger.warn({
        action: 'critic.llm-failed-rule-based-fallback',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: {
          round: state.roundNumber,
          err: err instanceof Error ? err.message : String(err),
          fallback: 'rule-based-critic-check'
        }
      })
      // P11.18 · separate SLO bucket for rule-based fallback so the
      // operator can distinguish "critic used LLM successfully (most
      // common)" from "critic fell through to heuristic". The wrapper
      // invokeRegisteredAgent will still tally `critic-agent` as
      // success (the call returned conflicts); this extra bucket
      // surfaces the degradation rate explicitly. Compute fallback%
      // as `critic-agent:rule-fallback.invocations / critic-agent.invocations`.
      try {
        const { recordAgentInvocation } = await import(
          '../../infrastructure/observability/agent-slo-tracker.js'
        )
        recordAgentInvocation('critic-agent:rule-fallback', 0, 'fallback')
      } catch {
        // SLO tracking must never break the critic path.
      }
      const fallbackConflicts = ruleBasedCriticCheck(state.nodesSummary).map((c) => ({
        ...c,
        metadata: {
          ...(c.metadata ?? {}),
          tags: [...((c.metadata?.tags as string[] | undefined) ?? []), 'degraded:rule-based'],
          degraded: true,
          source: '规则启发式（LLM 不可用）'
        }
      }))
      return { conflicts: fallbackConflicts }
    }
  }
}

async function awaitHumanNode(
  state: CriticSubgraphStateType
): Promise<Partial<CriticSubgraphStateType>> {
  const raw = interrupt({
    kind: 'critic-high-severity',
    traceId: state.traceId,
    conflicts: state.conflicts,
    roundNumber: state.roundNumber,
    question: state.question,
    acceptedFormat: '[ACCEPTED]',
    editFormat: '[EDIT_PLAN]:<修改后的方案>'
  })

  const decision = parseHumanDecision(raw)
  if (decision.kind === 'edit_plan') {
    return { humanDecision: decision, humanOverride: decision.plan }
  }
  return { humanDecision: decision }
}

function shouldAwaitHuman(state: CriticSubgraphStateType): 'await-human' | typeof END {
  if (!isHitlEnabled()) return END
  if (!hasHighSeverity(state.conflicts)) return END
  if (state.roundNumber >= 2) return END
  return 'await-human'
}

// ============== Subgraph builder ==============

export function buildCriticSubgraph(
  model: BusinessModel | null,
  systemPrompt: string,
  /**
   * Defaults to a per-instance MemorySaver for backward compat (in-process
   * tests, scripts that don't have a PG pool). Production wiring in `ready`
   * below now passes the shared PostgresSaver from
   * `infrastructure/langgraph/checkpointer.ts` so HITL `interrupt` state
   * survives gateway restarts and is shared across multiple gateway
   * instances. Without this, a server bounce while the critic was waiting
   * for human review left the resume thread orphaned.
   */
  checkpointer: BaseCheckpointSaver | undefined = new MemorySaver()
) {
  const detectNode = makeDetectConflictsNode(model, systemPrompt)

  return new StateGraph(CriticSubgraphState)
    .addNode('detect-conflicts', detectNode)
    .addNode('await-human', awaitHumanNode)
    .addEdge(START, 'detect-conflicts')
    .addConditionalEdges('detect-conflicts', shouldAwaitHuman, {
      'await-human': 'await-human',
      [END]: END
    })
    .addEdge('await-human', END)
    .compile({ checkpointer })
}

// ============== Registration ==============

interface CriticRelevantState {
  roundNumber?: number
}

const relevanceScorer: RelevanceScorer<CriticRelevantState> = (state) =>
  (state.roundNumber ?? 0) > 0 ? 1 : 0

export const ready: Promise<void> = (async () => {
  const profile = await getProfile()
  const model = createLLMModelFor(profile)
  // Reach for the shared PostgresSaver so HITL interrupt state is durable
  // across gateway restarts (was MemorySaver — process-local, lost on
  // bounce). `getCheckpointer()` returns null when LANGGRAPH_CHECKPOINTER_
  // ENABLED=false or when no DATABASE_URL is set; in either case fall back
  // to MemorySaver (the previous behaviour) so dev / unit tests keep
  // working without a PG.
  const { getCheckpointer } = await import('../../infrastructure/langgraph/checkpointer.js')
  const pgCheckpointer = await getCheckpointer().catch(() => null)
  const compiled = buildCriticSubgraph(
    model,
    profile.system_prompt,
    pgCheckpointer ?? undefined
  )
  registerAdvisor(
    profileToAdvisorDescriptor<CriticRelevantState>(
      profile,
      () => compiled,
      relevanceScorer
    )
  )
})()

export function buildCriticRevisionCommand(target: string, update: Record<string, unknown>) {
  return new Command({ goto: target, update })
}
