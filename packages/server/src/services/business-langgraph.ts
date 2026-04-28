import { nanoid } from 'nanoid'
import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import {
  createAuditLogger,
  deriveSnippetId,
  type CanvasEdge,
  type CanvasGraph,
  type CanvasNode,
  type BmcCompactCardContext,
  type KnowledgeEvidence,
  type SeminarPhase
} from '@starlink/shared'
import { computeGroundingRate, parseCitations } from './citation/index.js'
import type { Evidence } from '@starlink/shared'
import { agentRegistry, advisorRegistry } from '../capabilities/index.js'
import {
  SupervisorDecisionSchema,
  type SupervisorDecision,
  type RoutingDecision
} from './routing-schema.js'
import {
  getHandoffLogger,
  releaseHandoffLogger,
  type Handoff,
  type TaskAssignmentPayload,
  type GenerationOutputPayload,
  type RevisionRequestPayload
} from '../infrastructure/handoff-log/index.js'
import {
  getWorkspaceMemoryStore,
  isMemoryReadEnabled,
  isMemoryWriteEnabled
} from '../infrastructure/memory/workspace-memory-store.js'
import { ConversationMemoryStore } from '../application/conversation-memory-store.js'
import { UserSkillExtractor } from './user-skill-extractor.js'
import { buildUserSkillPrompt as buildUserSkillPromptShared } from './user-skill-prompt.js'
import { getCheckpointer } from '../infrastructure/langgraph/checkpointer.js'
import { runDebate } from '../agents/shared/debate-orchestrator.js'
import { defaultLlmDebateInvoker } from '../agents/shared/llm-debate-invoker.js'
import { trace, context as otelContext, SpanStatusCode, type Context as OtelContext } from '@opentelemetry/api'
import { getTracer } from '../infrastructure/telemetry/otel-init.js'

const otelTracer = getTracer('starlink/business-langgraph')

// Per-conversation root span context, looked up by traceId so child spans
// (supervisor / agent invoke / critic / debate) can attach as descendants
// even when called from inside the LangGraph stream callback chain.
const businessSpanContexts = new Map<string, OtelContext>()

const auditLogger = createAuditLogger('packages/server:business-langgraph')

// ============== Phase C / 4.1 / 4.4 helpers ==============

type OrchestrationMode = 'legacy' | 'registry'

function getOrchestrationMode(): OrchestrationMode {
  return process.env.ORCHESTRATION_MODE === 'registry' ? 'registry' : 'legacy'
}

function isDebateEnabled(): boolean {
  return process.env.DEBATE_ENABLED === 'true'
}

const OPPONENT_MAP: Record<string, string> = {
  'market-agent': 'market-opponent',
  'product-agent': 'product-opponent',
  'finance-agent': 'finance-opponent'
}

const AGENT_SIGNATURE_TO_ID: Record<string, string> = {
  Market_Agent: 'market-agent',
  Product_Agent: 'product-agent',
  Finance_Agent: 'finance-agent'
}

const MAX_ROUNDS = 3
const MAX_CONTEXT_CLAIMS_PER_CARD = 4

// ============== CC-BMC 九大维度（与前端保持一致） ==============
const CC_BMC_DOMAINS = {
  CUSTOMER_SEGMENTS: '客户细分',
  CUSTOMER_RELATIONSHIPS: '客户关系',
  CHANNELS: '渠道通路',
  VALUE_PROPOSITIONS: '价值主张',
  REVENUE_STREAMS: '收入来源',
  KEY_ACTIVITIES: '关键业务',
  KEY_RESOURCES: '核心资源',
  KEY_PARTNERSHIPS: '重要合作',
  COST_STRUCTURE: '成本结构'
} as const

export type CCBMCDomain = (typeof CC_BMC_DOMAINS)[keyof typeof CC_BMC_DOMAINS]
export const MARKET_DOMAINS = [
  CC_BMC_DOMAINS.CUSTOMER_SEGMENTS,
  CC_BMC_DOMAINS.CHANNELS,
  CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS
] as const
export const PRODUCT_DOMAINS = [
  CC_BMC_DOMAINS.VALUE_PROPOSITIONS,
  CC_BMC_DOMAINS.KEY_RESOURCES,
  CC_BMC_DOMAINS.KEY_ACTIVITIES,
  CC_BMC_DOMAINS.KEY_PARTNERSHIPS
] as const
export const FINANCE_DOMAINS = [
  CC_BMC_DOMAINS.REVENUE_STREAMS,
  CC_BMC_DOMAINS.COST_STRUCTURE
] as const

// ============== Agent 类型 ==============
export const AGENT_TYPES = {
  MARKET: 'Market_Agent',
  PRODUCT: 'Product_Agent',
  FINANCE: 'Finance_Agent',
  COMPLIANCE: 'Compliance_Agent',
  ORCHESTRATOR: 'Orchestrator',
  CRITIC: 'Adversarial_Critic'
} as const

export type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

export type BusinessModel = {
  invoke: (messages: Array<SystemMessage | HumanMessage>) => Promise<unknown>
  withStructuredOutput: <T>(
    schema: z.ZodType<T>,
    options: {
      name: string
      strict?: boolean
      // langchain-openai withStructuredOutput accepts a `method` discriminator
      // — 'jsonSchema' is the default strict mode (OpenAI/Azure only),
      // 'functionCalling' uses tool-call routing (DeepSeek-compatible),
      // 'jsonMode' uses `response_format: { type: 'json_object' }`.
      method?: 'functionCalling' | 'jsonMode' | 'jsonSchema'
    }
  ) => {
    invoke: (messages: Array<SystemMessage | HumanMessage>) => Promise<T>
  }
}

// Agent 名称到 LangGraph 节点名称的映射
const AGENT_TO_NODE: Record<string, string> = {
  [AGENT_TYPES.MARKET]: 'marketAgent',
  [AGENT_TYPES.PRODUCT]: 'productAgent',
  [AGENT_TYPES.FINANCE]: 'financeAgent'
}

/** Phase C bridge: registry kebab id → legacy camelCase node name. */
const REGISTRY_ID_TO_NODE: Record<string, string> = {
  'market-agent': 'marketAgent',
  'product-agent': 'productAgent',
  'finance-agent': 'financeAgent'
}

// ============== MacraNodeData Schema（用于验证 LLM 输出） ==============
export const MacraNodeDataSchema = z.object({
  id: z.string(),
  type: z.enum(['cc-bmc-card', 'agent-avatar', 'insight-note', 'conflict-alert', 'data-source']),
  label: z.string().max(50),
  content: z.string(),
  domain: z.enum(Object.values(CC_BMC_DOMAINS) as [string, ...string[]]).optional(),
  metadata: z.object({
    agent_signature: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    stage: z.enum(['planning', 'execution', 'review', 'decision']).optional()
  }).passthrough(),
  agentType: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
  isInteractive: z.boolean().optional(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  conflictType: z.enum(['resource-goal', 'compliance-business', 'channel-product', 'other']).optional()
})

export type MacraNodeData = z.infer<typeof MacraNodeDataSchema>

// ============== Intent 分类 ==============
const IntentSchema = z.object({
  intent: z.enum(['generate_bmc', 'analyze', 'detect_conflicts', 'general']),
  reasoning: z.string()
})

type Intent = z.infer<typeof IntentSchema>

// ============== Supervisor Directive ==============
type SupervisorDirective = {
  activeAgents: string[]       // 本轮需要执行的 Agent 节点名称（legacy 格式）
  guidance: string             // 给 Agent 的修正指导
  conflictSummary: string      // 上一轮的冲突摘要
  /** Phase C+: structured routing decisions from runSupervisorRegistry. */
  decisions?: RoutingDecision[]
}

// ============== Cross Context（Agent 间共享上下文） ==============
type CrossContext = {
  marketSummary: string
  productSummary: string
  financeSummary: string
  consistencyNotes: string     // Synthesizer 的一致性报告
}

type SeededBusinessState = {
  marketNodes: MacraNodeData[]
  productNodes: MacraNodeData[]
  financeNodes: MacraNodeData[]
  agentAvatars: MacraNodeData[]
  conflicts: CriticConflict[]
  edges: CanvasEdge[]
}

const EMPTY_CROSS_CONTEXT: CrossContext = {
  marketSummary: '',
  productSummary: '',
  financeSummary: '',
  consistencyNotes: ''
}

const EMPTY_SEEDED_STATE: SeededBusinessState = {
  marketNodes: [],
  productNodes: [],
  financeNodes: [],
  agentAvatars: [],
  conflicts: [],
  edges: []
}

// ============== Conflict with related agents ==============
type CriticConflict = MacraNodeData & {
  relatedAgents?: string[]     // 需要修正的 Agent 类型
}

// ============== LangGraph State ==============
export const BusinessState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  contextPrompt: Annotation<string>(),
  intent: Annotation<Intent | null>(),
  roundNumber: Annotation<number>(),
  supervisorDirective: Annotation<SupervisorDirective | null>(),
  crossContext: Annotation<CrossContext>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence[]>(),
  generalNodes: Annotation<MacraNodeData[]>(),
  marketNodes: Annotation<MacraNodeData[]>(),
  productNodes: Annotation<MacraNodeData[]>(),
  financeNodes: Annotation<MacraNodeData[]>(),
  agentAvatars: Annotation<MacraNodeData[]>(),
  conflicts: Annotation<CriticConflict[]>(),
  edges: Annotation<CanvasEdge[]>()
})

export type BusinessStateType = typeof BusinessState.State

// ============== Stream Update 类型 ==============
export type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  removedNodeIds?: string[]
  removedEdgeIds?: string[]
}

export type BusinessStreamUpdate =
  | { type: 'init'; graph: CanvasGraph; knowledgeEvidence?: KnowledgeEvidence[] }
  | { type: 'delta'; delta: GraphDelta }
  | { type: 'status'; status: 'completed' | 'failed'; message?: string }
  | { type: 'interrupt'; decision: string; conflicts: MacraNodeData[] }
  | { type: 'handoff'; handoff: Handoff }

// ============== Main Service ==============
export class BusinessLangGraphService {
  private readonly model: BusinessModel | null
  private readonly conversationMemoryStore: ConversationMemoryStore
  private readonly userSkillExtractor: UserSkillExtractor

  constructor(
    model: BusinessModel | null = createLLMModel(),
    options: {
      conversationMemoryStore?: ConversationMemoryStore
      userSkillExtractor?: UserSkillExtractor
    } = {}
  ) {
    this.model = model
    this.conversationMemoryStore =
      options.conversationMemoryStore ?? new ConversationMemoryStore()
    this.userSkillExtractor =
      options.userSkillExtractor ??
      new UserSkillExtractor({ memoryStore: this.conversationMemoryStore })
  }

  private logTrace(params: {
    step: string
    traceId: string
    workspaceId: string
    userId: string
    status: 'started' | 'received' | 'completed' | 'failed'
    durationMs?: number
    metadata?: Record<string, unknown>
  }) {
    auditLogger.info({
      action: `business-langgraph.${params.step}`,
      requestId: params.traceId,
      workflowId: params.workspaceId,
      userId: params.userId,
      durationMs: params.durationMs,
      metadata: {
        status: params.status,
        ...params.metadata
      }
    })
  }

