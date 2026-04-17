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
  type KnowledgeEvidence,
  type SeminarPhase
} from '@starlink/shared'
import { computeGroundingRate, parseCitations } from './citation/index.js'
import type { Evidence } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:business-langgraph')

const MAX_ROUNDS = 3

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

type CCBMCDomain = (typeof CC_BMC_DOMAINS)[keyof typeof CC_BMC_DOMAINS]
const MARKET_DOMAINS = [
  CC_BMC_DOMAINS.CUSTOMER_SEGMENTS,
  CC_BMC_DOMAINS.CHANNELS,
  CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS
] as const
const PRODUCT_DOMAINS = [
  CC_BMC_DOMAINS.VALUE_PROPOSITIONS,
  CC_BMC_DOMAINS.KEY_RESOURCES,
  CC_BMC_DOMAINS.KEY_ACTIVITIES,
  CC_BMC_DOMAINS.KEY_PARTNERSHIPS
] as const
const FINANCE_DOMAINS = [
  CC_BMC_DOMAINS.REVENUE_STREAMS,
  CC_BMC_DOMAINS.COST_STRUCTURE
] as const

// ============== Agent 类型 ==============
const AGENT_TYPES = {
  MARKET: 'Market_Agent',
  PRODUCT: 'Product_Agent',
  FINANCE: 'Finance_Agent',
  COMPLIANCE: 'Compliance_Agent',
  ORCHESTRATOR: 'Orchestrator',
  CRITIC: 'Adversarial_Critic'
} as const

type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

