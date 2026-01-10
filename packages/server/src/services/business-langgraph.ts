import { nanoid } from 'nanoid'
import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { createAuditLogger, type CanvasEdge, type CanvasGraph, type CanvasNode } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:business-langgraph')

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

// ============== Agent 类型 ==============
const AGENT_TYPES = {
  CUSTOMER_SEGMENTS: 'Customer_Segments_Agent',
  CUSTOMER_RELATIONSHIPS: 'Customer_Relationships_Agent',
  CHANNELS: 'Channels_Agent',
  VALUE_PROPOSITIONS: 'Value_Propositions_Agent',
  REVENUE_STREAMS: 'Revenue_Streams_Agent',
  KEY_ACTIVITIES: 'Key_Activities_Agent',
  KEY_RESOURCES: 'Key_Resources_Agent',
  KEY_PARTNERSHIPS: 'Key_Partnerships_Agent',
  COST_STRUCTURE: 'Cost_Structure_Agent',
  ORCHESTRATOR: 'Orchestrator',
  CRITIC: 'Adversarial_Critic'
} as const

type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

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
    tags: z.array(z.string()).optional()
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

// ============== LangGraph State ==============
const BusinessState = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  intent: Annotation<Intent | null>(),
  customerSegmentsNodes: Annotation<MacraNodeData[]>(),
  customerRelationshipsNodes: Annotation<MacraNodeData[]>(),
  channelsNodes: Annotation<MacraNodeData[]>(),
  valuePropositionsNodes: Annotation<MacraNodeData[]>(),
  revenueStreamsNodes: Annotation<MacraNodeData[]>(),
  keyActivitiesNodes: Annotation<MacraNodeData[]>(),
  keyResourcesNodes: Annotation<MacraNodeData[]>(),
  keyPartnershipsNodes: Annotation<MacraNodeData[]>(),
  costStructureNodes: Annotation<MacraNodeData[]>(),
  agentAvatars: Annotation<MacraNodeData[]>(),
  conflicts: Annotation<MacraNodeData[]>(),
  edges: Annotation<CanvasEdge[]>()
})

type BusinessStateType = typeof BusinessState.State

// ============== Stream Update 类型（与 ComfyStreamUpdate 保持一致） ==============
export type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

export type BusinessStreamUpdate =
  | { type: 'init'; graph: CanvasGraph }
  | { type: 'delta'; delta: GraphDelta }
  | { type: 'status'; status: 'completed' | 'failed'; message?: string }

// ============== Main Service ==============
export class BusinessLangGraphService {
  private readonly model: ChatOpenAI | null

  constructor() {
    this.model = createLLMModel()
  }