  async *streamConversation(context: {
    workspaceId: string
    userId: string
    question: string
    traceId?: string
    baseGraph?: CanvasGraph
    knowledgeEvidence?: KnowledgeEvidence[]
    contextPrompt?: string
  }): AsyncGenerator<BusinessStreamUpdate> {
    const traceId = context.traceId ?? nanoid(10)
    const streamStartedAt = Date.now()
    const baseState = createBlankState({
      traceId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      question: context.question,
      contextPrompt: context.contextPrompt ?? ''
    })
    const initialIntent = this.model
      ? await this.classifyIntent(baseState)
      : null
    const shouldReuseGraph = shouldReuseWorkspaceGraph(initialIntent?.intent)
      && hasUsableWorkspaceGraph(context.baseGraph)
    const seededState = shouldReuseGraph && context.baseGraph
      ? extractSeededStateFromGraph(context.baseGraph)
      : EMPTY_SEEDED_STATE
    const initialCrossContext = hasSeededDomainNodes(seededState)
      ? this.buildCrossContext({
          ...baseState,
          crossContext: EMPTY_CROSS_CONTEXT,
          generalNodes: [],
          marketNodes: seededState.marketNodes,
          productNodes: seededState.productNodes,
          financeNodes: seededState.financeNodes,
          agentAvatars: seededState.agentAvatars,
          conflicts: seededState.conflicts,
          edges: seededState.edges
        })
      : EMPTY_CROSS_CONTEXT
    const builder = new BusinessCanvasBuilder(
      context.workspaceId,
      context.userId,
      context.question,
      shouldReuseGraph ? context.baseGraph : undefined
    )

    this.logTrace({
      step: 'streamConversation',
      traceId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      status: 'started'
    })

    // OTel root span for this conversation. Child spans attach via the context
    // we register in `businessSpanContexts` keyed by traceId.
    const businessSpan = otelTracer.startSpan('business.streamConversation', {
      attributes: {
        'starlink.workspace_id': context.workspaceId,
        'starlink.user_id': context.userId,
        'starlink.trace_id': traceId
      }
    })
    const businessCtx = trace.setSpan(otelContext.active(), businessSpan)
    businessSpanContexts.set(traceId, businessCtx)

    yield {
      type: 'init',
      graph: builder.getGraph(),
      knowledgeEvidence: context.knowledgeEvidence
    }

    if (!this.model) {
      auditLogger.warn({
        action: 'business-langgraph.streamConversation',
        requestId: traceId,
        workflowId: context.workspaceId,
        userId: context.userId,
        metadata: { message: 'LLM not configured, returning fallback node' }
      })
      yield {
        type: 'delta',
        delta: builder.addInsightNode('未配置 LLM', '请在 .env 文件中配置 LLM_API_KEY 环境变量', 'planning')
      }
      yield { type: 'status', status: 'completed' }
      return
    }

    const graph = await this.createGraph()

    // Phase 3.1 · subscribe to handoff logger so we can stream events to client.
    const handoffLogger = getHandoffLogger(traceId)
    const handoffQueue: Handoff[] = []
    const unsubscribeHandoff = handoffLogger.subscribe((h) => handoffQueue.push(h))
    const drainHandoffs = (): BusinessStreamUpdate[] => {
      const out: BusinessStreamUpdate[] = []
      while (handoffQueue.length > 0) {
        const h = handoffQueue.shift()
        if (h) out.push({ type: 'handoff', handoff: h })
      }
      return out
    }

    let bmcNodeCount = 0
    let conflictCount = 0

    try {
      const stream = await graph.stream(
        {
          traceId,
          workspaceId: context.workspaceId,
          userId: context.userId,
          question: context.question,
          contextPrompt: context.contextPrompt ?? '',
          intent: initialIntent,
          roundNumber: 0,
          supervisorDirective: null,
          crossContext: initialCrossContext,
          knowledgeEvidence: context.knowledgeEvidence ?? [],
          generalNodes: [],
          marketNodes: seededState.marketNodes,
          productNodes: seededState.productNodes,
          financeNodes: seededState.financeNodes,
          agentAvatars: seededState.agentAvatars,
          conflicts: seededState.conflicts,
          edges: seededState.edges
        },
        {
          streamMode: 'updates',
          // Day-1b: thread_id propagation for LangSmith grouping.
          configurable: { thread_id: traceId }
        }
      )

      for await (const update of stream) {
        // Phase 3.1: drain handoff events between iterations.
        for (const evt of drainHandoffs()) yield evt

        const entries = Object.entries(update as Record<string, Record<string, unknown>>)

        for (const [nodeName, payload] of entries) {
          this.logTrace({
            step: 'streamConversation.update',
            traceId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            status: 'received',
            metadata: {
              nodeName,
              payloadKeys: Object.keys(payload),
              roundNumber: (payload as { roundNumber?: number }).roundNumber
            }
          })

          // Supervisor
          if (nodeName === 'supervisor') {
            if (payload.intent) {
              const intent = payload.intent as Intent
              yield {
                type: 'delta',
                delta: builder.addInsightNode(
                  '意图识别',
                  `**用户意图**: ${intent.intent}\n\n**分析**: ${intent.reasoning}`,
                  'planning'
                )
              }
            }
            if (payload.supervisorDirective) {
              const directive = payload.supervisorDirective as SupervisorDirective
              if (directive.conflictSummary) {
                yield {
                  type: 'delta',
                  delta: builder.addInsightNode(
                    `第 ${(payload.roundNumber as number) ?? '?'} 轮修正`,
                    `**冲突摘要**：${directive.conflictSummary}\n\n**修正方向**：${directive.guidance}`,
                    'review'
                  )
                }
              }
            }
          }

          // General Responder
          if (nodeName === 'generalResponder' && payload.generalNodes) {
            const nodes = payload.generalNodes as MacraNodeData[]
            bmcNodeCount += nodes.length
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Market Agent
          if (nodeName === 'marketAgent' && payload.marketNodes) {
            const nodes = payload.marketNodes as MacraNodeData[]
            bmcNodeCount += nodes.length
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Product Agent
          if (nodeName === 'productAgent' && payload.productNodes) {
            const nodes = payload.productNodes as MacraNodeData[]
            bmcNodeCount += nodes.length
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Finance Agent
          if (nodeName === 'financeAgent' && payload.financeNodes) {
            const nodes = payload.financeNodes as MacraNodeData[]
            bmcNodeCount += nodes.length
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Synthesizer
          if (nodeName === 'synthesizer') {
            if (payload.agentAvatars) {
              const avatars = payload.agentAvatars as MacraNodeData[]
              for (const avatar of avatars) {
                yield { type: 'delta', delta: builder.addMacraNode(avatar) }
              }
            }
            if (payload.edges) {
              const edges = payload.edges as CanvasEdge[]
              yield { type: 'delta', delta: { edges } }
            }
            if (payload.crossContext) {
              const ctx = payload.crossContext as CrossContext
              if (ctx.consistencyNotes) {
                yield {
                  type: 'delta',
                  delta: builder.addInsightNode(
                    '一致性报告',
                    ctx.consistencyNotes,
                    'review'
                  )
                }
              }
            }
          }

          // Critic
          if (nodeName === 'critic' && payload.conflicts) {
            const conflicts = payload.conflicts as MacraNodeData[]
            conflictCount = conflicts.length
            yield {
              type: 'delta',
              delta: builder.replaceNodesByMacraType('conflict-alert', conflicts)
            }

            // 如果有高严重度冲突且还有修正轮次，发送 interrupt 信号
            const highSeverityConflicts = conflicts.filter((c) => c.severity === 'high')
            if (highSeverityConflicts.length > 0) {
              const roundNum = (payload as { roundNumber?: number }).roundNumber
              if (roundNum !== undefined && roundNum < MAX_ROUNDS) {
                yield {
                  type: 'interrupt',
                  decision: `发现 ${highSeverityConflicts.length} 个高严重度冲突`,
                  conflicts: highSeverityConflicts
                }
              }
            }
          }
        }
      }

      // Phase 3.1: final handoff drain + completion event.
      for (const evt of drainHandoffs()) yield evt
      handoffLogger.record({
        from: '_system',
        to: '_canvas',
        kind: 'completion',
        payload: { durationMs: Date.now() - streamStartedAt, eventCount: handoffLogger.size },
        meta: { round: 0, threadId: traceId, traceId }
      })
      for (const evt of drainHandoffs()) yield evt

      this.logTrace({
        step: 'streamConversation',
        traceId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        status: 'completed',
        durationMs: Date.now() - streamStartedAt,
        metadata: { handoffCount: handoffLogger.size }
      })
      yield { type: 'status', status: 'completed' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      businessSpan.recordException(error as Error)
      businessSpan.setStatus({ code: SpanStatusCode.ERROR, message })
      auditLogger.error({
        action: 'business-langgraph.streamConversation',
        requestId: traceId,
        workflowId: context.workspaceId,
        userId: context.userId,
        metadata: { error: message },
        error
      })
      this.logTrace({
        step: 'streamConversation',
        traceId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        status: 'failed',
        durationMs: Date.now() - streamStartedAt,
        metadata: { error: message }
      })
      // Phase 3.1: also drain handoffs on failure.
      for (const evt of drainHandoffs()) yield evt
      handoffLogger.record({
        from: '_system',
        to: '_canvas',
        kind: 'escalation',
        payload: { error: message, durationMs: Date.now() - streamStartedAt },
        meta: { round: 0, threadId: traceId, traceId }
      })
      for (const evt of drainHandoffs()) yield evt
      yield {
        type: 'delta',
        delta: builder.addInsightNode('执行失败', `错误信息：${message}`, 'review')
      }
      yield { type: 'status', status: 'failed', message }
    } finally {
      // Phase 4.4 (audit fix 2.2): write summary memory regardless of
      // success/failure — even partial conversations are worth remembering
      // (the bmcNodeCount/conflictCount tracked through the stream tell us
      // how far we got before failing).
      try {
        await this.writeConversationSummary({
          workspaceId: context.workspaceId,
          userId: context.userId,
          traceId,
          question: context.question,
          bmcNodeCount,
          conflictCount,
          durationMs: Date.now() - streamStartedAt,
          handoffCount: handoffLogger.size
        })
      } catch {
        // writeConversationSummary already swallows; redundant guard.
      }
      unsubscribeHandoff()
      releaseHandoffLogger(traceId)
      businessSpanContexts.delete(traceId)
      businessSpan.end()
    }
  }

  // ============== Graph Topology ==============
  // START → supervisor → [marketAgent|productAgent|financeAgent] → synthesizer → critic → (supervisor | END)

  private async createGraph() {
    // F2 · Conditionally attach PostgresSaver checkpointer.
    //
    // When LANGGRAPH_CHECKPOINTER_ENABLED=true (and PG is reachable),
    // every node transition persists state into `checkpoints` keyed by the
    // `thread_id` we pass in `configurable` (currently the conversationId/
    // traceId). This unlocks:
    //   - HITL resume across server restarts
    //   - Cross-process scaling (any gateway instance can resume any thread)
    //   - Post-mortem inspection of stuck seminars
    //
    // When the checkpointer is null (flag off, missing creds, or DDL failed),
    // we compile without it — behaviour is identical to pre-F2 (in-memory
    // execution, lost on restart).
    //
    // NOTE: The critic subgraph in agents/critic/graph.ts still uses MemorySaver
    // — Phase 4.x will migrate it. Mixing is safe because each subgraph
    // owns its own checkpointer namespace.
    const checkpointer = await getCheckpointer()

    const builder = new StateGraph(BusinessState)
      .addNode('supervisor', async (state) =>
        getOrchestrationMode() === 'registry'
          ? this.runSupervisorRegistry(state)
          : this.runSupervisor(state)
      )
      .addNode('generalResponder', async (state) => this.runGeneralResponder(state))
      .addNode('marketAgent', async (state) => this.runMarketAgent(state))
      .addNode('productAgent', async (state) => this.runProductAgent(state))
      .addNode('financeAgent', async (state) => this.runFinanceAgent(state))
      .addNode('synthesizer', async (state) => this.runSynthesizer(state))
      .addNode('critic', async (state) => this.runCritic(state))
      .addEdge(START, 'supervisor')
      .addConditionalEdges('supervisor', (state) => {
        const intent = state.intent?.intent || 'general'
        if (intent === 'detect_conflicts') {
          return ['critic']
        }
        if (intent === 'general') {
          return ['generalResponder']
        }
        // 根据 Supervisor 指令决定哪些 Agent 需要执行
        const directive = state.supervisorDirective
        if (directive && directive.activeAgents.length > 0) {
          return directive.activeAgents
        }
        return ['marketAgent', 'productAgent', 'financeAgent']
      })
      .addEdge('generalResponder', END)
      .addEdge('marketAgent', 'synthesizer')
      .addEdge('productAgent', 'synthesizer')
      .addEdge('financeAgent', 'synthesizer')
      .addEdge('synthesizer', 'critic')
      .addConditionalEdges('critic', (state) => {
        if (state.intent?.intent === 'detect_conflicts') {
          return [END]
        }
        const hasHighSeverity = state.conflicts.some((c) => c.severity === 'high')
        if (hasHighSeverity && state.roundNumber < MAX_ROUNDS) {
          return ['supervisor']
        }
        return [END]
      })

    // Pass checkpointer only when present so existing default-compile shape
    // is preserved when the flag is off.
    return checkpointer ? builder.compile({ checkpointer }) : builder.compile()
  }

  // ============== Supervisor Node ==============

  private async runSupervisor(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()
    const nextRound = state.roundNumber + 1

    // 首轮：执行意图分类（向后兼容原 Router 行为）
    if (state.roundNumber === 0) {
      const intent = state.intent ?? await this.classifyIntent(state)
      this.logTrace({
        step: 'supervisor',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { round: nextRound, intent: intent.intent, mode: 'initial' }
      })
      return {
        intent,
        roundNumber: nextRound,
        supervisorDirective: {
          activeAgents: intent.intent === 'general' || intent.intent === 'detect_conflicts'
            ? []
            : ['marketAgent', 'productAgent', 'financeAgent'],
          guidance: '',
          conflictSummary: ''
        }
      }
    }

    // 后续轮次：分析冲突，派遣相关 Agent 修正
    const conflicts = state.conflicts
    const conflictSummary = conflicts
      .map((c) => `[${c.severity}] ${c.label}: ${c.content.substring(0, 100)}`)
      .join('\n')

    // 确定哪些 Agent 需要修正
    const agentsToRevise = new Set<string>()
    for (const conflict of conflicts) {
      if (conflict.severity !== 'high') continue
      const related = (conflict as CriticConflict).relatedAgents ?? []
      for (const agentType of related) {
        const nodeName = AGENT_TO_NODE[agentType]
        if (nodeName) agentsToRevise.add(nodeName)
      }
    }

    // 如果 Critic 没有标明具体 Agent，全部重来
    if (agentsToRevise.size === 0) {
      agentsToRevise.add('marketAgent')
      agentsToRevise.add('productAgent')
      agentsToRevise.add('financeAgent')
    }

    const activeAgents = [...agentsToRevise]

    // 用 LLM 生成修正指导
    let guidance = `请根据以下冲突修正你的分析：\n${conflictSummary}`
    if (this.model) {
      try {
        const response = await this.model.invoke([
          new SystemMessage(`你是研讨会主持人。以下是上一轮讨论中发现的冲突。请为需要修正的 Agent 提供简洁的修正方向（2-3 句话）。

冲突列表：
${conflictSummary}

需要修正的 Agent：${activeAgents.join(', ')}

只输出修正指导，不要其他内容。`),
          new HumanMessage(state.question)
        ])
        guidance = readModelText(response) || guidance
      } catch {
        // fallback to default guidance
      }
    }

    this.logTrace({
      step: 'supervisor',
      traceId: state.traceId,
      workspaceId: state.workspaceId,
      userId: state.userId,
      status: 'completed',
      durationMs: Date.now() - startedAt,
      metadata: {
        round: nextRound,
        mode: 'revision',
        activeAgents,
        conflictCount: conflicts.length
      }
    })

    return {
      roundNumber: nextRound,
      conflicts: [],  // 清空冲突，让本轮重新检测
      supervisorDirective: {
        activeAgents,
        guidance,
        conflictSummary
      }
    }
  }

  private async classifyIntent(state: BusinessStateType): Promise<Intent> {
    if (!this.model) {
      return { intent: 'general', reasoning: 'LLM not configured' }
    }

    const prompt = `你是意图路由器，需要判断用户的需求类型。

用户问题：${state.question}
${this.buildWorkspaceContextPrompt(state)}

请分析用户意图，返回以下之一：
- generate_bmc: 用户希望生成完整的商业模型画布（CC-BMC 九大维度）
- analyze: 用户希望分析现有画布或获取建议
- detect_conflicts: 用户希望检测逻辑冲突或矛盾
- general: 通用对话或信息查询

返回 JSON 格式：
{
  "intent": "generate_bmc",
  "reasoning": "用户提到了'新能源汽车市场'并要求'分析商业模式'，应该生成完整的 CC-BMC 画布"
}
`

    try {
      const structured = this.model.withStructuredOutput(IntentSchema, {
        name: 'IntentClassification',
        // DeepSeek's OpenAI-compat endpoint doesn't yet support
        // `response_format: json_schema`, but it does support function-call
        // tool routing — that's what `method: 'functionCalling'` selects.
        method: 'functionCalling'
      })
      return await structured.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.classifyIntent',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })
      return { intent: 'generate_bmc', reasoning: 'Failed to classify intent, defaulting to generate_bmc' }
    }
  }

  // ============== Domain Agents ==============

  private async runGeneralResponder(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    if (!this.model) {
      const fallbackNode = createGeneralResponseNode(
        state.traceId,
        '当前未配置 LLM，无法生成通用答复。',
        'decision'
      )
      this.logTrace({
        step: 'generalResponder',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { reason: 'model-not-configured' }
      })
      return { generalNodes: [fallbackNode] }
    }

    const workspaceContext = this.buildWorkspaceContextPrompt(state)
    const knowledgeContext = this.buildKnowledgePrompt(state)

    try {
      const response = await this.model.invoke([
        new SystemMessage(`你是 Orchestrator，负责直接回答用户的问题。

要求：
1. 回答必须直接、具体，优先解决用户当前问题
2. 如果当前工作区已经有商业画布，请结合既有上下文回答
3. 使用简洁 Markdown
4. 不要输出 JSON，不要解释你的系统角色${workspaceContext}${knowledgeContext}`),
        new HumanMessage(state.question)
      ])
      const content = readModelText(response) || '当前没有足够信息生成明确答复。'
      const node = createGeneralResponseNode(state.traceId, content, 'decision')
      this.logTrace({
        step: 'generalResponder',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { usage: extractUsageMetadata(response) }
      })
      return { generalNodes: [node] }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runGeneralResponder',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })
      this.logTrace({
        step: 'generalResponder',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        metadata: { error: String(error) }
      })
      return {
        generalNodes: [createGeneralResponseNode(state.traceId, '通用答复生成失败，请重试。', 'decision')]
      }
    }
  }

  private buildCrossContextPrompt(state: BusinessStateType, excludeAgent: string): string {
    const parts: string[] = []
    const ctx = state.crossContext
    const directive = state.supervisorDirective

    if (directive?.guidance) {
      parts.push(`\n## Supervisor 修正指导\n${directive.guidance}`)
    }

    if (excludeAgent !== 'market' && ctx.marketSummary) {
      parts.push(`\n## Market Agent 已有分析\n${ctx.marketSummary}`)
    }
    if (excludeAgent !== 'product' && ctx.productSummary) {
      parts.push(`\n## Product Agent 已有分析\n${ctx.productSummary}`)
    }
    if (excludeAgent !== 'finance' && ctx.financeSummary) {
      parts.push(`\n## Finance Agent 已有分析\n${ctx.financeSummary}`)
    }
    if (ctx.consistencyNotes) {
      parts.push(`\n## 一致性报告\n${ctx.consistencyNotes}`)
    }

    if (parts.length === 0) return ''
    return `\n\n---\n以下是其他 Agent 的分析结果和 Supervisor 的指导，请确保你的分析与之保持一致性：\n${parts.join('\n')}`
  }

  private buildKnowledgePrompt(state: BusinessStateType): string {
    const evidence = state.knowledgeEvidence
    if (!evidence || evidence.length === 0) return ''

    const snippets = evidence
      .map((e) => {
        const snippetId = deriveSnippetId(
          e.docId,
          e.metadata as { chunkIndex?: number } | undefined,
          e.snippet
        )
        return `[ref:${e.docId}#${snippetId}] ${e.snippet}`
      })
      .join('\n\n')

    return `\n\n---\n## 知识库参考资料（可被引用）

以下是从工作区知识库检索到的资料。生成 \`content\` 字段时**必须**遵循引用规则：

1. 每个具体判断后面必须紧跟引用标记 \`[[ref:docId#snippetId]]\`
2. 无 evidence 支撑的判断必须明确标记 \`[[no-ref]]\`
3. 禁止编造 docId 或 snippetId；只能使用下方出现的标识
4. 引用标记紧跟在被引用的短语之后，不单独成行

### Evidence 索引

${snippets}

### Few-shot 示例

"主力客群是 Z 世代都市青年[[ref:d42#chunk-3]]，集中在一二线城市[[ref:d8#chunk-1]]。该群体消费能力较父辈提升约 30%[[no-ref]]。"`
  }

  private buildWorkspaceContextPrompt(state: BusinessStateType): string {
    const prompt = state.contextPrompt?.trim()
    if (!prompt) return ''
    return `\n\n---\n## 工作区记忆、Session 与 Canvas 上下文\n${prompt}`
  }

  /**
   * Thin instance wrapper around the standalone `buildUserSkillPrompt`
   * helper (services/user-skill-prompt.ts). Honours `MEMORY_READ_ENABLED`
   * gate; the standalone helper itself does no env check so callers from
   * other paths (GraphQL resolver, Next.js routes) decide their own gating.
   */
  async buildUserSkillPrompt(
    userId: string,
    workspaceId: string,
    query: string
  ): Promise<string> {
    if (!isMemoryReadEnabled()) return ''
    return buildUserSkillPromptShared(
      this.conversationMemoryStore,
      userId,
      workspaceId,
      query
    )
  }

  /**
   * Collect evidenceSet in the format expected by citation-parser, deriving
   * snippetId when the raw KnowledgeEvidence entries lack one.
   */
  private toParserEvidence(evidence: KnowledgeEvidence[] | undefined): Evidence[] {
    if (!evidence || evidence.length === 0) return []
    return evidence.map((e, i) => {
      const snippetId = deriveSnippetId(
        e.docId,
        e.metadata as { chunkIndex?: number } | undefined,
        e.snippet
      )
      return {
        id: `${e.docId}-${snippetId}`,
        docId: e.docId,
        snippetId,
        text: e.snippet,
        score: e.score,
        metadata: (e.metadata ?? {}) as Evidence['metadata']
      }
    })
  }

  /**
   * Post-process validated LLM agent output. For each node's `content` field,
   * parse inline `[[ref:docId#snippetId]]` / `[[no-ref]]` tokens and:
   *   - replace `content` with the clean text (tokens removed)
   *   - attach citation/no-ref/invalidRefs/groundingRate info to node.metadata
   */
  private applyCitationParsing(
    nodes: MacraNodeData[],
    evidence: KnowledgeEvidence[] | undefined
  ): MacraNodeData[] {
    const parserEvidence = this.toParserEvidence(evidence)
    return nodes.map((node) => {
      const rawContent = typeof node.content === 'string' ? node.content : ''
      if (!rawContent.includes('[[')) {
        return node
      }
      const parsed = parseCitations(rawContent, parserEvidence)
      const groundingRate = computeGroundingRate(parsed)
      return {
        ...node,
        content: parsed.cleanText,
        metadata: {
          ...(node.metadata ?? {}),
          citations: parsed.spans,
          noRefRanges: parsed.noRefRanges,
          invalidRefs: parsed.invalidRefs,
          groundingRate
        }
      }
    })
  }

  private isAgentActive(state: BusinessStateType, agentNodeName: string): boolean {
    const directive = state.supervisorDirective
    if (!directive) return true
    return directive.activeAgents.includes(agentNodeName)
  }

  // ============== Phase C · Registry-mode supervisor ==============

  /** Resolves the parent OTel context for a given traceId, falling back to active. */
  private parentCtx(traceId: string): OtelContext {
    return businessSpanContexts.get(traceId) ?? otelContext.active()
  }

  private async runSupervisorRegistry(
    state: BusinessStateType
  ): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()
    const nextRound = state.roundNumber + 1
    if (!this.model) return this.runSupervisor(state)

    const span = otelTracer.startSpan(
      'business.supervisor.registry',
      { attributes: { 'starlink.round': nextRound, 'starlink.trace_id': state.traceId } },
      this.parentCtx(state.traceId)
    )

    try {
    const generators = agentRegistry.filter((a) => a.role === 'generator')
    if (generators.length === 0 || state.roundNumber > 0) {
      return this.runSupervisor(state)
    }

    const capabilitySummary = generators
      .map((d) => {
        const caps = d.capabilities
          .map((c) => (c.kind === 'generate' ? `生成 ${c.dimension}` : c.kind))
          .join('、')
        return `- ${d.id} (${d.name}): ${caps}`
      })
      .join('\n')

    const memoryBlock = await this.readWorkspaceMemoriesPrompt(
      state.workspaceId,
      state.question
    )

    const systemPrompt =
      `你是 Supervisor，需要根据用户问题选择需要执行的 agent。\n\n` +
      `可用 agents:\n${capabilitySummary}\n\n` +
      memoryBlock +
      `请返回 SupervisorDecision JSON: { intent, decisions: [{ agent_id, prompt_vars, overrides, reason }], reasoning }\n` +
      `选择规则: 完整 BMC → 选所有 generator；仅分析某域 → 仅选相关 agent；通用对话 → intent=general, decisions=[]`

    try {
      // Zod schema uses `.default({})` for `prompt_vars` and `overrides`, so
      // the input type is wider than the output type. `withStructuredOutput<T>`
      // wants in==out; cast on the schema arg to bridge — runtime parsing
      // applies the defaults so callers always see the populated `T`.
      const structured = this.model.withStructuredOutput<SupervisorDecision>(
        SupervisorDecisionSchema as unknown as z.ZodType<SupervisorDecision>,
        // See classifyIntent for why method: 'functionCalling' (DeepSeek-friendly).
        { name: 'SupervisorDecision', method: 'functionCalling' }
      )
      const raw = await structured.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(state.question)
      ])

      const validDecisions = raw.decisions.filter((d) => agentRegistry.has(d.agent_id))
      if (
        validDecisions.length === 0 &&
        raw.intent !== 'general' &&
        raw.intent !== 'detect_conflicts'
      ) {
        return this.runSupervisor(state)
      }

      const activeAgents = validDecisions.map(
        (d) => REGISTRY_ID_TO_NODE[d.agent_id] ?? d.agent_id
      )
      const intent: Intent = { intent: raw.intent, reasoning: raw.reasoning }

      this.logTrace({
        step: 'supervisor',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: {
          round: nextRound,
          intent: raw.intent,
          mode: 'registry',
          activeAgents,
          decisions: validDecisions.length
        }
      })

      const logger = getHandoffLogger(state.traceId)
      for (const decision of validDecisions) {
        const taskPayload: TaskAssignmentPayload = {
          promptVars: decision.prompt_vars,
          overrides: decision.overrides,
          reason: decision.reason,
          capability: 'generate'
        }
        logger.record({
          from: '_supervisor',
          to: decision.agent_id,
          kind: 'task-assignment',
          payload: taskPayload as unknown as Record<string, unknown>,
          meta: {
            round: nextRound,
            threadId: state.traceId,
            traceId: state.traceId
          }
        })
      }

      return {
        intent,
        roundNumber: nextRound,
        supervisorDirective: {
          activeAgents:
            raw.intent === 'general' || raw.intent === 'detect_conflicts'
              ? []
              : activeAgents,
          guidance: raw.reasoning,
          conflictSummary: '',
          decisions: validDecisions
        }
      }
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
      auditLogger.warn({
        action: 'business-langgraph.supervisorRegistry.fallback',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) }
      })
      return this.runSupervisor(state)
    }
    } finally {
      span.end()
    }
  }

