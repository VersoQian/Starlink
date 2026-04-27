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
  Command
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

export type CriticHumanDecision =
  | { kind: 'accepted' }
  | { kind: 'edit_plan'; plan: string }
  | { kind: 'rejected' }
  | { kind: 'none' }

export function parseHumanDecision(raw: unknown): CriticHumanDecision {
  if (typeof raw !== 'string') return { kind: 'none' }
  if (raw.startsWith('[ACCEPTED]')) return { kind: 'accepted' }
  if (raw.startsWith('[EDIT_PLAN]')) {
    return { kind: 'edit_plan', plan: raw.slice('[EDIT_PLAN]'.length).trim() }
  }
  return { kind: 'rejected' }
}

// ============== State ==============

export const CriticSubgraphState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  roundNumber: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  nodesSummary: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  workspaceContext: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
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

      const prompt =
        systemPrompt +
        `\n\n## 商业模型各维度内容\n${state.nodesSummary}` +
        (state.workspaceContext ? `\n\n${state.workspaceContext}` : '') +
        `\n\n如果没有发现冲突，返回空数组 conflicts=[]。不要制造不存在的冲突。`

      const response = await structured.invoke([
        new SystemMessage(prompt),
        new HumanMessage(state.question)
      ])

      return {
        conflicts: toCriticConflicts(response.conflicts, state.roundNumber)
      }
    } catch {
      return { conflicts: ruleBasedCriticCheck(state.nodesSummary) }
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
  checkpointer: MemorySaver | undefined = new MemorySaver()
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
  const compiled = buildCriticSubgraph(model, profile.system_prompt)
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
