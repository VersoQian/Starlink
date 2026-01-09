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
  marketNodes: Annotation<MacraNodeData[]>(),
  productNodes: Annotation<MacraNodeData[]>(),
  financeNodes: Annotation<MacraNodeData[]>(),
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
          marketNodes: [],
          productNodes: [],
          financeNodes: [],
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
      .addNode('marketAgent', async (state) => this.runMarketAgent(state))
      .addNode('productAgent', async (state) => this.runProductAgent(state))
      .addNode('financeAgent', async (state) => this.runFinanceAgent(state))
      .addNode('orchestrator', async (state) => this.orchestrate(state))
      .addNode('critic', async (state) => this.runCritic(state))
      .addEdge(START, 'routerAgent')
      .addConditionalEdges('routerAgent', (state) => {
        const intent = state.intent?.intent || 'general'
        if (intent === 'generate_bmc') {
          return ['marketAgent', 'productAgent', 'financeAgent']
        }
        if (intent === 'detect_conflicts') {
          return ['critic']
        }
        return ['orchestrator']
      })
      .addEdge(['marketAgent', 'productAgent', 'financeAgent'], 'orchestrator')
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

  private async runMarketAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { marketNodes: [] }

    const prompt = `你是 Market_Agent（市场分析专家），负责生成 CC-BMC 商业模型画布中的三个维度：

1. **客户细分** (CUSTOMER_SEGMENTS)：目标客户群体、用户画像、市场规模
2. **渠道通路** (CHANNELS)：如何触达客户、线上/线下渠道、分发策略
3. **客户关系** (CUSTOMER_RELATIONSHIPS)：如何维系客户、服务模式、用户粘性

用户问题：${state.question}

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
      const content = response.content as string

      // 使用增强的 JSON 解析函数
      const nodes = extractAndParseJSON(content, 'runMarketAgent')

      if (nodes.length === 0) {
        return { marketNodes: [] }
      }

      // 验证和规范化
      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `market-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.MARKET
        }
      }))

      return { marketNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runMarketAgent',
        metadata: { error: String(error) }
      })
      return { marketNodes: [] }
    }
  }

  private async runProductAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { productNodes: [] }

    const prompt = `你是 Product_Agent（产品策略专家），负责生成 CC-BMC 商业模型画布中的三个维度：

1. **价值主张** (VALUE_PROPOSITIONS)：核心价值、差异化优势、解决的痛点
2. **核心资源** (KEY_RESOURCES)：关键资产、技术能力、人才团队
3. **关键业务** (KEY_ACTIVITIES)：核心活动、业务流程、运营重点

用户问题：${state.question}

请生成 3 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成（格式 product-xxxxx）
- type: "cc-bmc-card"
- domain: "价值主张" | "核心资源" | "关键业务"
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
      const content = response.content as string

      // 使用增强的 JSON 解析函数
      const nodes = extractAndParseJSON(content, 'runProductAgent')

      if (nodes.length === 0) {
        return { productNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `product-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.PRODUCT
        }
      }))

      return { productNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runProductAgent',
        metadata: { error: String(error) }
      })
      return { productNodes: [] }
    }
  }

  private async runFinanceAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { financeNodes: [] }

    const prompt = `你是 Finance_Agent（财务分析专家），负责生成 CC-BMC 商业模型画布中的两个维度：

1. **收入来源** (REVENUE_STREAMS)：商业模式、定价策略、收入结构
2. **成本结构** (COST_STRUCTURE)：主要成本、成本控制、盈利能力

用户问题：${state.question}

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
      const content = response.content as string

      // 使用增强的 JSON 解析函数
      const nodes = extractAndParseJSON(content, 'runFinanceAgent')

      if (nodes.length === 0) {
        return { financeNodes: [] }
      }

      const validatedNodes = nodes.map((node) => ({
        ...node,
        id: `finance-${nanoid(8)}`,
        type: 'cc-bmc-card' as const,
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.FINANCE
        }
      }))

      return { financeNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runFinanceAgent',
        metadata: { error: String(error) }
      })
      return { financeNodes: [] }
    }
  }

  private async orchestrate(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    // 1. 生成 Agent Avatar 节点
    const agentAvatars: MacraNodeData[] = []

    if (state.marketNodes.length > 0) {
      agentAvatars.push({
        id: `avatar-market-${nanoid(8)}`,
        type: 'agent-avatar',
        label: '市场分析专家',
        content: `我已为你分析了目标客户、渠道通路和客户关系三个维度。\n\n**核心洞察**：${state.marketNodes[0]?.label || '市场分析'}`,
        agentType: AGENT_TYPES.MARKET,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.MARKET,
          confidence: 'high'
        }
      })
    }

    if (state.productNodes.length > 0) {
      agentAvatars.push({
        id: `avatar-product-${nanoid(8)}`,
        type: 'agent-avatar',
        label: '产品策略专家',
        content: `我已为你分析了价值主张、核心资源和关键业务。\n\n**核心洞察**：${state.productNodes[0]?.label || '产品策略'}`,
        agentType: AGENT_TYPES.PRODUCT,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.PRODUCT,
          confidence: 'high'
        }
      })
    }

    if (state.financeNodes.length > 0) {
      agentAvatars.push({
        id: `avatar-finance-${nanoid(8)}`,
        type: 'agent-avatar',
        label: '财务分析专家',
        content: `我已为你分析了收入来源和成本结构。\n\n**核心洞察**：${state.financeNodes[0]?.label || '财务分析'}`,
        agentType: AGENT_TYPES.FINANCE,
        isInteractive: true,
        metadata: {
          agent_signature: AGENT_TYPES.FINANCE,
          confidence: 'high'
        }
      })
    }

    // 2. 生成边（连接关系）- 完整的 CC-BMC 逻辑连接
    const edges: CanvasEdge[] = []
    const allNodes = [
      ...state.marketNodes,
      ...state.productNodes,
      ...state.financeNodes
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
      ...state.marketNodes,
      ...state.productNodes,
      ...state.financeNodes
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