  private async invokeRegisteredAgent<Out extends Partial<BusinessStateType>>(
    agentId: string,
    state: BusinessStateType,
    projectInput: (s: BusinessStateType, d: RoutingDecision | undefined) => Record<string, unknown>,
    projectOutput: (result: Record<string, unknown>) => Out
  ): Promise<Out | null> {
    const descriptor = agentRegistry.get(agentId) ?? advisorRegistry.get(agentId)
    if (!descriptor) return null

    const decision = state.supervisorDirective?.decisions?.find(
      (d) => d.agent_id === agentId
    )

    const subgraph = descriptor.buildSubgraph() as {
      invoke: (
        input: Record<string, unknown>,
        config?: Record<string, unknown>
      ) => Promise<Record<string, unknown>>
    }

    const span = otelTracer.startSpan(
      'business.subagent.invoke',
      {
        attributes: {
          'starlink.agent_id': agentId,
          'starlink.round': state.roundNumber,
          'starlink.trace_id': state.traceId
        }
      },
      this.parentCtx(state.traceId)
    )
    try {
      const result = await subgraph.invoke(projectInput(state, decision), {
        configurable: {
          thread_id: state.traceId,
          agent_id: agentId,
          prompt_vars: decision?.prompt_vars ?? {},
          overrides: decision?.overrides ?? {}
        },
        tags: [agentId, 'bmc']
      })
      return projectOutput(result)
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
      throw err
    } finally {
      span.end()
    }
  }