  async *streamConversation(context: {
    workspaceId: string
    userId: string
    question: string
  }): AsyncGenerator<BusinessStreamUpdate> {
    const builder = new BusinessCanvasBuilder(context.workspaceId, context.userId, context.question)

    // 1. 初始化画布（发送 init 事件）
    yield { type: 'init', graph: builder.getGraph() }

    // 2. 如果没有 LLM 配置，返回简单的提示节点
    if (!this.model) {
      auditLogger.warn({
        action: 'business-langgraph.streamConversation',
        metadata: { message: 'LLM not configured, returning fallback node' }
      })
      yield {
        type: 'delta',
        delta: builder.addInsightNode('未配置 LLM', '请在 .env 文件中配置 LLM_API_KEY 环境变量')
      }
      yield { type: 'status', status: 'completed' }
      return
    }

    // 3. 创建 LangGraph
    const graph = this.createGraph()
    const domainNodeHandlers = [
      { nodeName: 'customerSegmentsAgent', key: 'customerSegmentsNodes' as const },
      { nodeName: 'customerRelationshipsAgent', key: 'customerRelationshipsNodes' as const },
      { nodeName: 'channelsAgent', key: 'channelsNodes' as const },
      { nodeName: 'valuePropositionsAgent', key: 'valuePropositionsNodes' as const },
      { nodeName: 'revenueStreamsAgent', key: 'revenueStreamsNodes' as const },
      { nodeName: 'keyActivitiesAgent', key: 'keyActivitiesNodes' as const },
      { nodeName: 'keyResourcesAgent', key: 'keyResourcesNodes' as const },
      { nodeName: 'keyPartnershipsAgent', key: 'keyPartnershipsNodes' as const },
      { nodeName: 'costStructureAgent', key: 'costStructureNodes' as const }
    ]

    try {
      // 4. 执行 LangGraph（流式模式）
      const stream = await graph.stream(
        {
          workspaceId: context.workspaceId,
          userId: context.userId,
          question: context.question,
          intent: null,
          customerSegmentsNodes: [],
          customerRelationshipsNodes: [],
          channelsNodes: [],
          valuePropositionsNodes: [],
          revenueStreamsNodes: [],
          keyActivitiesNodes: [],
          keyResourcesNodes: [],
          keyPartnershipsNodes: [],
          costStructureNodes: [],
          agentAvatars: [],
          conflicts: [],
          edges: []
        },
        { streamMode: 'updates' }
      )

      // 5. 逐节点推送更新
      for await (const update of stream) {
        const entries = Object.entries(update as Record<string, Record<string, unknown>>)

        for (const [nodeName, payload] of entries) {
          // Debug log (commented out for production)
          // console.log('business-langgraph.nodeUpdate', { nodeName, payload })

          // Router Agent
          if (nodeName === 'routerAgent' && payload.intent) {
            const intent = payload.intent as Intent
            yield {
              type: 'delta',
              delta: builder.addInsightNode(
                '意图识别',
                `**用户意图**: ${intent.intent}\n\n**分析**: ${intent.reasoning}`
              )
            }
          }

          const domainHandler = domainNodeHandlers.find((handler) => handler.nodeName === nodeName)
          if (domainHandler) {
            const nodes = payload[domainHandler.key] as MacraNodeData[] | undefined
            if (nodes) {
              for (const node of nodes) {
                yield { type: 'delta', delta: builder.addMacraNode(node) }
              }
            }
          }

          // Orchestrator
          if (nodeName === 'orchestrator') {
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
          }

          // Critic
          if (nodeName === 'critic' && payload.conflicts) {
            const conflicts = payload.conflicts as MacraNodeData[]
            for (const conflict of conflicts) {
              yield { type: 'delta', delta: builder.addMacraNode(conflict) }
            }
          }
        }
      }

      yield { type: 'status', status: 'completed' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      auditLogger.error({
        action: 'business-langgraph.streamConversation',
        metadata: { error: message }
      })
      yield {
        type: 'delta',
        delta: builder.addInsightNode('执行失败', `错误信息：${message}`)
      }
      yield { type: 'status', status: 'failed', message }
    }
  }

  private createGraph() {
    return new StateGraph(BusinessState)
      .addNode('routerAgent', async (state) => this.routeIntent(state))
      .addNode('customerSegmentsAgent', async (state) => this.runCustomerSegmentsAgent(state))
      .addNode('customerRelationshipsAgent', async (state) => this.runCustomerRelationshipsAgent(state))
      .addNode('channelsAgent', async (state) => this.runChannelsAgent(state))
      .addNode('valuePropositionsAgent', async (state) => this.runValuePropositionsAgent(state))
      .addNode('revenueStreamsAgent', async (state) => this.runRevenueStreamsAgent(state))
      .addNode('keyActivitiesAgent', async (state) => this.runKeyActivitiesAgent(state))
      .addNode('keyResourcesAgent', async (state) => this.runKeyResourcesAgent(state))
      .addNode('keyPartnershipsAgent', async (state) => this.runKeyPartnershipsAgent(state))
      .addNode('costStructureAgent', async (state) => this.runCostStructureAgent(state))
      .addNode('orchestrator', async (state) => this.orchestrate(state))
      .addNode('critic', async (state) => this.runCritic(state))
      .addEdge(START, 'routerAgent')
      .addConditionalEdges('routerAgent', (state) => {
        const intent = state.intent?.intent || 'general'
        if (intent === 'generate_bmc') {
          return [
            'customerSegmentsAgent',
            'customerRelationshipsAgent',
            'channelsAgent',
            'valuePropositionsAgent',
            'revenueStreamsAgent',
            'keyActivitiesAgent',
            'keyResourcesAgent',
            'keyPartnershipsAgent',
            'costStructureAgent'
          ]
        }
        if (intent === 'detect_conflicts') {
          return ['critic']
        }
        return ['orchestrator']
      })
      .addEdge(
        [
          'customerSegmentsAgent',
          'customerRelationshipsAgent',
          'channelsAgent',
          'valuePropositionsAgent',
          'revenueStreamsAgent',
          'keyActivitiesAgent',
          'keyResourcesAgent',
          'keyPartnershipsAgent',
          'costStructureAgent'
        ],
        'orchestrator'
      )
      .addEdge('orchestrator', 'critic')
      .addEdge('critic', END)
      .compile()
  }

  // ============== Agent Nodes ==============

  private async routeIntent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) {
      return { intent: { intent: 'general', reasoning: 'LLM not configured' } }
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
      const result = await structured.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      return { intent: result }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.routeIntent',
        metadata: { error: String(error) }
      })
      return { intent: { intent: 'generate_bmc', reasoning: 'Failed to classify intent, defaulting to generate_bmc' } }
    }
  }

  private async buildDomainNodes(options: {
    state: BusinessStateType
    prompt: string
    agentName: string
    domain: CCBMCDomain
    idPrefix: string
    agentType: AgentType
  }): Promise<MacraNodeData[]> {
    if (!this.model) return []

    try {
      const response = await this.model.invoke([new SystemMessage(options.prompt), new HumanMessage(options.state.question)])
      const content = response.content as string
      const nodes = extractAndParseJSON(content, options.agentName)

      if (nodes.length === 0) {
        return []
      }

      return nodes.map((node) => ({
        ...node,
        id: `${options.idPrefix}-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: options.domain,
        metadata: {
          ...node.metadata,
          agent_signature: options.agentType
        }
      }))
    } catch (error) {
      auditLogger.error({
        action: `business-langgraph.${options.agentName}`,
        metadata: { error: String(error) }
      })
      return []
    }
  }

  private async runCustomerSegmentsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Customer_Segments_Agent（客户细分专家），负责生成 CC-BMC 商业模型画布中的维度：

**客户细分**：目标客户群体、用户画像、市场规模。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 customer-segments-xxxxx）
- type: "cc-bmc-card"
- domain: "客户细分"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "Customer_Segments_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runCustomerSegmentsAgent',
      domain: CC_BMC_DOMAINS.CUSTOMER_SEGMENTS,
      idPrefix: 'customer-segments',
      agentType: AGENT_TYPES.CUSTOMER_SEGMENTS
    })

    return { customerSegmentsNodes: nodes }
  }

  private async runCustomerRelationshipsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Customer_Relationships_Agent（客户关系专家），负责生成 CC-BMC 商业模型画布中的维度：

**客户关系**：客户互动方式、服务模式、用户粘性。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 customer-relationships-xxxxx）
- type: "cc-bmc-card"
- domain: "客户关系"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含服务策略与建议）
- metadata: { agent_signature: "Customer_Relationships_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runCustomerRelationshipsAgent',
      domain: CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS,
      idPrefix: 'customer-relationships',
      agentType: AGENT_TYPES.CUSTOMER_RELATIONSHIPS
    })

    return { customerRelationshipsNodes: nodes }
  }

  private async runChannelsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Channels_Agent（渠道通路专家），负责生成 CC-BMC 商业模型画布中的维度：

**渠道通路**：触达方式、线上/线下渠道、分发策略。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 channels-xxxxx）
- type: "cc-bmc-card"
- domain: "渠道通路"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含触达策略与建议）
- metadata: { agent_signature: "Channels_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runChannelsAgent',
      domain: CC_BMC_DOMAINS.CHANNELS,
      idPrefix: 'channels',
      agentType: AGENT_TYPES.CHANNELS
    })

    return { channelsNodes: nodes }
  }

  private async runValuePropositionsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Value_Propositions_Agent（价值主张专家），负责生成 CC-BMC 商业模型画布中的维度：

**价值主张**：核心价值、差异化优势、解决的痛点。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 value-propositions-xxxxx）
- type: "cc-bmc-card"
- domain: "价值主张"
- label: 简短标题（10 字以内）
- content: 简洁分析（Markdown 格式，包含 3-5 个要点）
- metadata: { agent_signature: "Value_Propositions_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runValuePropositionsAgent',
      domain: CC_BMC_DOMAINS.VALUE_PROPOSITIONS,
      idPrefix: 'value-propositions',
      agentType: AGENT_TYPES.VALUE_PROPOSITIONS
    })

    return { valuePropositionsNodes: nodes }
  }

  private async runRevenueStreamsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Revenue_Streams_Agent（收入来源专家），负责生成 CC-BMC 商业模型画布中的维度：

**收入来源**：商业模式、定价策略、收入结构。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 revenue-streams-xxxxx）
- type: "cc-bmc-card"
- domain: "收入来源"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "Revenue_Streams_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runRevenueStreamsAgent',
      domain: CC_BMC_DOMAINS.REVENUE_STREAMS,
      idPrefix: 'revenue-streams',
      agentType: AGENT_TYPES.REVENUE_STREAMS
    })

    return { revenueStreamsNodes: nodes }
  }

  private async runKeyActivitiesAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Key_Activities_Agent（关键业务专家），负责生成 CC-BMC 商业模型画布中的维度：

**关键业务**：核心活动、业务流程、运营重点。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 key-activities-xxxxx）
- type: "cc-bmc-card"
- domain: "关键业务"
- label: 简短标题（10 字以内）
- content: 简洁分析（Markdown 格式，包含 3-5 个要点）
- metadata: { agent_signature: "Key_Activities_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runKeyActivitiesAgent',
      domain: CC_BMC_DOMAINS.KEY_ACTIVITIES,
      idPrefix: 'key-activities',
      agentType: AGENT_TYPES.KEY_ACTIVITIES
    })

    return { keyActivitiesNodes: nodes }
  }

  private async runKeyResourcesAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Key_Resources_Agent（核心资源专家），负责生成 CC-BMC 商业模型画布中的维度：

**核心资源**：关键资产、技术能力、人才团队。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 key-resources-xxxxx）
- type: "cc-bmc-card"
- domain: "核心资源"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含资源构成与优势）
- metadata: { agent_signature: "Key_Resources_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runKeyResourcesAgent',
      domain: CC_BMC_DOMAINS.KEY_RESOURCES,
      idPrefix: 'key-resources',
      agentType: AGENT_TYPES.KEY_RESOURCES
    })

    return { keyResourcesNodes: nodes }
  }

  private async runKeyPartnershipsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Key_Partnerships_Agent（重要合作专家），负责生成 CC-BMC 商业模型画布中的维度：

**重要合作**：关键合作伙伴、合作价值、协作关系。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 key-partnerships-xxxxx）
- type: "cc-bmc-card"
- domain: "重要合作"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含合作策略与价值）
- metadata: { agent_signature: "Key_Partnerships_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runKeyPartnershipsAgent',
      domain: CC_BMC_DOMAINS.KEY_PARTNERSHIPS,
      idPrefix: 'key-partnerships',
      agentType: AGENT_TYPES.KEY_PARTNERSHIPS
    })

    return { keyPartnershipsNodes: nodes }
  }

  private async runCostStructureAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const prompt = `你是 Cost_Structure_Agent（成本结构专家），负责生成 CC-BMC 商业模型画布中的维度：

**成本结构**：主要成本、成本控制、盈利能力。

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 cost-structure-xxxxx）
- type: "cc-bmc-card"
- domain: "成本结构"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含成本结构与建议）
- metadata: { agent_signature: "Cost_Structure_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1", "标签2"] }
`

    const nodes = await this.buildDomainNodes({
      state,
      prompt,
      agentName: 'runCostStructureAgent',
      domain: CC_BMC_DOMAINS.COST_STRUCTURE,
      idPrefix: 'cost-structure',
      agentType: AGENT_TYPES.COST_STRUCTURE
    })

    return { costStructureNodes: nodes }
  }

  private getAllDomainNodes(state: BusinessStateType) {
    return [
      ...state.customerSegmentsNodes,
      ...state.customerRelationshipsNodes,
      ...state.channelsNodes,
      ...state.valuePropositionsNodes,
      ...state.revenueStreamsNodes,
      ...state.keyActivitiesNodes,
      ...state.keyResourcesNodes,
      ...state.keyPartnershipsNodes,
      ...state.costStructureNodes
    ]
  }

  private async orchestrate(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    // 1. 生成 Agent Avatar 节点
    const agentAvatars: MacraNodeData[] = []
    const avatarConfigs = [
      {
        nodes: state.customerSegmentsNodes,
        idPrefix: 'avatar-customer-segments',
        label: '客户细分专家',
        domainLabel: CC_BMC_DOMAINS.CUSTOMER_SEGMENTS,
        agentType: AGENT_TYPES.CUSTOMER_SEGMENTS
      },
      {
        nodes: state.customerRelationshipsNodes,
        idPrefix: 'avatar-customer-relationships',
        label: '客户关系专家',
        domainLabel: CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS,
        agentType: AGENT_TYPES.CUSTOMER_RELATIONSHIPS
      },
      {
        nodes: state.channelsNodes,
        idPrefix: 'avatar-channels',
        label: '渠道通路专家',
        domainLabel: CC_BMC_DOMAINS.CHANNELS,
        agentType: AGENT_TYPES.CHANNELS
      },
      {
        nodes: state.valuePropositionsNodes,
        idPrefix: 'avatar-value-propositions',
        label: '价值主张专家',
        domainLabel: CC_BMC_DOMAINS.VALUE_PROPOSITIONS,
        agentType: AGENT_TYPES.VALUE_PROPOSITIONS
      },
      {
        nodes: state.revenueStreamsNodes,
        idPrefix: 'avatar-revenue-streams',
        label: '收入来源专家',
        domainLabel: CC_BMC_DOMAINS.REVENUE_STREAMS,
        agentType: AGENT_TYPES.REVENUE_STREAMS
      },
      {
        nodes: state.keyActivitiesNodes,
        idPrefix: 'avatar-key-activities',
        label: '关键业务专家',
        domainLabel: CC_BMC_DOMAINS.KEY_ACTIVITIES,
        agentType: AGENT_TYPES.KEY_ACTIVITIES
      },
      {
        nodes: state.keyResourcesNodes,
        idPrefix: 'avatar-key-resources',
        label: '核心资源专家',
        domainLabel: CC_BMC_DOMAINS.KEY_RESOURCES,
        agentType: AGENT_TYPES.KEY_RESOURCES
      },
      {
        nodes: state.keyPartnershipsNodes,
        idPrefix: 'avatar-key-partnerships',
        label: '重要合作专家',
        domainLabel: CC_BMC_DOMAINS.KEY_PARTNERSHIPS,
        agentType: AGENT_TYPES.KEY_PARTNERSHIPS
      },
      {
        nodes: state.costStructureNodes,
        idPrefix: 'avatar-cost-structure',
        label: '成本结构专家',
        domainLabel: CC_BMC_DOMAINS.COST_STRUCTURE,
        agentType: AGENT_TYPES.COST_STRUCTURE
      }
    ]

    for (const config of avatarConfigs) {
      if (config.nodes.length === 0) continue
      agentAvatars.push({
        id: `${config.idPrefix}-${nanoid(8)}`,
        type: 'agent-avatar',
        label: config.label,
        content: `我已为你分析了${config.domainLabel}维度。\n\n**核心洞察**：${config.nodes[0]?.label || config.domainLabel}`,
        agentType: config.agentType,
        isInteractive: true,
        metadata: {
          agent_signature: config.agentType,
          confidence: 'high'
        }
      })
    }

    // 2. 生成边（连接关系）- 完整的 CC-BMC 逻辑连接
    const edges: CanvasEdge[] = []
    const allNodes = this.getAllDomainNodes(state)

    // 辅助函数：查找节点
    const findNode = (domain: string) => allNodes.find((n) => n.domain === domain)

    // CC-BMC 九大维度的逻辑连接
    const valueProp = findNode('价值主张')
    const customerSeg = findNode('客户细分')
    const channels = findNode('渠道通路')
    const customerRel = findNode('客户关系')
    const revenue = findNode('收入来源')
    const keyRes = findNode('核心资源')
    const keyAct = findNode('关键业务')
    const keyPart = findNode('重要合作')
    const cost = findNode('成本结构')

    // 1. 价值主张 → 客户细分（核心连接）
    if (valueProp && customerSeg) {
      edges.push({
        id: `${valueProp.id}->${customerSeg.id}`,
        source: valueProp.id,
        target: customerSeg.id,
        label: '服务于'
      })
    }

    // 2. 渠道通路 → 客户细分
    if (channels && customerSeg) {
      edges.push({
        id: `${channels.id}->${customerSeg.id}`,
        source: channels.id,
        target: customerSeg.id,
        label: '触达'
      })
    }

    // 3. 客户关系 → 客户细分
    if (customerRel && customerSeg) {
      edges.push({
        id: `${customerRel.id}->${customerSeg.id}`,
        source: customerRel.id,
        target: customerSeg.id,
        label: '维系'
      })
    }

    // 4. 核心资源 → 价值主张
    if (keyRes && valueProp) {
      edges.push({
        id: `${keyRes.id}->${valueProp.id}`,
        source: keyRes.id,
        target: valueProp.id,
        label: '支撑'
      })
    }

    // 5. 关键业务 → 价值主张
    if (keyAct && valueProp) {
      edges.push({
        id: `${keyAct.id}->${valueProp.id}`,
        source: keyAct.id,
        target: valueProp.id,
        label: '创造'
      })
    }

    // 6. 客户细分 → 收入来源
    if (customerSeg && revenue) {
      edges.push({
        id: `${customerSeg.id}->${revenue.id}`,
        source: customerSeg.id,
        target: revenue.id,
        label: '带来'
      })
    }

    // 7. 核心资源 → 成本结构
    if (keyRes && cost) {
      edges.push({
        id: `${keyRes.id}->${cost.id}`,
        source: keyRes.id,
        target: cost.id,
        label: '产生'
      })
    }

    // 8. 关键业务 → 成本结构
    if (keyAct && cost) {
      edges.push({
        id: `${keyAct.id}->${cost.id}`,
        source: keyAct.id,
        target: cost.id,
        label: '产生'
      })
    }

    // 9. 重要合作 → 核心资源（如果存在）
    if (keyPart && keyRes) {
      edges.push({
        id: `${keyPart.id}->${keyRes.id}`,
        source: keyPart.id,
        target: keyRes.id,
        label: '提供'
      })
    }

    return { agentAvatars, edges }
  }

  private async runCritic(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    // 简化版 Critic：检查是否有明显矛盾
    // 未来可以调用 LLM 进行深度分析
    const conflicts: MacraNodeData[] = []

    const allNodes = this.getAllDomainNodes(state)

    // 示例：检查是否同时提到"高端市场"和"低价策略"
    const hasHighEnd = allNodes.some((n) => typeof n.content === 'string' && (n.content.includes('高端') || n.content.includes('中产')))
    const hasLowPrice = allNodes.some((n) => typeof n.content === 'string' && (n.content.includes('低价') || n.content.includes('降价')))

    if (hasHighEnd && hasLowPrice) {
      conflicts.push({
        id: `conflict-${nanoid(8)}`,
        type: 'conflict-alert',
        label: '定价策略冲突',
        content: `**冲突类型**：channel-product\n\n**原因**：目标客户定位高端市场，但定价策略倾向低价，存在逻辑矛盾。\n\n**建议**：重新审视定价策略，确保与目标客户群体匹配。`,
        severity: 'high',
        conflictType: 'channel-product',
        metadata: {
          agent_signature: AGENT_TYPES.CRITIC,
          confidence: 'medium'
        }
      })
    }

    return { conflicts }
  }
}

// ============== Canvas Builder（管理节点和边） ==============
class BusinessCanvasBuilder {
  private readonly nodes = new Map<string, CanvasNode>()
  private readonly edges = new Map<string, CanvasEdge>()
  private readonly rootId: string
  private nextY = ROOT_POSITION.y + NODE_SPACING

  constructor(
    private readonly workspaceId: string,
    private readonly userId: string,
    private readonly question: string
  ) {
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
        footerText: 'Multi-Agent 协作生成 · MACRA 系统',
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
    // 将 MacraNodeData 转换为 CanvasNode
    const node: CanvasNode = {
      id: macraNode.id,
      type: 'note', // ReactFlow 的通用类型，前端会根据 data 渲染具体组件
      position: { x: ROOT_POSITION.x, y: this.nextY },
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
    this.nextY += NODE_SPACING

    return { nodes: [node] }
  }

  addInsightNode(title: string, content: string): GraphDelta {
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
            confidence: 'high'
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
    // - 移除尾部多余逗号（如 [1,2,]）
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')
    // - 替换单引号为双引号（仅在键名和字符串值中）
    // 注意：这是简化处理，更严格的做法需要完整的 JSON parser

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

function createLLMModel() {
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
    maxTokens: 4000,  // 增加 token 限制，确保能返回完整的 JSON
    configuration
  })
}

const ROOT_POSITION = { x: 160, y: 160 }
const NODE_SPACING = 220