type BusinessModel = {
  invoke: (messages: Array<SystemMessage | HumanMessage>) => Promise<unknown>
  withStructuredOutput: <T>(
    schema: z.ZodType<T>,
    options: { name: string; strict: boolean }
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

// ============== MacraNodeData Schema（用于验证 LLM 输出） ==============
const MacraNodeDataSchema = z.object({
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
  }),
  agentType: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
  isInteractive: z.boolean().optional(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  conflictType: z.enum(['resource-goal', 'compliance-business', 'channel-product', 'other']).optional()
})

type MacraNodeData = z.infer<typeof MacraNodeDataSchema>

// ============== Intent 分类 ==============
const IntentSchema = z.object({
  intent: z.enum(['generate_bmc', 'analyze', 'detect_conflicts', 'general']),
  reasoning: z.string()
})

type Intent = z.infer<typeof IntentSchema>

// ============== Supervisor Directive ==============
type SupervisorDirective = {
  activeAgents: string[]       // 本轮需要执行的 Agent 节点名称
  guidance: string             // 给 Agent 的修正指导
  conflictSummary: string      // 上一轮的冲突摘要
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
const BusinessState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
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

type BusinessStateType = typeof BusinessState.State

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

// ============== Main Service ==============
export class BusinessLangGraphService {
  private readonly model: BusinessModel | null

  constructor(model: BusinessModel | null = createLLMModel()) {
    this.model = model
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
  }): AsyncGenerator<BusinessStreamUpdate> {
    const traceId = context.traceId ?? nanoid(10)
    const streamStartedAt = Date.now()
    const baseState = createBlankState({
      traceId,
      workspaceId: context.workspaceId,
      userId: context.userId,
      question: context.question
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

    const graph = this.createGraph()

    try {
      const stream = await graph.stream(
        {
          traceId,
          workspaceId: context.workspaceId,
          userId: context.userId,
          question: context.question,
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
        { streamMode: 'updates' }
      )

      for await (const update of stream) {
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
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Market Agent
          if (nodeName === 'marketAgent' && payload.marketNodes) {
            const nodes = payload.marketNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Product Agent
          if (nodeName === 'productAgent' && payload.productNodes) {
            const nodes = payload.productNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Finance Agent
          if (nodeName === 'financeAgent' && payload.financeNodes) {
            const nodes = payload.financeNodes as MacraNodeData[]
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

      this.logTrace({
        step: 'streamConversation',
        traceId,
        workspaceId: context.workspaceId,
        userId: context.userId,
        status: 'completed',
        durationMs: Date.now() - streamStartedAt
      })
      yield { type: 'status', status: 'completed' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
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
      yield {
        type: 'delta',
        delta: builder.addInsightNode('执行失败', `错误信息：${message}`, 'review')
      }
      yield { type: 'status', status: 'failed', message }
    }
  }

  // ============== Graph Topology ==============
  // START → supervisor → [marketAgent|productAgent|financeAgent] → synthesizer → critic → (supervisor | END)

  private createGraph() {
    return new StateGraph(BusinessState)
      .addNode('supervisor', async (state) => this.runSupervisor(state))
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
      .compile()
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
        strict: true
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

    const knowledgeContext = this.buildKnowledgePrompt(state)

    try {
      const response = await this.model.invoke([
        new SystemMessage(`你是 Orchestrator，负责直接回答用户的问题。

要求：
1. 回答必须直接、具体，优先解决用户当前问题
2. 如果当前工作区已经有商业画布，请结合既有上下文回答
3. 使用简洁 Markdown
4. 不要输出 JSON，不要解释你的系统角色${knowledgeContext}`),
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

  private getRevisionSuffix(state: BusinessStateType): string {
    if (state.roundNumber <= 1) return ''
    return `\n\n**重要：这是第 ${state.roundNumber} 轮修正。请根据上面的修正指导调整你的分析。**`
  }

  private async runMarketAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const startedAt = Date.now()
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

    const crossContext = this.buildCrossContextPrompt(state, 'market')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Market_Agent（市场分析专家），负责生成 CC-BMC 商业模型画布中的三个维度：

1. **客户细分** (CUSTOMER_SEGMENTS)：目标客户群体、用户画像、市场规模
2. **渠道通路** (CHANNELS)：如何触达客户、线上/线下渠道、分发策略
3. **客户关系** (CUSTOMER_RELATIONSHIPS)：如何维系客户、服务模式、用户粘性

用户问题：${state.question}
${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

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

    const crossContext = this.buildCrossContextPrompt(state, 'product')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Product_Agent（产品策略专家），负责生成 CC-BMC 商业模型画布中的四个维度：

1. **价值主张** (VALUE_PROPOSITIONS)：核心价值、差异化优势、解决的痛点
2. **核心资源** (KEY_RESOURCES)：关键资产、技术能力、人才团队
3. **关键业务** (KEY_ACTIVITIES)：核心活动、业务流程、运营重点
4. **重要合作** (KEY_PARTNERSHIPS)：关键伙伴、生态协作、供应链与战略联盟

用户问题：${state.question}
${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

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

    const crossContext = this.buildCrossContextPrompt(state, 'finance')
    const knowledgeContext = this.buildKnowledgePrompt(state)

    const prompt = `你是 Finance_Agent（财务分析专家），负责生成 CC-BMC 商业模型画布中的两个维度：

1. **收入来源** (REVENUE_STREAMS)：商业模式、定价策略、收入结构
2. **成本结构** (COST_STRUCTURE)：主要成本、成本控制、盈利能力

用户问题：${state.question}
${crossContext}${knowledgeContext}${this.getRevisionSuffix(state)}

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
      nodes.map((n) => `- **${n.domain ?? n.label}**: ${n.content.substring(0, 80)}`).join('\n')

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

    const nodesSummary = allNodes
      .map((n) => `[${n.metadata.agent_signature ?? 'unknown'}] ${n.domain ?? n.label}: ${n.content.substring(0, 120)}`)
      .join('\n')

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
        strict: true
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

function extractAndParseJSON(content: string, agentName: string): MacraNodeData[] {
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

function normalizeDomainNodes(
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

function buildDeterministicNodeId(agentType: AgentType, domain: CCBMCDomain) {
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
}): BusinessStateType {
  return {
    traceId: params.traceId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    question: params.question,
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

function readModelText(response: unknown) {
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

function createLLMModel(): BusinessModel | null {
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