  // ============== Phase 4.4 · Workspace memory helpers ==============

  private async readWorkspaceMemoriesPrompt(
    workspaceId: string,
    query?: string
  ): Promise<string> {
    if (!isMemoryReadEnabled()) return ''
    try {
      const store = getWorkspaceMemoryStore()
      // When the supervisor knows the user's current question, pass it as
      // `query` so the bridged store can do pgvector cosine retrieval
      // (semantic relevance) instead of the default tag+recency listing.
      // This makes "memory-driven supervisor routing" actually work.
      const memories = await store.search(workspaceId, {
        limit: 8,
        query: query?.trim() || undefined
      })
      if (memories.length === 0) return ''
      const lines = memories
        .map((m, i) => `[${i + 1}] (${m.tags.join(',') || 'general'}) ${m.content}`)
        .join('\n')
      const header = query
        ? '## 此工作区与当前问题语义相关的会话洞察（来自长期记忆）'
        : '## 此工作区的近期会话洞察（来自长期记忆）'
      return `\n\n${header}\n${lines}\n`
    } catch (err) {
      auditLogger.warn({
        action: 'business-langgraph.readWorkspaceMemories.failed',
        metadata: { workspaceId, error: String(err) }
      })
      return ''
    }
  }

  private async writeConversationSummary(args: {
    workspaceId: string
    userId: string
    traceId: string
    question: string
    bmcNodeCount: number
    conflictCount: number
    durationMs: number
    handoffCount: number
  }): Promise<void> {
    if (!isMemoryWriteEnabled()) return
    try {
      const store = getWorkspaceMemoryStore()
      const tags = ['bmc-conversation']
      if (args.conflictCount > 0) tags.push('had-conflicts')
      if (args.bmcNodeCount >= 9) tags.push('full-9-dim-coverage')

      const content =
        `问题: ${args.question.slice(0, 120)} | 产出 ${args.bmcNodeCount} 个 BMC 节点 |` +
        ` 冲突 ${args.conflictCount} 条 | 耗时 ${(args.durationMs / 1000).toFixed(1)}s |` +
        ` 握手 ${args.handoffCount} 次`

      await store.record(args.workspaceId, {
        content,
        tags,
        sourceTraceId: args.traceId,
        metadata: {
          bmcNodeCount: args.bmcNodeCount,
          conflictCount: args.conflictCount,
          durationMs: args.durationMs,
          handoffCount: args.handoffCount
        }
      })
    } catch (err) {
      auditLogger.warn({
        action: 'business-langgraph.writeConversationSummary.failed',
        metadata: { traceId: args.traceId, error: String(err) }
      })
    }

    // Fire-and-forget user-skill extraction (Layer-1 self-evolution).
    // Throttled to every Nth call per user via USER_SKILL_EXTRACT_EVERY_N
    // env (default 3) inside the extractor itself; safe to invoke every
    // conversation. Errors swallowed by the extractor.
    if (args.userId && isMemoryWriteEnabled()) {
      void this.userSkillExtractor.extractUserSkills({
        userId: args.userId,
        workspaceId: args.workspaceId,
        traceId: args.traceId
      })
    }
  }

  // ============== Phase 4.1 · Debate B trigger ==============

  private async maybeRunDebates(
    state: BusinessStateType,
    conflicts: CriticConflict[]
  ): Promise<void> {
    if (!isDebateEnabled()) return
    if (!agentRegistry.has('moderator')) return
    const highSev = conflicts.filter((c) => c.severity === 'high')
    if (highSev.length === 0) return

    for (const conflict of highSev) {
      const related = conflict.relatedAgents ?? []
      for (const signature of related) {
        const proponentId = AGENT_SIGNATURE_TO_ID[signature]
        if (!proponentId) continue
        const opponentId = OPPONENT_MAP[proponentId]
        if (!opponentId) continue
        if (!agentRegistry.has(proponentId)) continue
        if (!advisorRegistry.has(opponentId)) continue

        const debateSpan = otelTracer.startSpan(
          'business.debate.run',
          {
            attributes: {
              'starlink.proponent': proponentId,
              'starlink.opponent': opponentId,
              'starlink.round': state.roundNumber,
              'starlink.conflict_id': conflict.id,
              'starlink.trace_id': state.traceId
            }
          },
          this.parentCtx(state.traceId)
        )
        try {
          await runDebate(
            {
              proponent: proponentId,
              opponent: opponentId,
              moderator: 'moderator',
              dimension: conflict.conflictType ?? undefined,
              traceId: state.traceId,
              threadId: state.traceId,
              round: state.roundNumber,
              disputedNodeIds: [conflict.id],
              config: { maxRounds: 2 }
            },
            defaultLlmDebateInvoker
          )
        } catch (err) {
          debateSpan.recordException(err as Error)
          debateSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
          auditLogger.warn({
            action: 'business-langgraph.maybeRunDebates.debate-failed',
            requestId: state.traceId,
            workflowId: state.workspaceId,
            userId: state.userId,
            metadata: {
              proponent: proponentId,
              opponent: opponentId,
              conflictId: conflict.id,
              error: String(err)
            }
          })
        } finally {
          debateSpan.end()
        }
      }
    }
  }

  // ============== Phase 3.1 · handoff emission helpers ==============

  private emitGenerationOutput(
    state: BusinessStateType,
    agentNodeName: string,
    nodes: MacraNodeData[],
    usage?: Record<string, number> | undefined
  ): void {
    const payload: GenerationOutputPayload = {
      nodeCount: nodes.length,
      nodeIds: nodes.map((n) => n.id),
      tokensUsed: usage?.['totalTokens'] ?? usage?.['total_tokens']
    }
    getHandoffLogger(state.traceId).record({
      from: agentNodeName,
      to: 'synthesizer',
      kind: 'generation-output',
      payload: payload as unknown as Record<string, unknown>,
      meta: {
        round: state.roundNumber,
        threadId: state.traceId,
        traceId: state.traceId
      }
    })
    trace.getActiveSpan()?.addEvent('handoff', {
      kind: 'generation-output',
      from: agentNodeName,
      to: 'synthesizer',
      'starlink.node_count': nodes.length
    })
  }

