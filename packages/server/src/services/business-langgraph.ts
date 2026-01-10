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
  CUSTOMER_SEGMENTS: 'CustomerSegment_Agent',
  CUSTOMER_RELATIONSHIPS: 'CustomerRelationship_Agent',
  CHANNELS: 'Channels_Agent',
  VALUE_PROPOSITIONS: 'ValueProposition_Agent',
  REVENUE_STREAMS: 'RevenueStream_Agent',
  KEY_ACTIVITIES: 'KeyActivity_Agent',
  KEY_RESOURCES: 'KeyResource_Agent',
  KEY_PARTNERSHIPS: 'KeyPartnership_Agent',
  COST_STRUCTURE: 'CostStructure_Agent',
  MARKET: 'Market_Agent',
  PRODUCT: 'Product_Agent',
  FINANCE: 'Finance_Agent',
  COMPLIANCE: 'Compliance_Agent',
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
    tags: z.array(z.string()).optional(),
    cultural_context: z.string().optional()
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

const CULTURAL_REQUIREMENTS = `跨文化约束：在分析时必须考虑地区差异、文化禁忌、用户群体差异；输出必须包含“文化假设/适配地域”字段，可放在 metadata.cultural_context（推荐）或 metadata.tags 中。`

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

          // Customer Segments Agent
          if (nodeName === 'customerSegmentsAgent' && payload.customerSegmentsNodes) {
            const nodes = payload.customerSegmentsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Customer Relationships Agent
          if (nodeName === 'customerRelationshipsAgent' && payload.customerRelationshipsNodes) {
            const nodes = payload.customerRelationshipsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Channels Agent
          if (nodeName === 'channelsAgent' && payload.channelsNodes) {
            const nodes = payload.channelsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Value Propositions Agent
          if (nodeName === 'valuePropositionsAgent' && payload.valuePropositionsNodes) {
            const nodes = payload.valuePropositionsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Revenue Streams Agent
          if (nodeName === 'revenueStreamsAgent' && payload.revenueStreamsNodes) {
            const nodes = payload.revenueStreamsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Key Activities Agent
          if (nodeName === 'keyActivitiesAgent' && payload.keyActivitiesNodes) {
            const nodes = payload.keyActivitiesNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Key Resources Agent
          if (nodeName === 'keyResourcesAgent' && payload.keyResourcesNodes) {
            const nodes = payload.keyResourcesNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Key Partnerships Agent
          if (nodeName === 'keyPartnershipsAgent' && payload.keyPartnershipsNodes) {
            const nodes = payload.keyPartnershipsNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Cost Structure Agent
          if (nodeName === 'costStructureAgent' && payload.costStructureNodes) {
            const nodes = payload.costStructureNodes as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
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

  private async runCustomerSegmentsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { customerSegmentsNodes: [] }

    const prompt = `你是 CustomerSegment_Agent（客户细分专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **客户细分** (CUSTOMER_SEGMENTS)：目标客户群体、用户画像、市场规模

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 customer-segment-xxxxx）
- type: "cc-bmc-card"
- domain: "客户细分"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "CustomerSegment_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "customer-segment-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "客户细分",
    "label": "目标客户群体",
    "content": "## 核心客户\\n1. **城市中产家庭** (35-50岁)\\n   - 环保意识强\\n   - 占比 45%\\n2. **商用车队运营商**\\n   - 注重 TCO\\n   - 占比 30%",
    "metadata": {
      "agent_signature": "CustomerSegment_Agent",
      "confidence": "high",
      "source": "基于中汽协 2024 年度报告",
      "tags": ["B2C"],
      "cultural_context": "面向中国一线城市家庭"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCustomerSegmentsAgent'), 'runCustomerSegmentsAgent')

      if (nodes.length === 0) {
        return { customerSegmentsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `customer-segment-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.CUSTOMER_SEGMENTS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.CUSTOMER_SEGMENTS
        }
      }))

      return { customerSegmentsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCustomerSegmentsAgent',
        metadata: { error: String(error) }
      })
      return { customerSegmentsNodes: [] }
    }
  }

  private async runCustomerRelationshipsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { customerRelationshipsNodes: [] }

    const prompt = `你是 CustomerRelationship_Agent（客户关系专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **客户关系** (CUSTOMER_RELATIONSHIPS)：如何维系客户、服务模式、用户粘性

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 customer-relationship-xxxxx）
- type: "cc-bmc-card"
- domain: "客户关系"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含服务模式、用户触点、维系策略）
- metadata: { agent_signature: "CustomerRelationship_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "customer-relationship-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "客户关系",
    "label": "社区式运营",
    "content": "## 维系方式\\n- 社群共创\\n- 专属客服\\n- 长期会员计划",
    "metadata": {
      "agent_signature": "CustomerRelationship_Agent",
      "confidence": "high",
      "source": "行业最佳实践",
      "tags": ["社区"],
      "cultural_context": "亚洲市场重视人情与社群归属"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCustomerRelationshipsAgent'), 'runCustomerRelationshipsAgent')

      if (nodes.length === 0) {
        return { customerRelationshipsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `customer-relationship-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.CUSTOMER_RELATIONSHIPS
        }
      }))

      return { customerRelationshipsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCustomerRelationshipsAgent',
        metadata: { error: String(error) }
      })
      return { customerRelationshipsNodes: [] }
    }
  }

  private async runChannelsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { channelsNodes: [] }

    const prompt = `你是 Channels_Agent（渠道通路专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **渠道通路** (CHANNELS)：如何触达客户、线上/线下渠道、分发策略

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 channels-xxxxx）
- type: "cc-bmc-card"
- domain: "渠道通路"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含触达方式、渠道组合、落地策略）
- metadata: { agent_signature: "Channels_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "channels-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "渠道通路",
    "label": "线上直销",
    "content": "## 触达策略\\n- 官方网站直销\\n- 社媒推广\\n- 体验中心引流",
    "metadata": {
      "agent_signature": "Channels_Agent",
      "confidence": "high",
      "source": "渠道调研",
      "tags": ["D2C"],
      "cultural_context": "欧美用户偏好线上自助下单"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runChannelsAgent'), 'runChannelsAgent')

      if (nodes.length === 0) {
        return { channelsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `channels-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.CHANNELS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.CHANNELS
        }
      }))

      return { channelsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runChannelsAgent',
        metadata: { error: String(error) }
      })
      return { channelsNodes: [] }
    }
  }

  private async runValuePropositionsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { valuePropositionsNodes: [] }

    const prompt = `你是 ValueProposition_Agent（价值主张专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **价值主张** (VALUE_PROPOSITIONS)：核心价值、差异化优势、解决的痛点

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 value-proposition-xxxxx）
- type: "cc-bmc-card"
- domain: "价值主张"
- label: 简短标题（5-8 字）
- content: 简洁分析（Markdown 格式，3-5 个要点，每个要点 1 行，总计 100 字以内）
- metadata: { agent_signature: "ValueProposition_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

**重要**：content 必须简洁，避免过长描述。

示例：
[
  {
    "id": "value-proposition-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "价值主张",
    "label": "智能驾驶",
    "content": "## 核心价值\\n- L2+ 自动驾驶\\n- OTA 升级\\n- 零排放低成本",
    "metadata": {
      "agent_signature": "ValueProposition_Agent",
      "confidence": "high",
      "source": "行业报告",
      "tags": ["科技"],
      "cultural_context": "北美市场重视安全与便利"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runValuePropositionsAgent'), 'runValuePropositionsAgent')

      if (nodes.length === 0) {
        return { valuePropositionsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `value-proposition-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.VALUE_PROPOSITIONS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.VALUE_PROPOSITIONS
        }
      }))

      return { valuePropositionsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runValuePropositionsAgent',
        metadata: { error: String(error) }
      })
      return { valuePropositionsNodes: [] }
    }
  }

  private async runRevenueStreamsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { revenueStreamsNodes: [] }

    const prompt = `你是 RevenueStream_Agent（收入来源专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **收入来源** (REVENUE_STREAMS)：商业模式、定价策略、收入结构

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 revenue-stream-xxxxx）
- type: "cc-bmc-card"
- domain: "收入来源"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "RevenueStream_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "revenue-stream-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "收入来源",
    "label": "订阅式收入",
    "content": "## 收入结构\\n- 月度订阅\\n- 增值服务\\n- 合作分成",
    "metadata": {
      "agent_signature": "RevenueStream_Agent",
      "confidence": "high",
      "source": "财报数据",
      "tags": ["订阅"],
      "cultural_context": "东南亚市场偏好灵活付费"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runRevenueStreamsAgent'), 'runRevenueStreamsAgent')

      if (nodes.length === 0) {
        return { revenueStreamsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `revenue-stream-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.REVENUE_STREAMS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.REVENUE_STREAMS
        }
      }))

      return { revenueStreamsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runRevenueStreamsAgent',
        metadata: { error: String(error) }
      })
      return { revenueStreamsNodes: [] }
    }
  }

  private async runKeyActivitiesAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { keyActivitiesNodes: [] }

    const prompt = `你是 KeyActivity_Agent（关键业务专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **关键业务** (KEY_ACTIVITIES)：核心活动、业务流程、运营重点

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 key-activity-xxxxx）
- type: "cc-bmc-card"
- domain: "关键业务"
- label: 简短标题（10 字以内）
- content: 简洁分析（Markdown 格式，3-5 个要点，每个要点 1 行，总计 100 字以内）
- metadata: { agent_signature: "KeyActivity_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "key-activity-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "关键业务",
    "label": "供应链协同",
    "content": "## 核心活动\\n- 供应链整合\\n- 质量管控\\n- 交付保障",
    "metadata": {
      "agent_signature": "KeyActivity_Agent",
      "confidence": "high",
      "source": "运营分析",
      "tags": ["流程"],
      "cultural_context": "日本市场强调准时交付"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runKeyActivitiesAgent'), 'runKeyActivitiesAgent')

      if (nodes.length === 0) {
        return { keyActivitiesNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `key-activity-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.KEY_ACTIVITIES,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.KEY_ACTIVITIES
        }
      }))

      return { keyActivitiesNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runKeyActivitiesAgent',
        metadata: { error: String(error) }
      })
      return { keyActivitiesNodes: [] }
    }
  }

  private async runKeyResourcesAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { keyResourcesNodes: [] }

    const prompt = `你是 KeyResource_Agent（核心资源专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **核心资源** (KEY_RESOURCES)：关键资产、技术能力、人才团队

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 key-resource-xxxxx）
- type: "cc-bmc-card"
- domain: "核心资源"
- label: 简短标题（10 字以内）
- content: 简洁分析（Markdown 格式，3-5 个要点，每个要点 1 行，总计 100 字以内）
- metadata: { agent_signature: "KeyResource_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "key-resource-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "核心资源",
    "label": "研发团队",
    "content": "## 核心资产\\n- 算法团队\\n- 专利储备\\n- 本地合作伙伴",
    "metadata": {
      "agent_signature": "KeyResource_Agent",
      "confidence": "high",
      "source": "内部评估",
      "tags": ["人才"],
      "cultural_context": "欧盟市场强调合规与隐私"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runKeyResourcesAgent'), 'runKeyResourcesAgent')

      if (nodes.length === 0) {
        return { keyResourcesNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `key-resource-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.KEY_RESOURCES,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.KEY_RESOURCES
        }
      }))

      return { keyResourcesNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runKeyResourcesAgent',
        metadata: { error: String(error) }
      })
      return { keyResourcesNodes: [] }
    }
  }

  private async runKeyPartnershipsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { keyPartnershipsNodes: [] }

    const prompt = `你是 KeyPartnership_Agent（重要合作专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **重要合作** (KEY_PARTNERSHIPS)：战略伙伴、供应商、渠道合作

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 key-partnership-xxxxx）
- type: "cc-bmc-card"
- domain: "重要合作"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含合作类型、价值互补、风险）
- metadata: { agent_signature: "KeyPartnership_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "key-partnership-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "重要合作",
    "label": "产业联盟",
    "content": "## 合作伙伴\\n- 本地运营商\\n- 充电基础设施商\\n- 政府合作项目",
    "metadata": {
      "agent_signature": "KeyPartnership_Agent",
      "confidence": "high",
      "source": "战略调研",
      "tags": ["合作"],
      "cultural_context": "中东市场强调政府合作与信誉背书"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runKeyPartnershipsAgent'), 'runKeyPartnershipsAgent')

      if (nodes.length === 0) {
        return { keyPartnershipsNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `key-partnership-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.KEY_PARTNERSHIPS,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.KEY_PARTNERSHIPS
        }
      }))

      return { keyPartnershipsNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runKeyPartnershipsAgent',
        metadata: { error: String(error) }
      })
      return { keyPartnershipsNodes: [] }
    }
  }

  private async runCostStructureAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { costStructureNodes: [] }

    const prompt = `你是 CostStructure_Agent（成本结构专家），负责生成 CC-BMC 商业模型画布中的一个维度：

1. **成本结构** (COST_STRUCTURE)：主要成本、成本控制、盈利能力

${CULTURAL_REQUIREMENTS}

用户问题：${state.question}

请生成 1 个 cc-bmc-card 节点（JSON 数组格式，仅 1 项），包含：
- id: 自动生成（格式 cost-structure-xxxxx）
- type: "cc-bmc-card"
- domain: "成本结构"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含成本构成、成本优化建议）
- metadata: { agent_signature: "CostStructure_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签1"], cultural_context: "文化假设/适配地域" }

示例：
[
  {
    "id": "cost-structure-${nanoid(8)}",
    "type": "cc-bmc-card",
    "domain": "成本结构",
    "label": "规模化降本",
    "content": "## 成本结构\\n- 原材料采购\\n- 生产制造\\n- 渠道获客",
    "metadata": {
      "agent_signature": "CostStructure_Agent",
      "confidence": "high",
      "source": "成本模型",
      "tags": ["成本"],
      "cultural_context": "拉美市场更敏感于价格波动"
    }
  }
]
`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCostStructureAgent'), 'runCostStructureAgent')

      if (nodes.length === 0) {
        return { costStructureNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `cost-structure-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        domain: CC_BMC_DOMAINS.COST_STRUCTURE,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.COST_STRUCTURE
        }
      }))

      return { costStructureNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCostStructureAgent',
        metadata: { error: String(error) }
      })
      return { costStructureNodes: [] }
    }
  }

  private async orchestrate(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    // 1. 生成 Agent Avatar 节点
    const agentAvatars: MacraNodeData[] = []

    const avatarConfigs = [
      {
        nodes: state.customerSegmentsNodes,
        label: '客户细分专家',
        summary: '客户细分',
        agentType: AGENT_TYPES.CUSTOMER_SEGMENTS,
        idPrefix: 'customer-segment'
      },
      {
        nodes: state.customerRelationshipsNodes,
        label: '客户关系专家',
        summary: '客户关系',
        agentType: AGENT_TYPES.CUSTOMER_RELATIONSHIPS,
        idPrefix: 'customer-relationship'
      },
      {
        nodes: state.channelsNodes,
        label: '渠道通路专家',
        summary: '渠道通路',
        agentType: AGENT_TYPES.CHANNELS,
        idPrefix: 'channels'
      },
      {
        nodes: state.valuePropositionsNodes,
        label: '价值主张专家',
        summary: '价值主张',
        agentType: AGENT_TYPES.VALUE_PROPOSITIONS,
        idPrefix: 'value-proposition'
      },
      {
        nodes: state.revenueStreamsNodes,
        label: '收入来源专家',
        summary: '收入来源',
        agentType: AGENT_TYPES.REVENUE_STREAMS,
        idPrefix: 'revenue-stream'
      },
      {
        nodes: state.keyActivitiesNodes,
        label: '关键业务专家',
        summary: '关键业务',
        agentType: AGENT_TYPES.KEY_ACTIVITIES,
        idPrefix: 'key-activity'
      },
      {
        nodes: state.keyResourcesNodes,
        label: '核心资源专家',
        summary: '核心资源',
        agentType: AGENT_TYPES.KEY_RESOURCES,
        idPrefix: 'key-resource'
      },
      {
        nodes: state.keyPartnershipsNodes,
        label: '重要合作专家',
        summary: '重要合作',
        agentType: AGENT_TYPES.KEY_PARTNERSHIPS,
        idPrefix: 'key-partnership'
      },
      {
        nodes: state.costStructureNodes,
        label: '成本结构专家',
        summary: '成本结构',
        agentType: AGENT_TYPES.COST_STRUCTURE,
        idPrefix: 'cost-structure'
      }
    ]

    for (const config of avatarConfigs) {
      if (config.nodes.length > 0) {
        agentAvatars.push({
          id: `avatar-${config.idPrefix}-${nanoid(8)}`,
          type: 'agent-avatar',
          label: config.label,
          content: `我已为你分析了${config.summary}维度。\n\n**核心洞察**：${config.nodes[0]?.label || config.summary}`,
          agentType: config.agentType,
          isInteractive: true,
          metadata: {
            agent_signature: config.agentType,
            confidence: 'high'
          }
        })
      }
    }

    // 2. 生成边（连接关系）- 完整的 CC-BMC 逻辑连接
    const edges: CanvasEdge[] = []
    const allNodes = [
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

    const allNodes = [
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
function normalizeSingleNode(nodes: MacraNodeData[], agentName: string): MacraNodeData[] {
  if (nodes.length > 1) {
    auditLogger.warn({
      action: `business-langgraph.${agentName}.normalizeSingleNode`,
      metadata: { message: 'Multiple nodes returned; trimming to first', count: nodes.length }
    })
  }
  return nodes.slice(0, 1)
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