  private emitRevisionRequests(
    state: BusinessStateType,
    conflicts: CriticConflict[]
  ): void {
    if (conflicts.length === 0) return
    const logger = getHandoffLogger(state.traceId)
    for (const conflict of conflicts) {
      const targets = conflict.relatedAgents ?? []
      for (const target of targets) {
        const payload: RevisionRequestPayload = {
          conflictId: conflict.id,
          severity: conflict.severity ?? 'medium',
          conflictType: conflict.conflictType ?? 'other',
          summary: conflict.label,
          suggestedChange: conflict.content.split('\n')[0]
        }
        logger.record({
          from: 'critic-agent',
          to: target,
          kind: 'revision-request',
          payload: payload as unknown as Record<string, unknown>,
          meta: {
            round: state.roundNumber,
            threadId: state.traceId,
            traceId: state.traceId
          }
        })
        trace.getActiveSpan()?.addEvent('handoff', {
          kind: 'revision-request',
          from: 'critic-agent',
          to: target,
          'starlink.conflict_id': conflict.id,
          'starlink.severity': conflict.severity ?? 'medium'
        })
      }
    }
  }

  private getRevisionSuffix(state: BusinessStateType): string {
    if (state.roundNumber <= 1) return ''
    return `\n\n**重要：这是第 ${state.roundNumber} 轮修正。请根据上面的修正指导调整你的分析。**`
  }

  /**
   * Phase X (blackboard fix): project the full top-level BusinessState into the
   * shape expected by a BMC-generator subgraph, **carrying the full blackboard
   * view** (workspace context + cross-agent context + supervisor directive)
   * rather than just the question + roundNumber as before.
   *
   * Round-1 semantics: cross-context renders empty because no sibling has
   * written yet, so every generator independently produces a first draft from
   * (role + question + workspace memory + retrieved knowledge). Round-2+ each
   * agent additionally sees its siblings' last-round output and the critic's
   * revision directive — this is what gives the multi-agent system its
   * deliberative advantage.
   *
   * The agent's own previous-round output (e.g. marketAgent sees its own
   * marketNodes) is preserved so the subgraph can build on prior work rather
   * than restarting from scratch.
   */
  private projectBlackboardForGenerator(
    state: BusinessStateType,
    self: 'market' | 'product' | 'finance',
    /**
     * Pre-rendered user-skill block; computed by `buildUserSkillPrompt` in
     * the runMarketAgent / runProductAgent / runFinanceAgent caller before
     * invokeRegisteredAgent (because that helper takes a synchronous
     * projection callback). Empty string means "no skill section to render"
     * — the subgraph's buildSystemPrompt skips empty blocks.
     */
    userSkillPrompt: string
  ) {
    const contextPrompt = this.buildWorkspaceContextPrompt(state)
    const crossContextPrompt = this.buildCrossContextPrompt(state, self)
    const directive = state.supervisorDirective
    const supervisorDirectivePrompt = directive?.guidance
      ? `\n## Supervisor 修正指导（critic 反馈）\n${directive.guidance}${
          directive.conflictSummary
            ? `\n\n冲突摘要：${directive.conflictSummary}`
            : ''
        }`
      : ''

    const ownPrevious =
      self === 'market'
        ? { marketNodes: state.marketNodes ?? [] }
        : self === 'product'
        ? { productNodes: state.productNodes ?? [] }
        : { financeNodes: state.financeNodes ?? [] }

    return {
      traceId: state.traceId,
      workspaceId: state.workspaceId,
      userId: state.userId,
      question: state.question,
      roundNumber: state.roundNumber,
      knowledgeEvidence: state.knowledgeEvidence,
      contextPrompt,
      crossContextPrompt,
      supervisorDirectivePrompt,
      userSkillPrompt,
      messages: [],
      ...ownPrevious
    }
  }

  private async runMarketAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    // Phase C: registry mode delegates to YAML market-agent subgraph.
    if (getOrchestrationMode() === 'registry' && agentRegistry.has('market-agent')) {
      if (!this.isAgentActive(state, 'marketAgent')) {
        return { marketNodes: state.marketNodes }
      }
      try {
        const userSkillPrompt = await this.buildUserSkillPrompt(
          state.userId,
          state.workspaceId,
          state.question
        )
        const projected = await this.invokeRegisteredAgent(
          'market-agent',
          state,
          (s) => this.projectBlackboardForGenerator(s, 'market', userSkillPrompt),
          (result) => ({
            marketNodes: (result.marketNodes as MacraNodeData[]) ?? []
          })
        )
        if (projected) {
          this.emitGenerationOutput(state, 'marketAgent', projected.marketNodes ?? [])
          return projected
        }
      } catch (err) {
        auditLogger.error({
          action: 'business-langgraph.runMarketAgent.subgraph-failed',
          requestId: state.traceId,
          workflowId: state.workspaceId,
          userId: state.userId,
          metadata: { error: String(err) },
          error: err as Error
        })
      }
    }

    if (!this.isAgentActive(state, 'marketAgent')) {
      return { marketNodes: state.marketNodes }
    }

    if (!this.model) {
      this.logTrace({
        step: 'marketAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { reason: 'model-not-configured' }
      })
      return { marketNodes: [] }
    }

    const workspaceContext = this.buildWorkspaceContextPrompt(state)
    const crossContext = this.buildCrossContextPrompt(state, 'market')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Market_Agent（市场分析专家），负责生成 CC-BMC 商业模型画布中的三个维度：

1. **客户细分** (CUSTOMER_SEGMENTS)：目标客户群体、用户画像、市场规模
2. **渠道通路** (CHANNELS)：如何触达客户、线上/线下渠道、分发策略
3. **客户关系** (CUSTOMER_RELATIONSHIPS)：如何维系客户、服务模式、用户粘性

用户问题：${state.question}
${workspaceContext}${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

请生成 3 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 market-xxxxx）
- type: "cc-bmc-card"
- domain: "客户细分" | "渠道通路" | "客户关系"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "Market_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }

示例：
[
  {
    "id": "market-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "客户细分",
    "label": "目标客户群体",
    "content": "## 核心客户\\n1. **城市中产家庭** (35-50岁)\\n   - 环保意识强\\n   - 占比 45%\\n2. **商用车队运营商**\\n   - 注重 TCO\\n   - 占比 30%",
    "metadata": {
      "agent_signature": "Market_Agent",
      "confidence": "high",
      "source": "基于中汽协 2024 年度报告",
      "tags": ["B2C", "B2B"]
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = readModelText(response)
      const nodes = extractAndParseJSON(content, 'runMarketAgent')

      if (nodes.length === 0) {
        return { marketNodes: [] }
      }

      const round = state.roundNumber
      const validatedNodes = normalizeDomainNodes(nodes, {
        allowedDomains: MARKET_DOMAINS,
        agentType: AGENT_TYPES.MARKET,
        round
      })

      this.logTrace({
        step: 'marketAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: {
          round,
          nodeCount: validatedNodes.length,
          usage: extractUsageMetadata(response)
        }
      })
      // P0.2.3: legacy LLM path also emits handoff so benchmark metrics aren't 0.
      this.emitGenerationOutput(state, 'marketAgent', validatedNodes, extractUsageMetadata(response))
      return { marketNodes: this.applyCitationParsing(validatedNodes, state.knowledgeEvidence) }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runMarketAgent',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })
      this.logTrace({
        step: 'marketAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        metadata: { error: String(error) }
      })
      return { marketNodes: [] }
    }
  }

  private async runProductAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    if (getOrchestrationMode() === 'registry' && agentRegistry.has('product-agent')) {
      if (!this.isAgentActive(state, 'productAgent')) {
        return { productNodes: state.productNodes }
      }
      try {
        const userSkillPrompt = await this.buildUserSkillPrompt(
          state.userId,
          state.workspaceId,
          state.question
        )
        const projected = await this.invokeRegisteredAgent(
          'product-agent',
          state,
          (s) => this.projectBlackboardForGenerator(s, 'product', userSkillPrompt),
          (result) => ({
            productNodes: (result.productNodes as MacraNodeData[]) ?? []
          })
        )
        if (projected) {
          this.emitGenerationOutput(state, 'productAgent', projected.productNodes ?? [])
          return projected
        }
      } catch (err) {
        auditLogger.error({
          action: 'business-langgraph.runProductAgent.subgraph-failed',
          requestId: state.traceId,
          workflowId: state.workspaceId,
          userId: state.userId,
          metadata: { error: String(err) },
          error: err as Error
        })
      }
    }

    if (!this.isAgentActive(state, 'productAgent')) {
      return { productNodes: state.productNodes }
    }

    if (!this.model) {
      this.logTrace({
        step: 'productAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { reason: 'model-not-configured' }
      })
      return { productNodes: [] }
    }

    const workspaceContext = this.buildWorkspaceContextPrompt(state)
    const crossContext = this.buildCrossContextPrompt(state, 'product')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Product_Agent（产品策略专家），负责生成 CC-BMC 商业模型画布中的四个维度：

1. **价值主张** (VALUE_PROPOSITIONS)：核心价值、差异化优势、解决的痛点
2. **核心资源** (KEY_RESOURCES)：关键资产、技术能力、人才团队
3. **关键业务** (KEY_ACTIVITIES)：核心活动、业务流程、运营重点
4. **重要合作** (KEY_PARTNERSHIPS)：关键伙伴、生态协作、供应链与战略联盟

用户问题：${state.question}
${workspaceContext}${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

请生成 4 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 product-xxxxx）
- type: "cc-bmc-card"
- domain: "价值主张" | "核心资源" | "关键业务" | "重要合作"
- label: 简短标题（5-8 字）
- content: 简洁分析（Markdown 格式，3-5 个要点，每个要点 1 行，总计 100 字以内）
- metadata: { agent_signature: "Product_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }

**重要**：content 必须简洁，避免过长描述。

示例：
[
  {
    "id": "product-abc123",
    "type": "cc-bmc-card",
    "domain": "价值主张",
    "label": "智能驾驶",
    "content": "## 核心价值\\n- L2+ 自动驾驶\\n- OTA 升级\\n- 零排放低成本",
    "metadata": {
      "agent_signature": "Product_Agent",
      "confidence": "high",
      "source": "行业报告",
      "tags": ["科技", "体验"]
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = readModelText(response)
      const nodes = extractAndParseJSON(content, 'runProductAgent')

      if (nodes.length === 0) {
        return { productNodes: [] }
      }

      const round = state.roundNumber
      const validatedNodes = normalizeDomainNodes(nodes, {
        allowedDomains: PRODUCT_DOMAINS,
        agentType: AGENT_TYPES.PRODUCT,
        round
      })

      this.logTrace({
        step: 'productAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: {
          round,
          nodeCount: validatedNodes.length,
          usage: extractUsageMetadata(response)
        }
      })
      this.emitGenerationOutput(state, 'productAgent', validatedNodes, extractUsageMetadata(response))
      return { productNodes: this.applyCitationParsing(validatedNodes, state.knowledgeEvidence) }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runProductAgent',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })
      this.logTrace({
        step: 'productAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        metadata: { error: String(error) }
      })
      return { productNodes: [] }
    }
  }

  private async runFinanceAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    if (getOrchestrationMode() === 'registry' && agentRegistry.has('finance-agent')) {
      if (!this.isAgentActive(state, 'financeAgent')) {
        return { financeNodes: state.financeNodes }
      }
      try {
        const userSkillPrompt = await this.buildUserSkillPrompt(
          state.userId,
          state.workspaceId,
          state.question
        )
        const projected = await this.invokeRegisteredAgent(
          'finance-agent',
          state,
          (s) => this.projectBlackboardForGenerator(s, 'finance', userSkillPrompt),
          (result) => ({
            financeNodes: (result.financeNodes as MacraNodeData[]) ?? []
          })
        )
        if (projected) {
          this.emitGenerationOutput(state, 'financeAgent', projected.financeNodes ?? [])
          return projected
        }
      } catch (err) {
        auditLogger.error({
          action: 'business-langgraph.runFinanceAgent.subgraph-failed',
          requestId: state.traceId,
          workflowId: state.workspaceId,
          userId: state.userId,
          metadata: { error: String(err) },
          error: err as Error
        })
      }
    }

    if (!this.isAgentActive(state, 'financeAgent')) {
      return { financeNodes: state.financeNodes }
    }

    if (!this.model) {
      this.logTrace({
        step: 'financeAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { reason: 'model-not-configured' }
      })
      return { financeNodes: [] }
    }

    const workspaceContext = this.buildWorkspaceContextPrompt(state)
    const crossContext = this.buildCrossContextPrompt(state, 'finance')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Finance_Agent（财务分析专家），负责生成 CC-BMC 商业模型画布中的两个维度：

1. **收入来源** (REVENUE_STREAMS)：商业模式、定价策略、收入结构
2. **成本结构** (COST_STRUCTURE)：主要成本、成本控制、盈利能力

用户问题：${state.question}
${workspaceContext}${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

请生成 2 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 finance-xxxxx）
- type: "cc-bmc-card"
- domain: "收入来源" | "成本结构"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "Finance_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }

示例：
[
  {
    "id": "finance-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "收入来源",
    "label": "多元收入模式",
    "content": "## 收入结构\\n1. **车辆销售** (70%)\\n   - 平均售价 25万\\n2. **增值服务** (20%)\\n   - FSD 订阅\\n3. **充电网络** (10%)",
    "metadata": {
      "agent_signature": "Finance_Agent",
      "confidence": "high",
      "source": "基于财报数据",
      "tags": ["营收", "订阅"]
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = readModelText(response)
      const nodes = extractAndParseJSON(content, 'runFinanceAgent')

      if (nodes.length === 0) {
        return { financeNodes: [] }
      }

      const round = state.roundNumber
      const validatedNodes = normalizeDomainNodes(nodes, {
        allowedDomains: FINANCE_DOMAINS,
        agentType: AGENT_TYPES.FINANCE,
        round
      })

      this.logTrace({
        step: 'financeAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: {
          round,
          nodeCount: validatedNodes.length,
          usage: extractUsageMetadata(response)
        }
      })
      this.emitGenerationOutput(state, 'financeAgent', validatedNodes, extractUsageMetadata(response))
      return { financeNodes: this.applyCitationParsing(validatedNodes, state.knowledgeEvidence) }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runFinanceAgent',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })
      this.logTrace({
        step: 'financeAgent',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        metadata: { error: String(error) }
      })
      return { financeNodes: [] }
    }
  }

  // ============== Synthesizer Node ==============

  private async runSynthesizer(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    // 1. 构建交叉上下文
    const crossContext = this.buildCrossContext(state)

    // 2. 生成 Agent Avatar 节点（仅首轮）
    const agentAvatars: MacraNodeData[] = state.roundNumber <= 1
      ? this.buildAgentAvatars(state)
      : state.agentAvatars

    // 3. 生成边（连接关系）
    const edges = this.buildBMCEdges(state)

    this.logTrace({
      step: 'synthesizer',
      traceId: state.traceId,
      workspaceId: state.workspaceId,
      userId: state.userId,
      status: 'completed',
      durationMs: Date.now() - startedAt,
      metadata: {
        round: state.roundNumber,
        avatarCount: agentAvatars.length,
        edgeCount: edges.length,
        hasConsistencyNotes: crossContext.consistencyNotes.length > 0
      }
    })

    return { agentAvatars, edges, crossContext }
  }

  private buildCrossContext(state: BusinessStateType): CrossContext {
    const summarizeNodes = (nodes: MacraNodeData[]) =>
      renderCompactBmcCardsForPrompt(nodes)

    const marketSummary = summarizeNodes(state.marketNodes)
    const productSummary = summarizeNodes(state.productNodes)
    const financeSummary = summarizeNodes(state.financeNodes)

    // 基于规则的一致性检查
    const allNodes = [...state.marketNodes, ...state.productNodes, ...state.financeNodes]
    const notes: string[] = []

    const hasHighEnd = allNodes.some((n) => /高端|奢侈|premium|中产/.test(n.content))
    const hasLowPrice = allNodes.some((n) => /低价|廉价|降价|平价/.test(n.content))
    if (hasHighEnd && hasLowPrice) {
      notes.push('- 定价与客户定位可能存在矛盾：高端客户群 vs 低价策略')
    }

    const hasHeavyAssets = allNodes.some((n) => /重资产|自建|工厂|生产线/.test(n.content))
    const hasLightModel = allNodes.some((n) => /轻资产|平台|外包|代工/.test(n.content))
    if (hasHeavyAssets && hasLightModel) {
      notes.push('- 资源模型矛盾：同时提及重资产自建和轻资产平台模式')
    }

    return {
      marketSummary,
      productSummary,
      financeSummary,
      consistencyNotes: notes.length > 0
        ? `## 维度间一致性分析\n\n${notes.join('\n')}\n\n请各 Agent 在下一轮修正中关注以上问题。`
        : ''
    }
  }

  private buildAgentAvatars(state: BusinessStateType): MacraNodeData[] {
    const avatars: MacraNodeData[] = []

    if (state.marketNodes.length > 0) {
      avatars.push({
        id: 'avatar-market',
        type: 'agent-avatar',
        label: '市场分析专家',
        content: `我已为你分析了目标客户、渠道通路和客户关系三个维度。\n\n**核心洞察**：${state.marketNodes[0]?.label || '市场分析'}`,
        agentType: AGENT_TYPES.MARKET,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.MARKET,
          confidence: 'high',
          stage: 'execution'
        }
      })
    }

    if (state.productNodes.length > 0) {
      avatars.push({
        id: 'avatar-product',
        type: 'agent-avatar',
        label: '产品策略专家',
        content: `我已为你分析了价值主张、核心资源、关键业务和重要合作。\n\n**核心洞察**：${state.productNodes[0]?.label || '产品策略'}`,
        agentType: AGENT_TYPES.PRODUCT,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.PRODUCT,
          confidence: 'high',
          stage: 'execution'
        }
      })
    }

    if (state.financeNodes.length > 0) {
      avatars.push({
        id: 'avatar-finance',
        type: 'agent-avatar',
        label: '财务分析专家',
        content: `我已为你分析了收入来源和成本结构。\n\n**核心洞察**：${state.financeNodes[0]?.label || '财务分析'}`,
        agentType: AGENT_TYPES.FINANCE,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.FINANCE,
          confidence: 'high',
          stage: 'execution'
        }
      })
    }

    return avatars
  }

  private buildBMCEdges(state: BusinessStateType): CanvasEdge[] {
    const edges: CanvasEdge[] = []
    const allNodes = [...state.marketNodes, ...state.productNodes, ...state.financeNodes]
    const findNode = (domain: string) => allNodes.find((n) => n.domain === domain)

    const valueProp = findNode('价值主张')
    const customerSeg = findNode('客户细分')
    const channels = findNode('渠道通路')
    const customerRel = findNode('客户关系')
    const revenue = findNode('收入来源')
    const keyRes = findNode('核心资源')
    const keyAct = findNode('关键业务')
    const keyPart = findNode('重要合作')
    const cost = findNode('成本结构')

    const addEdge = (source: MacraNodeData | undefined, target: MacraNodeData | undefined, label: string) => {
      if (source && target) {
        edges.push({ id: `${source.id}->${target.id}`, source: source.id, target: target.id, label })
      }
    }

    addEdge(valueProp, customerSeg, '服务于')
    addEdge(channels, customerSeg, '触达')
    addEdge(customerRel, customerSeg, '维系')
    addEdge(keyRes, valueProp, '支撑')
    addEdge(keyAct, valueProp, '创造')
    addEdge(customerSeg, revenue, '带来')
    addEdge(keyRes, cost, '产生')
    addEdge(keyAct, cost, '产生')
    addEdge(keyPart, keyRes, '提供')

    return edges
  }

  // ============== LLM-Driven Critic ==============

  private async runCritic(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()

    // Phase 2.5 F5: registry mode delegates to YAML critic-agent subgraph.
    if (
      getOrchestrationMode() === 'registry' &&
      advisorRegistry.has('critic-agent')
    ) {
      const criticSpan = otelTracer.startSpan(
        'business.critic.subgraph',
        {
          attributes: {
            'starlink.agent_id': 'critic-agent',
            'starlink.round': state.roundNumber,
            'starlink.trace_id': state.traceId
          }
        },
        this.parentCtx(state.traceId)
      )
      try {
        const allNodesForCritic = [
          ...state.marketNodes,
          ...state.productNodes,
          ...state.financeNodes
        ]
        if (allNodesForCritic.length === 0) {
          return { conflicts: [], roundNumber: state.roundNumber }
        }
        const descriptor = advisorRegistry.get('critic-agent')!
        const subgraph = descriptor.buildSubgraph() as {
          invoke: (input: Record<string, unknown>, config?: Record<string, unknown>) => Promise<Record<string, unknown>>
        }
        const directive = state.supervisorDirective
        const supervisorDirective = directive?.guidance
          ? directive.conflictSummary
            ? `${directive.guidance}\n\n冲突摘要：${directive.conflictSummary}`
            : directive.guidance
          : ''
        const result = await subgraph.invoke(
          {
            traceId: state.traceId,
            workspaceId: state.workspaceId,
            userId: state.userId,
            question: state.question,
            roundNumber: state.roundNumber,
            nodesSummary: renderCompactBmcCardsForPrompt(allNodesForCritic),
            workspaceContext: this.buildWorkspaceContextPrompt(state),
            supervisorDirective,
            knowledgeEvidence: this.buildKnowledgePrompt(state)
          },
          {
            configurable: { thread_id: state.traceId, agent_id: 'critic-agent' },
            tags: ['critic-agent', 'bmc']
          }
        )
        const conflicts = (result.conflicts as CriticConflict[]) ?? []
        criticSpan.setAttribute('starlink.conflict_count', conflicts.length)
        await this.maybeRunDebates(state, conflicts)
        this.emitRevisionRequests(state, conflicts)
        return { conflicts, roundNumber: state.roundNumber }
      } catch (err) {
        criticSpan.recordException(err as Error)
        criticSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(err) })
        auditLogger.error({
          action: 'business-langgraph.runCritic.subgraph-failed',
          requestId: state.traceId,
          workflowId: state.workspaceId,
          userId: state.userId,
          metadata: { error: String(err) },
          error: err as Error
        })
      } finally {
        criticSpan.end()
      }
    }

    const allNodes = [...state.marketNodes, ...state.productNodes, ...state.financeNodes]
    if (allNodes.length === 0) {
      this.logTrace({
        step: 'critic',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { conflictCount: 0, reason: 'no-nodes' }
      })
      return { conflicts: [], roundNumber: state.roundNumber }
    }

    // 如果没有 LLM，回退到规则检测
    if (!this.model) {
      const conflicts = this.ruleBasedCriticCheck(allNodes)
      this.logTrace({
        step: 'critic',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { conflictCount: conflicts.length, mode: 'rule-based' }
      })
      return { conflicts, roundNumber: state.roundNumber }
    }

    const nodesSummary = renderCompactBmcCardsForPrompt(allNodes)
    const workspaceContext = this.buildWorkspaceContextPrompt(state)

    const CriticOutputSchema = z.object({
      conflicts: z.array(z.object({
        label: z.string(),
        description: z.string(),
        severity: z.enum(['high', 'medium', 'low']),
        conflictType: z.enum(['resource-goal', 'compliance-business', 'channel-product', 'other']),
        relatedAgents: z.array(z.string())
      }))
    })

    try {
      const structured = this.model.withStructuredOutput(CriticOutputSchema, {
        name: 'ConflictAnalysis',
        // See classifyIntent for why method: 'functionCalling' (DeepSeek-friendly).
        method: 'functionCalling'
      })

      const response = await structured.invoke([
        new SystemMessage(`你是 Adversarial Critic（对抗性评论者），负责审查商业模型画布中各维度之间的逻辑一致性。

分析以下商业模型各维度的内容，找出其中的逻辑矛盾、不一致或风险：

${nodesSummary}

检查维度：
1. 客户定位与定价策略是否一致
2. 核心资源与成本结构是否匹配
3. 价值主张与渠道选择是否协调
4. 收入模式与客户关系是否可行

对每个冲突，指明 relatedAgents 字段（使用这些名称：Market_Agent, Product_Agent, Finance_Agent），表示哪些 Agent 需要修正。

${workspaceContext}

如果没有发现冲突，返回空数组。不要制造不存在的冲突。`),
        new HumanMessage(state.question)
      ])

      const conflicts: CriticConflict[] = response.conflicts.map((c) => ({
        id: `conflict-${nanoid(8)}`,
        type: 'conflict-alert' as const,
        label: c.label,
        content: `**冲突类型**：${c.conflictType}\n\n**原因**：${c.description}\n\n**相关 Agent**：${c.relatedAgents.join(', ')}`,
        severity: c.severity,
        conflictType: c.conflictType,
        relatedAgents: c.relatedAgents,
        metadata: {
          agent_signature: AGENT_TYPES.CRITIC,
          confidence: 'high' as const,
          stage: 'review' as const,
          tags: [`round-${state.roundNumber}`]
        }
      }))

      this.logTrace({
        step: 'critic',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: {
          conflictCount: conflicts.length,
          mode: 'llm',
          round: state.roundNumber,
          usage: extractUsageMetadata(response)
        }
      })
      // P0.2.3: legacy LLM critic path also fires debate + revision-request handoffs.
      await this.maybeRunDebates(state, conflicts)
      this.emitRevisionRequests(state, conflicts)
      return { conflicts, roundNumber: state.roundNumber }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCritic',
        requestId: state.traceId,
        workflowId: state.workspaceId,
        userId: state.userId,
        metadata: { error: String(error) },
        error
      })

      // fallback to rule-based
      const conflicts = this.ruleBasedCriticCheck(allNodes)
      this.logTrace({
        step: 'critic',
        traceId: state.traceId,
        workspaceId: state.workspaceId,
        userId: state.userId,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        metadata: { conflictCount: conflicts.length, mode: 'rule-based-fallback' }
      })
      // P0.2.3: rule-based fallback also emits handoffs (otherwise this
      // common production path is invisible to benchmark eval).
      await this.maybeRunDebates(state, conflicts)
      this.emitRevisionRequests(state, conflicts)
      return { conflicts, roundNumber: state.roundNumber }
    }
  }

  private ruleBasedCriticCheck(allNodes: MacraNodeData[]): CriticConflict[] {
    const conflicts: CriticConflict[] = []

    const hasHighEnd = allNodes.some((n) => typeof n.content === 'string' && /高端|中产|premium|奢侈/.test(n.content))
    const hasLowPrice = allNodes.some((n) => typeof n.content === 'string' && /低价|降价|廉价|平价/.test(n.content))

    if (hasHighEnd && hasLowPrice) {
      conflicts.push({
        id: `conflict-${nanoid(8)}`,
        type: 'conflict-alert',
        label: '定价策略冲突',
        content: `**冲突类型**：channel-product\n\n**原因**：目标客户定位高端市场，但定价策略倾向低价，存在逻辑矛盾。\n\n**建议**：重新审视定价策略，确保与目标客户群体匹配。\n\n**相关 Agent**：Market_Agent, Finance_Agent`,
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
}

// ============== Canvas Builder（管理节点和边） ==============
class BusinessCanvasBuilder {
  private readonly nodes = new Map<string, CanvasNode>()
  private readonly edges = new Map<string, CanvasEdge>()
  private readonly rootId: string | null
  private nextY = ROOT_POSITION.y + NODE_SPACING

  constructor(
    private readonly workspaceId: string,
    private readonly userId: string,
    private readonly question: string,
    initialGraph?: CanvasGraph
  ) {
    if (initialGraph?.workspaceId === this.workspaceId) {
      for (const node of initialGraph.nodes) {
        this.nodes.set(node.id, cloneCanvasNode(node))
      }
      for (const edge of initialGraph.edges) {
        this.edges.set(edge.id, { ...edge })
      }
      this.nextY = computeNextY(initialGraph.nodes)
    }

    if (this.nodes.size > 0) {
      this.rootId = null
      return
    }

    this.rootId = `root-${nanoid(8)}`
    const rootNode: CanvasNode = {
      id: this.rootId,
      type: 'note',
      position: { ...ROOT_POSITION },
      data: {
        type: 'note',
        title: 'Business LangGraph 分析任务',
        subtitle: `提问人：${this.userId || 'anonymous'}`,
        content: this.question,
        footerText: 'Multi-Agent 研讨会模式 · MACRA 系统',
        variant: 'primary'
      }
    }
    this.nodes.set(rootNode.id, rootNode)
  }

  getGraph(): CanvasGraph {
    return {
      workspaceId: this.workspaceId,
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()]
    }
  }

  addMacraNode(macraNode: MacraNodeData): GraphDelta {
    const existing = this.nodes.get(macraNode.id)
    const node: CanvasNode = {
      id: macraNode.id,
      type: 'note',
      position: existing?.position ?? { x: ROOT_POSITION.x, y: this.nextY },
      data: {
        type: 'note',
        title: macraNode.label,
        content: macraNode.content,
        variant: 'insight',
        meta: {
          macraType: macraNode.type,
          domain: macraNode.domain,
          agentType: macraNode.agentType,
          severity: macraNode.severity,
          conflictType: macraNode.conflictType,
          isInteractive: macraNode.isInteractive,
          metadata: macraNode.metadata
        }
      }
    }

    this.nodes.set(node.id, node)
    if (!existing) {
      this.nextY += NODE_SPACING
    }

    return { nodes: [node] }
  }

  replaceNodesByMacraType(macraType: MacraNodeData['type'], nextNodes: MacraNodeData[]): GraphDelta {
    const removedNodeIds = [...this.nodes.values()]
      .filter((node) => {
        const meta = node.data as { meta?: { macraType?: string } } | undefined
        return meta?.meta?.macraType === macraType
      })
      .map((node) => node.id)
    const removedEdgeIds = [...this.edges.values()]
      .filter((edge) => removedNodeIds.includes(edge.source) || removedNodeIds.includes(edge.target))
      .map((edge) => edge.id)

    for (const nodeId of removedNodeIds) {
      this.nodes.delete(nodeId)
    }
    for (const edgeId of removedEdgeIds) {
      this.edges.delete(edgeId)
    }

    const addedNodes: CanvasNode[] = []
    for (const macraNode of nextNodes) {
      const delta = this.addMacraNode(macraNode)
      addedNodes.push(...(delta.nodes ?? []))
    }

    return {
      nodes: addedNodes,
      removedNodeIds,
      removedEdgeIds
    }
  }

  addInsightNode(title: string, content: string, stage: SeminarPhase = 'planning'): GraphDelta {
    const id = `insight-${nanoid(8)}`
    const node: CanvasNode = {
      id,
      type: 'note',
      position: { x: ROOT_POSITION.x, y: this.nextY },
      data: {
        type: 'note',
        title,
        content,
        variant: 'insight',
        meta: {
          macraType: 'insight-note',
          metadata: {
            agent_signature: 'Orchestrator',
            confidence: 'high',
            stage
          }
        }
      }
    }

    this.nodes.set(id, node)
    this.nextY += NODE_SPACING

    return { nodes: [node] }
  }
}

// ============== Helper Functions ==============
function extractUsageMetadata(response: unknown): Record<string, number> | undefined {
  const raw = response as {
    usage_metadata?: Record<string, unknown>
    response_metadata?: {
      tokenUsage?: Record<string, unknown>
      usage?: Record<string, unknown>
    }
  }

  const usage = raw?.usage_metadata ?? raw?.response_metadata?.tokenUsage ?? raw?.response_metadata?.usage

  if (!usage) return undefined

  const inputTokens = readNumber(usage, ['input_tokens', 'promptTokens', 'prompt_tokens']) ?? 0
  const outputTokens = readNumber(usage, ['output_tokens', 'completionTokens', 'completion_tokens']) ?? 0
  const totalTokens = readNumber(usage, ['total_tokens', 'totalTokens']) ?? inputTokens + outputTokens

  return {
    inputTokens,
    outputTokens,
    totalTokens
  }
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return undefined
}

/**
 * Extract one balanced top-level JSON object substring starting at `start`
 * (which must point at `{`). Tracks string-state so braces inside string
 * literals don't trip the depth counter. Returns the substring including
 * outer braces, or null if no balanced object found before EOF.
 */
function extractBalancedObject(src: string, start: number): string | null {
  if (src[start] !== '{') return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Per-cell partial-recovery fallback. When the top-level JSON.parse fails
 * (a single malformed cell taints the whole array), this iterates the
 * cleaned source extracting balanced `{...}` blocks one at a time and
 * tries to parse each independently. Even one broken cell of three no
 * longer drops the entire batch — the surviving cells are returned.
 *
 * Without this, a single SyntaxError at position N inside cell 2 would
 * zero out cells 1, 2, AND 3 — a single point of failure for 3 BMC
 * dimensions. Observed on Notion + Coursera in N=12 evals where
 * market-agent's verbose JSON occasionally trips on Chinese punctuation.
 */
function partialRecoveryParseObjects(
  cleaned: string,
  agentName: string
): MacraNodeData[] {
  const nodes: MacraNodeData[] = []
  let cursor = cleaned.indexOf('{')
  let attempts = 0
  let recovered = 0
  while (cursor !== -1 && attempts < 20) {
    attempts++
    const objStr = extractBalancedObject(cleaned, cursor)
    if (!objStr) break
    try {
      const cleanedObj = objStr.replace(/,(\s*[}\]])/g, '$1')
      const node = JSON.parse(cleanedObj) as MacraNodeData
      // Lightweight shape check: must look like a cc-bmc-card cell
      if (
        node &&
        typeof node === 'object' &&
        typeof (node as { domain?: string }).domain === 'string' &&
        typeof (node as { content?: string }).content === 'string'
      ) {
        nodes.push(node)
        recovered++
      }
    } catch {
      // skip this object, continue scanning
    }
    cursor = cleaned.indexOf('{', cursor + objStr.length)
  }
  if (recovered > 0) {
    auditLogger.warn({
      action: `business-langgraph.${agentName}.parseJSON.partial-recovery`,
      metadata: { recovered, attempts }
    })
  }
  return nodes
}

export function extractAndParseJSON(content: string, agentName: string): MacraNodeData[] {
  try {
    // 1. 移除 Markdown 代码块标记
    let cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')

    // 2. 提取 JSON 数组
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      auditLogger.error({
        action: `business-langgraph.${agentName}.extractJSON`,
        metadata: { error: 'No JSON array found', content: content.substring(0, 200) }
      })
      return []
    }

    let jsonStr = jsonMatch[0]

    // 3. 清理常见的 JSON 格式问题
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')

    // 4. 解析 JSON
    const nodes = JSON.parse(jsonStr) as MacraNodeData[]

    if (!Array.isArray(nodes) || nodes.length === 0) {
      auditLogger.error({
        action: `business-langgraph.${agentName}.parseJSON`,
        metadata: { error: 'Parsed result is not a valid array', nodes }
      })
      return []
    }

    return nodes
  } catch (error) {
    // Per-cell partial recovery: don't lose ALL cells just because ONE has
    // a syntax error somewhere in the JSON.
    const cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    const recovered = partialRecoveryParseObjects(cleanedContent, agentName)
    if (recovered.length > 0) {
      auditLogger.warn({
        action: `business-langgraph.${agentName}.parseJSON.recovered`,
        metadata: {
          originalError: String(error),
          recoveredCount: recovered.length,
          errorType: error instanceof SyntaxError ? 'SyntaxError' : 'UnknownError'
        }
      })
      return recovered
    }
    auditLogger.error({
      action: `business-langgraph.${agentName}.parseJSON`,
      metadata: {
        error: String(error),
        content: content.substring(0, 500),
        errorType: error instanceof SyntaxError ? 'SyntaxError' : 'UnknownError'
      }
    })
    return []
  }
}

export function normalizeDomainNodes(
  nodes: MacraNodeData[],
  options: {
    allowedDomains: readonly CCBMCDomain[]
    agentType: AgentType
    round: number
  }
): MacraNodeData[] {
  const byDomain = new Map<CCBMCDomain, MacraNodeData>()

  for (const node of nodes) {
    const domain = node.domain as CCBMCDomain | undefined
    if (!domain || !options.allowedDomains.some((allowedDomain) => allowedDomain === domain)) continue
    if (!byDomain.has(domain)) {
      byDomain.set(domain, node)
    }
  }

  const missing = options.allowedDomains.filter((d) => !byDomain.has(d))
  if (missing.length > 0) {
    auditLogger.warn({
      action: 'business-langgraph.normalizeDomainNodes.missingDomains',
      metadata: {
        agentType: options.agentType,
        round: options.round,
        expected: options.allowedDomains,
        produced: [...byDomain.keys()],
        missing
      }
    })
  }

  return options.allowedDomains.flatMap((domain) => {
    const node = byDomain.get(domain)
    if (!node) return []

    return [{
      ...node,
      id: buildDeterministicNodeId(options.agentType, domain),
      type: 'cc-bmc-card' as const,
      domain,
      metadata: {
        ...node.metadata,
        agent_signature: options.agentType,
        stage: options.round > 1 ? ('review' as const) : ('execution' as const),
        tags: appendRoundTag(node.metadata?.tags ?? [], options.round)
      }
    }]
  })
}

/**
 * Validate that a generated graph covers the full 9-dimension CC-BMC spec.
 * Used as an integration-level invariant check: if any dimension is absent
 * from agent output, the system should at minimum surface this as a
 * structural issue rather than silently accept an 8-dimension graph.
 *
 * Returns the list of missing dimensions (empty = complete).
 */
export function validateNineBmcDimensions(nodes: MacraNodeData[]): CCBMCDomain[] {
  const produced = new Set<CCBMCDomain>()
  for (const node of nodes) {
    const d = node.domain as CCBMCDomain | undefined
    if (d) produced.add(d)
  }
  const allDomains = Object.values(CC_BMC_DOMAINS) as CCBMCDomain[]
  return allDomains.filter((d) => !produced.has(d))
}

export function buildDeterministicNodeId(agentType: AgentType, domain: CCBMCDomain) {
  const agentPrefix: Record<AgentType, string> = {
    [AGENT_TYPES.MARKET]: 'market',
    [AGENT_TYPES.PRODUCT]: 'product',
    [AGENT_TYPES.FINANCE]: 'finance',
    [AGENT_TYPES.COMPLIANCE]: 'compliance',
    [AGENT_TYPES.ORCHESTRATOR]: 'orchestrator',
    [AGENT_TYPES.CRITIC]: 'critic'
  }
  const domainSuffix: Record<CCBMCDomain, string> = {
    [CC_BMC_DOMAINS.CUSTOMER_SEGMENTS]: 'customer-segments',
    [CC_BMC_DOMAINS.CHANNELS]: 'channels',
    [CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS]: 'customer-relationships',
    [CC_BMC_DOMAINS.VALUE_PROPOSITIONS]: 'value-propositions',
    [CC_BMC_DOMAINS.KEY_RESOURCES]: 'key-resources',
    [CC_BMC_DOMAINS.KEY_ACTIVITIES]: 'key-activities',
    [CC_BMC_DOMAINS.KEY_PARTNERSHIPS]: 'key-partnerships',
    [CC_BMC_DOMAINS.REVENUE_STREAMS]: 'revenue-streams',
    [CC_BMC_DOMAINS.COST_STRUCTURE]: 'cost-structure'
  }

  return `${agentPrefix[agentType]}-${domainSuffix[domain]}`
}

function appendRoundTag(tags: string[], round: number) {
  if (round <= 1) return [...new Set(tags)]
  return [...new Set([...tags, `round-${round}`])]
}

export function buildCompactBmcCardContext(node: MacraNodeData): BmcCompactCardContext {
  const keyClaims = extractKeyClaims(node.content)
  return {
    id: node.id,
    domain: node.domain as BmcCompactCardContext['domain'],
    label: node.label,
    agentSignature: node.metadata.agent_signature as BmcCompactCardContext['agentSignature'],
    confidence: node.metadata.confidence,
    keyClaims,
    assumptions: findContextSignals(keyClaims, ['假设', '预计', '可能', '依赖', '如果']),
    risks: findContextSignals(keyClaims, ['风险', '冲突', '不足', '不确定', '成本', '监管', '依赖']),
    evidenceRefs: extractEvidenceRefs(node.metadata)
  }
}

export function renderCompactBmcCardsForPrompt(nodes: MacraNodeData[]): string {
  if (nodes.length === 0) return ''

  return nodes
    .map(buildCompactBmcCardContext)
    .map((card) => {
      const lines = [
        `- **${card.domain ?? card.label}** (${card.agentSignature ?? 'unknown'}, confidence: ${card.confidence ?? 'unknown'})`
      ]
      for (const [index, claim] of card.keyClaims.entries()) {
        lines.push(`  - claim ${index + 1}: ${claim}`)
      }
      if (card.assumptions.length > 0) {
        lines.push(`  - assumptions: ${card.assumptions.join('；')}`)
      }
      if (card.risks.length > 0) {
        lines.push(`  - risks: ${card.risks.join('；')}`)
      }
      if (card.evidenceRefs.length > 0) {
        lines.push(`  - evidence: ${card.evidenceRefs.join(', ')}`)
      }
      return lines.join('\n')
    })
    .join('\n')
}

function extractKeyClaims(content: string): string[] {
  const normalized = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[\[(?:ref:[^\]]+|no-ref)\]\]/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\r/g, '\n')

  const lineClaims = normalized
    .split('\n')
    .map(cleanClaim)
    .filter(isUsefulClaim)

  const claims = lineClaims.length > 0
    ? lineClaims
    : normalized
        .split(/[。！？!?；;]/)
        .map(cleanClaim)
        .filter(isUsefulClaim)

  return [...new Set(claims)].slice(0, MAX_CONTEXT_CLAIMS_PER_CARD)
}

function cleanClaim(value: string) {
  return value
    .replace(/^\s*[-+*•\d.、）)]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsefulClaim(value: string) {
  return value.length >= 6 && !/^[-\s]+$/.test(value)
}

function findContextSignals(claims: string[], keywords: string[]) {
  return claims
    .filter((claim) => keywords.some((keyword) => claim.includes(keyword)))
    .slice(0, 3)
}

function extractEvidenceRefs(metadata: MacraNodeData['metadata']) {
  const citations = (metadata as { citations?: unknown }).citations
  if (!Array.isArray(citations)) return []

  const refs = new Set<string>()
  for (const citation of citations) {
    const citationRefs = (citation as { refs?: unknown }).refs
    if (!Array.isArray(citationRefs)) continue
    for (const ref of citationRefs) {
      const evidenceRef = ref as { docId?: unknown; snippetId?: unknown }
      if (typeof evidenceRef.docId === 'string' && typeof evidenceRef.snippetId === 'string') {
        refs.add(`${evidenceRef.docId}#${evidenceRef.snippetId}`)
      }
    }
  }

  return [...refs].slice(0, 8)
}

function shouldReuseWorkspaceGraph(intent?: Intent['intent'] | null) {
  return intent === 'general' || intent === 'analyze' || intent === 'detect_conflicts'
}

function hasUsableWorkspaceGraph(graph?: CanvasGraph) {
  return Boolean(graph && graph.nodes.length > 0)
}

function hasSeededDomainNodes(state: SeededBusinessState) {
  return state.marketNodes.length > 0
    || state.productNodes.length > 0
    || state.financeNodes.length > 0
}

function createBlankState(params: {
  traceId: string
  workspaceId: string
  userId: string
  question: string
  contextPrompt?: string
}): BusinessStateType {
  return {
    traceId: params.traceId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    question: params.question,
    contextPrompt: params.contextPrompt ?? '',
    intent: null,
    roundNumber: 0,
    supervisorDirective: null,
    crossContext: EMPTY_CROSS_CONTEXT,
    knowledgeEvidence: [],
    generalNodes: [],
    marketNodes: [],
    productNodes: [],
    financeNodes: [],
    agentAvatars: [],
    conflicts: [],
    edges: []
  }
}

function extractSeededStateFromGraph(graph: CanvasGraph): SeededBusinessState {
  const seeded: SeededBusinessState = {
    marketNodes: [],
    productNodes: [],
    financeNodes: [],
    agentAvatars: [],
    conflicts: [],
    edges: graph.edges.map((edge) => ({ ...edge }))
  }

  for (const node of graph.nodes) {
    const macraNode = extractMacraNodeFromCanvasNode(node)
    if (!macraNode) continue

    if (macraNode.type === 'agent-avatar') {
      seeded.agentAvatars.push(macraNode)
      continue
    }

    if (macraNode.type === 'conflict-alert') {
      seeded.conflicts.push(macraNode as CriticConflict)
      continue
    }

    const agentId = macraNode.metadata.agent_signature ?? macraNode.agentType
    if (agentId === AGENT_TYPES.MARKET) {
      seeded.marketNodes.push(macraNode)
    } else if (agentId === AGENT_TYPES.PRODUCT) {
      seeded.productNodes.push(macraNode)
    } else if (agentId === AGENT_TYPES.FINANCE) {
      seeded.financeNodes.push(macraNode)
    }
  }

  return seeded
}

function extractMacraNodeFromCanvasNode(node: CanvasNode): MacraNodeData | null {
  const data = (node.data ?? {}) as {
    title?: string
    content?: string
    meta?: {
      macraType?: MacraNodeData['type']
      domain?: CCBMCDomain
      agentType?: AgentType
      severity?: MacraNodeData['severity']
      conflictType?: MacraNodeData['conflictType']
      isInteractive?: boolean
      metadata?: MacraNodeData['metadata']
    }
  }
  const meta = data.meta
  if (!meta?.macraType) return null

  return {
    id: node.id,
    type: meta.macraType,
    label: typeof data.title === 'string' && data.title.trim() ? data.title : node.id,
    content: typeof data.content === 'string' ? data.content : '',
    domain: meta.domain,
    metadata: meta.metadata ?? {},
    agentType: meta.agentType,
    severity: meta.severity,
    conflictType: meta.conflictType,
    isInteractive: meta.isInteractive
  }
}

function createGeneralResponseNode(traceId: string, content: string, stage: SeminarPhase): MacraNodeData {
  return {
    id: `general-response-${traceId}`,
    type: 'insight-note',
    label: '综合回答',
    content,
    metadata: {
      agent_signature: AGENT_TYPES.ORCHESTRATOR,
      confidence: 'high',
      stage
    }
  }
}

export function readModelText(response: unknown) {
  if (typeof response === 'string') return response
  const payload = response as { content?: unknown }
  if (typeof payload?.content === 'string') return payload.content
  if (Array.isArray(payload?.content)) {
    return payload.content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text
        }
        return ''
      })
      .join('')
      .trim()
  }
  return ''
}

function computeNextY(nodes: CanvasNode[]) {
  const maxY = nodes.reduce((max, node) => Math.max(max, node.position?.y ?? ROOT_POSITION.y), ROOT_POSITION.y)
  return maxY + NODE_SPACING
}

function cloneCanvasNode(node: CanvasNode): CanvasNode {
  return {
    ...node,
    position: { ...node.position },
    data: structuredClone(node.data)
  }
}

export function createLLMModel(): BusinessModel | null {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || ''
  if (!apiKey) {
    auditLogger.warn({
      action: 'business-langgraph.createLLMModel',
      metadata: { message: 'No LLM_API_KEY or OPENAI_API_KEY found in environment' }
    })
    return null
  }

  const baseURL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || ''
  const model = process.env.LANGGRAPH_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini'
  const configuration = baseURL ? { baseURL } : undefined

  return new ChatOpenAI({
    apiKey,
    model,
    temperature: 0.3,
    maxTokens: 40000,
    configuration
  })
}

const ROOT_POSITION = { x: 160, y: 160 }
const NODE_SPACING = 220
