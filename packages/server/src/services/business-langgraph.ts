import { nanoid } from 'nanoid'
import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { createAuditLogger, type CanvasEdge, type CanvasGraph, type CanvasNode } from '@starlink/shared'
import { KnowledgeService, type KnowledgeEvidence } from './knowledge/knowledge-service.js'

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

const CC_BMC_NODE_TYPES = {
  CUSTOMER_SEGMENTS: 'cc-bmc-customer-segments',
  CUSTOMER_RELATIONSHIPS: 'cc-bmc-customer-relationships',
  CHANNELS: 'cc-bmc-channels',
  VALUE_PROPOSITIONS: 'cc-bmc-value-propositions',
  REVENUE_STREAMS: 'cc-bmc-revenue-streams',
  KEY_ACTIVITIES: 'cc-bmc-key-activities',
  KEY_RESOURCES: 'cc-bmc-key-resources',
  KEY_PARTNERSHIPS: 'cc-bmc-key-partnerships',
  COST_STRUCTURE: 'cc-bmc-cost-structure'
} as const

type CCBMCNodeType = (typeof CC_BMC_NODE_TYPES)[keyof typeof CC_BMC_NODE_TYPES]

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
  SEMANTIC_PLAN: 'SemanticPlan_Agent',
  CULTURAL_CONTEXT: 'CulturalContext_Agent',
  CULTURAL_SIMULATION: 'CulturalSimulation_Agent',
  CULTURAL_REPORT: 'CulturalReport_Agent',
  ORCHESTRATOR: 'Orchestrator',
  CRITIC: 'Adversarial_Critic'
} as const

type AgentType = (typeof AGENT_TYPES)[keyof typeof AGENT_TYPES]

const MACRA_NODE_TYPES = [
  'cc-bmc-card',
  CC_BMC_NODE_TYPES.CUSTOMER_SEGMENTS,
  CC_BMC_NODE_TYPES.CUSTOMER_RELATIONSHIPS,
  CC_BMC_NODE_TYPES.CHANNELS,
  CC_BMC_NODE_TYPES.VALUE_PROPOSITIONS,
  CC_BMC_NODE_TYPES.REVENUE_STREAMS,
  CC_BMC_NODE_TYPES.KEY_ACTIVITIES,
  CC_BMC_NODE_TYPES.KEY_RESOURCES,
  CC_BMC_NODE_TYPES.KEY_PARTNERSHIPS,
  CC_BMC_NODE_TYPES.COST_STRUCTURE,
  'agent-avatar',
  'insight-note',
  'conflict-alert',
  'data-source',
  'plan-node'
] as const

// ============== Agent 分组（用于两阶段执行） ==============
const STAGE1_AGENTS = ['customerSegmentsAgent', 'valuePropositionsAgent', 'revenueStreamsAgent'] as const
const STAGE2_AGENTS = [
  'customerRelationshipsAgent',
  'channelsAgent',
  'keyActivitiesAgent',
  'keyResourcesAgent',
  'keyPartnershipsAgent',
  'costStructureAgent'
] as const

// Agent节点名 → State字段名的映射
const AGENT_NODE_MAPPING: Record<string, string> = {
  routerAgent: 'planNodes',
  customerSegmentsAgent: 'customerSegmentsNodes',
  customerRelationshipsAgent: 'customerRelationshipsNodes',
  channelsAgent: 'channelsNodes',
  valuePropositionsAgent: 'valuePropositionsNodes',
  revenueStreamsAgent: 'revenueStreamsNodes',
  keyActivitiesAgent: 'keyActivitiesNodes',
  keyResourcesAgent: 'keyResourcesNodes',
  keyPartnershipsAgent: 'keyPartnershipsNodes',
  costStructureAgent: 'costStructureNodes',
  culturalContextAgent: 'culturalContextNodes',
  culturalSimulationAgent: 'culturalSimulationNodes',
  culturalReportAgent: 'culturalReportNodes'
}

// ============== MacraNodeData Schema（用于验证 LLM 输出） ==============
const MacraNodeDataSchema = z.object({
  id: z.string(),
  type: z.enum([
    'cc-bmc-card',
    'cc-bmc-customer-segments',
    'cc-bmc-customer-relationships',
    'cc-bmc-channels',
    'cc-bmc-value-propositions',
    'cc-bmc-revenue-streams',
    'cc-bmc-key-activities',
    'cc-bmc-key-resources',
    'cc-bmc-key-partnerships',
    'cc-bmc-cost-structure',
    'agent-avatar',
    'insight-note',
    'conflict-alert',
    'data-source',
    'plan-node'
  ]),
  label: z.string().max(50),
  summary: z.string(), // 核心摘要（画布默认显示，100字内）
  fullContent: z.string(), // 完整详细内容（展开显示，500字内）
  content: z.string().optional(), // 向后兼容，如果没有 summary/fullContent 则使用 content
  domain: z.enum(Object.values(CC_BMC_DOMAINS) as [string, ...string[]]).optional(),
  metadata: z.object({
    agent_signature: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    cultural_context: z.string().optional(),
    semantic_status: z.enum(['pending', 'confirmed', 'needs-clarification']).optional()
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

// ============== Prompt Templates（优化版 - 支持详细内容）==============

// CC-BMC 框架整体上下文说明
const CC_BMC_FRAMEWORK_CONTEXT = `
【CC-BMC 商业模式分析框架】

CC-BMC（Canvas Cultural Business Model）是一个9维度的系统化商业模式分析框架，帮助创业者从全局视角构建可持续的商业模式。

核心维度及逻辑关系：

1️⃣ **客户端（需求侧）**
   - 客户细分 (Customer Segments)：定义目标用户群体、市场规模、用户画像
   - 客户关系 (Customer Relationships)：设计用户互动方式、忠诚度策略、生命周期管理
   - 渠道通路 (Channels)：规划用户触达、服务交付、品牌传播渠道

2️⃣ **价值端（核心）**
   - 价值主张 (Value Propositions)：提炼核心价值、差异化优势、解决的用户痛点

3️⃣ **收入端（验证）**
   - 收入来源 (Revenue Streams)：构建盈利模式、定价策略、收入结构

4️⃣ **运营端（支撑侧）**
   - 关键业务 (Key Activities)：支撑价值主张的核心运营活动
   - 核心资源 (Key Resources)：实现关键业务所需的战略性资产
   - 重要合作 (Key Partnerships)：补充核心资源、降低风险的外部协作

5️⃣ **成本端（效率）**
   - 成本结构 (Cost Structure)：分析成本构成、优化运营效率

【跨维度协同关系】
- 价值主张 ↔ 客户细分：价值主张必须精准匹配目标客户的核心需求
- 渠道通路 ↔ 客户关系：渠道设计需要适配客户关系策略
- 关键业务 ↔ 价值主张：关键业务必须有效支撑价值主张的实现
- 核心资源 ↔ 关键业务：资源配置为关键业务提供战略保障
- 重要合作 ↔ 核心资源：合作伙伴补充自身资源的不足
- 收入来源 ↔ 价值主张：收入模式验证价值主张的市场可行性
- 成本结构 ↔ 运营端：成本结构反映运营效率和资源利用率
`

// Agent 协作指南
const AGENT_COLLABORATION_GUIDE = `
【你的分析使命】
作为 CC-BMC 分析框架的专项 Agent，你需要：

1. **深度分析你负责的维度**
   - 结合用户的具体业务场景，提供详实、可落地的分析
   - 不仅指出"是什么"，更要解释"为什么"和"怎么做"

2. **考虑与其他维度的协同关系**
   - 你的分析不是孤立的，要主动识别与其他维度的依赖和协同
   - 思考你的维度如何支撑或依赖其他维度

3. **识别跨维度的机会和风险**
   - 发现跨维度的协同效应（1+1>2 的机会）
   - 警示跨维度的冲突风险（可能存在的矛盾）

4. **提供战略性和可操作的建议**
   - 基于分析提出具体的实施路径
   - 考虑资源约束和执行优先级

【其他 Agent 的职责】（你需要了解的协作背景）

▸ **客户细分 Agent (Customer Segments)**
  定义目标用户群体、市场规模、用户画像、需求特征

▸ **客户关系 Agent (Customer Relationships)**
  设计用户互动方式、忠诚度策略、留存机制、社区建设

▸ **渠道通路 Agent (Channels)**
  规划用户触达方式、服务交付路径、品牌传播渠道

▸ **价值主张 Agent (Value Propositions)**
  提炼核心价值、差异化优势、用户痛点解决方案

▸ **收入来源 Agent (Revenue Streams)**
  构建盈利模式、定价策略、收入结构优化

▸ **关键业务 Agent (Key Activities)**
  识别支撑价值主张的核心运营活动和业务流程

▸ **核心资源 Agent (Key Resources)**
  明确实现关键业务所需的战略性资产（人才、技术、资本、品牌等）

▸ **重要合作 Agent (Key Partnerships)**
  规划外部协作、供应链管理、战略联盟

▸ **成本结构 Agent (Cost Structure)**
  分析成本构成、优化运营效率、平衡成本与价值

【协同思考提示】
在你的分析中，请特别关注：
✓ 你的维度如何支撑**价值主张**的实现？
✓ 与哪些维度存在**强依赖关系**？
✓ 可能产生哪些**跨维度的协同效应**？
✓ 是否存在**潜在的跨维度冲突**？
`

const buildCommonJsonFormat = (nodeType: string) => `返回格式：JSON数组，仅1项，严格遵循以下结构：
[{
  "id": "auto-generated",
  "type": "${nodeType}",
  "domain": "对应维度",
  "label": "简短标题(8字内)",
  "summary": "核心摘要(100字内,3-4个要点,每点1行,Markdown格式)",
  "fullContent": "完整详细内容(500字内,包含：\\n## 核心分析\\n- 详细要点1\\n- 详细要点2\\n\\n## 数据支撑\\n- 具体数据/趋势\\n\\n## 实施建议\\n- 可行性建议,Markdown格式)",
  "metadata": {
    "agent_signature": "对应Agent",
    "confidence": "high/medium/low",
    "source": "数据来源",
    "tags": ["标签"],
    "cultural_context": "适配地域"
  }
}]`

const OPTIMIZATION_RULES = `要求：
1. summary：简洁核心观点，100字内，3-4个要点
2. fullContent：深入分析，500字内，包含数据支撑、案例、实施建议
3. 数据支撑：引用具体数据/趋势/案例
4. 地域适配：说明文化假设和区域差异
5. 仅返回JSON数组，无其他文字`

const CULTURAL_REQUIREMENTS = `地域适配：考虑目标市场的文化背景和用户习惯`

const CULTURAL_CONTEXT_RULES = `要求：
1. summary：跨文化差异的核心要点，100字内，3-4个要点
2. fullContent：500字内，包含：\n## 核心文化差异\n- 关键差异点\n\n## 区域适配策略\n- 本地化建议\n\n## 风险与注意事项\n- 文化禁忌/合规提醒
3. 至少覆盖2-3个不同文化/区域市场
4. metadata.cultural_context：100字内总结跨文化适配结论
5. 仅返回JSON数组，无其他文字`

const CULTURAL_CONTEXT_JSON_FORMAT = `返回格式：JSON数组，仅1项，严格遵循以下结构：
[{
  "id": "auto-generated",
  "type": "insight-note",
  "label": "跨文化洞察",
  "summary": "核心摘要(100字内,3-4个要点,每点1行,Markdown格式)",
  "fullContent": "完整详细内容(500字内,Markdown格式)",
  "metadata": {
    "agent_signature": "CulturalContext_Agent",
    "confidence": "high/medium/low",
    "cultural_context": "跨文化适配结论(100字内)",
    "tags": ["跨文化", "地域适配"]
  }
}]`

type CulturalScenario = {
  id: string
  title: string
  category: string
  description: string
  goal: string
  level: string
}

type CulturalReportTemplate = {
  id: string
  name: string
  description: string
  tones: string[]
}

const CULTURAL_SIMULATION_SCENARIOS: CulturalScenario[] = [
  {
    id: 'cn-negotiation',
    title: '与中国合作伙伴谈判',
    category: '谈判',
    description: '兼顾礼节与价格博弈，建立信任并争取最佳条款。',
    goal: '平衡价格与长期合作关系，避免失礼',
    level: '中级'
  },
  {
    id: 'kr-presentation',
    title: '韩国客户技术演示',
    category: '演示',
    description: '结构化讲解产品价值，处理尖锐的现场提问。',
    goal: '突出差异化与本地化支持',
    level: '中高级'
  },
  {
    id: 'us-support',
    title: '处理美国客户升级投诉',
    category: '客服',
    description: '高压情境下保持同理心并提供可执行补救方案。',
    goal: '降级情绪并锁定解决方案',
    level: '初中级'
  }
]

const CULTURAL_REPORT_TEMPLATES: CulturalReportTemplate[] = [
  {
    id: 'talent-report',
    name: '人才培养报告',
    description: '评估现状、能力模型与行动规划',
    tones: ['正式', '中性', '鼓励']
  },
  {
    id: 'market-brief',
    name: '市场进入简报',
    description: 'APAC 市场洞察与落地路线',
    tones: ['正式', '简洁', '行动导向']
  },
  {
    id: 'partnership-proposal',
    name: '合作提案',
    description: '价格、里程碑与风险说明',
    tones: ['合作', '稳健', '务实']
  }
]

const CULTURAL_SIMULATION_RULES = `要求：
1. summary：包含对方回应、礼节提示、策略建议、风险提醒
2. fullContent：包含模拟对话、建议话术、下一步动作
3. 至少给出3条可执行的后续回复建议
4. metadata.cultural_context：总结适配文化差异
5. 仅返回JSON数组，无其他文字`

const CULTURAL_SIMULATION_JSON_FORMAT = `返回格式：JSON数组，仅1项，严格遵循以下结构：
[{
  "id": "auto-generated",
  "type": "insight-note",
  "label": "跨文化沟通模拟",
  "summary": "核心摘要(100字内,3-4个要点,每点1行,Markdown格式)",
  "fullContent": "完整详细内容(500字内,Markdown格式)",
  "metadata": {
    "agent_signature": "CulturalSimulation_Agent",
    "confidence": "high/medium/low",
    "cultural_context": "跨文化适配结论(100字内)",
    "tags": ["跨文化", "沟通模拟"]
  }
}]`

const CULTURAL_REPORT_RULES = `要求：
1. summary：报告要点摘要，100字内
2. fullContent：包含结构化报告（现状/洞察/策略/行动）
3. 至少提供3条落地动作
4. metadata.cultural_context：总结跨文化注意事项
5. 仅返回JSON数组，无其他文字`

const CULTURAL_REPORT_JSON_FORMAT = `返回格式：JSON数组，仅1项，严格遵循以下结构：
[{
  "id": "auto-generated",
  "type": "insight-note",
  "label": "跨文化策略报告",
  "summary": "核心摘要(100字内,3-4个要点,每点1行,Markdown格式)",
  "fullContent": "完整详细内容(500字内,Markdown格式)",
  "metadata": {
    "agent_signature": "CulturalReport_Agent",
    "confidence": "high/medium/low",
    "cultural_context": "跨文化适配结论(100字内)",
    "tags": ["跨文化", "策略报告"]
  }
}]`

const SEMANTIC_PLAN_RULES = `要求：
1. summary：100字内，包含任务目标、关键假设、待确认问题（每点1行，Markdown 列表）
2. fullContent：包含任务理解、关键假设、待确认问题三段内容
3. 所有内容需聚焦用户输入，不要扩写虚构信息
4. 仅返回JSON数组，无其他文字`

const SEMANTIC_PLAN_JSON_FORMAT = `返回格式：JSON数组，仅1项，严格遵循以下结构：
[{
  "id": "auto-generated",
  "type": "plan-node",
  "label": "语义确认",
  "summary": "核心摘要(100字内,3-4个要点,每点1行,Markdown格式)",
  "fullContent": "完整详细内容(500字内,包含：\\n## 任务理解\\n- 要点\\n\\n## 关键假设\\n- 要点\\n\\n## 待确认问题\\n- 要点,Markdown格式)",
  "metadata": {
    "agent_signature": "SemanticPlan_Agent",
    "confidence": "high/medium/low",
    "tags": ["语义确认"]
  }
}]`

const readBooleanEnv = (key: string, defaultValue: boolean) => {
  const rawValue = process.env[key]
  if (rawValue === undefined) return defaultValue
  const normalized = rawValue.trim().toLowerCase()
  if (!normalized) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

// 延迟辅助函数，用于避免触发 API 限流
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const ENABLE_CULTURAL_SKILLS = readBooleanEnv('ENABLE_CULTURAL_SKILLS', true)
const ENABLE_SEMANTIC_PLAN = readBooleanEnv('ENABLE_SEMANTIC_PLAN', true)

// 增强版 Prompt 生成器（包含框架上下文和协作指南）
function createEnhancedAgentPrompt(config: {
  agentName: string
  domain: string
  focus: string
  question: string
  nodeType: CCBMCNodeType
  relatedDimensions?: string[]  // 新增：与当前维度强相关的其他维度
  knowledgeEvidence?: KnowledgeEvidence[]
}): string {
  const relatedDimensionsHint = config.relatedDimensions && config.relatedDimensions.length > 0
    ? `
【特别关注与以下维度的协同关系】
你的分析需要特别考虑与以下维度的依赖、支撑或协同关系：
${config.relatedDimensions.map(d => `  • ${d}`).join('\n')}

思考：
- 你的维度如何支撑或依赖这些维度？
- 是否存在跨维度的协同效应或潜在冲突？
- 如何通过跨维度协作创造更大价值？
`
    : ''

  const evidenceSection = config.knowledgeEvidence && config.knowledgeEvidence.length > 0
    ? `
【知识库参考】
${config.knowledgeEvidence.map((item) => `- [${item.docId}] ${item.snippet}`).join('\n')}
`
    : ''

  return `${CC_BMC_FRAMEWORK_CONTEXT}

${AGENT_COLLABORATION_GUIDE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【你的角色】
你是 ${config.agentName}，负责分析 CC-BMC 维度：${config.domain}

【分析重点】
${config.focus}

【用户问题】
${config.question}
${relatedDimensionsHint}
${evidenceSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${OPTIMIZATION_RULES}

${buildCommonJsonFormat(config.nodeType)}`
}

function pickCulturalScenario(question: string): CulturalScenario {
  const text = question.toLowerCase()

  if (text.includes('投诉') || text.includes('客服') || text.includes('支持') || text.includes('美国')) {
    return CULTURAL_SIMULATION_SCENARIOS[2]
  }

  if (text.includes('演示') || text.includes('展示') || text.includes('路演') || text.includes('韩国')) {
    return CULTURAL_SIMULATION_SCENARIOS[1]
  }

  if (text.includes('谈判') || text.includes('价格') || text.includes('合同') || text.includes('中国')) {
    return CULTURAL_SIMULATION_SCENARIOS[0]
  }

  return CULTURAL_SIMULATION_SCENARIOS[0]
}

function pickCulturalReportTemplate(question: string): CulturalReportTemplate {
  const text = question.toLowerCase()

  if (text.includes('人才') || text.includes('培训') || text.includes('招聘')) {
    return CULTURAL_REPORT_TEMPLATES[0]
  }

  if (text.includes('合作') || text.includes('伙伴') || text.includes('联盟')) {
    return CULTURAL_REPORT_TEMPLATES[2]
  }

  if (text.includes('市场') || text.includes('进入') || text.includes('出海')) {
    return CULTURAL_REPORT_TEMPLATES[1]
  }

  return CULTURAL_REPORT_TEMPLATES[1]
}

function shouldRunCulturalSkills(question: string): boolean {
  if (!ENABLE_CULTURAL_SKILLS) return false
  const text = question.toLowerCase()
  const directKeywords = [
    '跨文化',
    '文化差异',
    '文化适配',
    '文化背景',
    '文化冲突',
    '跨境沟通',
    '商务礼仪',
    '礼节',
    '本地化',
    '国际化',
    '出海',
    '海外',
    '跨境',
    '全球',
    '多语言',
    '区域差异'
  ]

  if (directKeywords.some((keyword) => text.includes(keyword))) {
    return true
  }

  const regionKeywords = [
    '北美',
    '欧洲',
    '中东',
    '拉美',
    '东南亚',
    '亚太',
    '日韩',
    '日本',
    '韩国',
    '美国',
    '英国',
    '德国',
    '法国',
    '加拿大',
    '澳洲',
    '澳大利亚',
    '新加坡',
    '印度'
  ]
  const expansionKeywords = [
    '市场',
    '进入',
    '落地',
    '合作',
    '谈判',
    '营销',
    '销售',
    '运营',
    '合规',
    '渠道',
    '本地'
  ]

  const hasRegion = regionKeywords.some((keyword) => text.includes(keyword))
  const hasExpansion = expansionKeywords.some((keyword) => text.includes(keyword))

  return hasRegion && hasExpansion
}

function shouldRunSemanticPlan(question: string, intent?: Intent['intent'] | null): boolean {
  if (!ENABLE_SEMANTIC_PLAN) return false
  if (!question.trim()) return false
  if (intent === 'detect_conflicts') return false
  return true
}

// 维度关联映射：定义每个维度与哪些其他维度有强协同关系
const DIMENSION_RELATIONSHIPS: Record<string, string[]> = {
  '客户细分 (Customer Segments)': ['价值主张 (Value Propositions)', '客户关系 (Customer Relationships)', '渠道通路 (Channels)'],
  '客户关系 (Customer Relationships)': ['客户细分 (Customer Segments)', '渠道通路 (Channels)', '收入来源 (Revenue Streams)'],
  '渠道通路 (Channels)': ['客户细分 (Customer Segments)', '客户关系 (Customer Relationships)', '关键业务 (Key Activities)'],
  '价值主张 (Value Propositions)': ['客户细分 (Customer Segments)', '关键业务 (Key Activities)', '收入来源 (Revenue Streams)'],
  '收入来源 (Revenue Streams)': ['价值主张 (Value Propositions)', '客户关系 (Customer Relationships)', '成本结构 (Cost Structure)'],
  '关键业务 (Key Activities)': ['价值主张 (Value Propositions)', '核心资源 (Key Resources)', '成本结构 (Cost Structure)'],
  '核心资源 (Key Resources)': ['关键业务 (Key Activities)', '重要合作 (Key Partnerships)', '成本结构 (Cost Structure)'],
  '重要合作 (Key Partnerships)': ['核心资源 (Key Resources)', '关键业务 (Key Activities)', '成本结构 (Cost Structure)'],
  '成本结构 (Cost Structure)': ['关键业务 (Key Activities)', '核心资源 (Key Resources)', '收入来源 (Revenue Streams)']
}

// ============== LangGraph State ==============
const BusinessState = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  intent: Annotation<Intent | null>(),
  planNodes: Annotation<MacraNodeData[]>(),
  customerSegmentsNodes: Annotation<MacraNodeData[]>(),
  customerRelationshipsNodes: Annotation<MacraNodeData[]>(),
  channelsNodes: Annotation<MacraNodeData[]>(),
  valuePropositionsNodes: Annotation<MacraNodeData[]>(),
  revenueStreamsNodes: Annotation<MacraNodeData[]>(),
  keyActivitiesNodes: Annotation<MacraNodeData[]>(),
  keyResourcesNodes: Annotation<MacraNodeData[]>(),
  keyPartnershipsNodes: Annotation<MacraNodeData[]>(),
  costStructureNodes: Annotation<MacraNodeData[]>(),
  culturalContextNodes: Annotation<MacraNodeData[]>(),
  culturalSimulationNodes: Annotation<MacraNodeData[]>(),
  culturalReportNodes: Annotation<MacraNodeData[]>(),
  conflicts: Annotation<MacraNodeData[]>(),
  edges: Annotation<CanvasEdge[]>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence[]>(),

  // 两阶段协作相关字段
  stage1Complete: Annotation<boolean>(),
  stage1Summary: Annotation<string>()
})

type BusinessStateType = typeof BusinessState.State

// ============== Stream Update 类型（与 ComfyStreamUpdate 保持一致） ==============
export type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

export type BusinessStreamUpdate =
  | { type: 'init'; graph: CanvasGraph; knowledgeEvidence?: KnowledgeEvidence[] }
  | { type: 'delta'; delta: GraphDelta }
  | { type: 'status'; status: 'completed' | 'failed'; message?: string }

// ============== Main Service ==============
export class BusinessLangGraphService {
  private readonly model: ChatOpenAI | null

  private readonly knowledgeService = new KnowledgeService()

  constructor() {
    this.model = createLLMModel()
  }

  private async gatherKnowledgeEvidence(question: string): Promise<KnowledgeEvidence[]> {
    // 临时禁用知识库检索，避免 embedding API 超时
    return []

    /* 原实现
    try {
      return await this.knowledgeService.search(question, 3)
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.gatherKnowledgeEvidence',
        metadata: { error: String(error) }
      })
      return []
    }
    */
  }

  async *streamConversation(context: {
    workspaceId: string
    userId: string
    question: string
  }): AsyncGenerator<BusinessStreamUpdate> {
    console.log('🚀 [StreamConversation] Starting...', { question: context.question })
    const builder = new BusinessCanvasBuilder(context.workspaceId, context.userId, context.question)
    const knowledgeEvidence = await this.gatherKnowledgeEvidence(context.question)

    // 1. 初始化画布（发送 init 事件）
    console.log('📊 [StreamConversation] Yielding init event')
    yield { type: 'init', graph: builder.getGraph(), knowledgeEvidence }

    // 2. 如果没有 LLM 配置，返回简单的提示节点
    if (!this.model) {
      console.error('❌ [StreamConversation] LLM not configured')
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
    console.log('🔧 [StreamConversation] Creating LangGraph')
    const graph = this.createGraph()

    try {
      console.log('▶️  [StreamConversation] Starting LangGraph stream...')
      // 4. 执行 LangGraph（流式模式）
      const stream = await graph.stream(
        {
          workspaceId: context.workspaceId,
          userId: context.userId,
          question: context.question,
          intent: null,
          planNodes: [],
          customerSegmentsNodes: [],
          customerRelationshipsNodes: [],
          channelsNodes: [],
          valuePropositionsNodes: [],
          revenueStreamsNodes: [],
          keyActivitiesNodes: [],
          keyResourcesNodes: [],
          keyPartnershipsNodes: [],
          costStructureNodes: [],
          culturalContextNodes: [],
          culturalSimulationNodes: [],
          culturalReportNodes: [],
          conflicts: [],
          edges: [],
          stage1Complete: false,
          stage1Summary: '',
          knowledgeEvidence
        },
        { streamMode: 'updates' }
      )

      console.log('⏳ [StreamConversation] Waiting for updates...')
      let updateCount = 0
      // 5. 逐节点推送更新
      for await (const update of stream) {
        updateCount++
        console.log(`📦 [StreamConversation] Update #${updateCount}:`, Object.keys(update))
        const entries = Object.entries(update as Record<string, Record<string, unknown>>)

        for (const [nodeName, payload] of entries) {
          console.log(`  🔸 [${nodeName}] Processing...`, Object.keys(payload))

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

          // Domain Agents (统一处理9个维度Agent)
          const stateField = AGENT_NODE_MAPPING[nodeName]
          if (stateField && payload[stateField]) {
            const nodes = payload[stateField] as MacraNodeData[]
            for (const node of nodes) {
              yield { type: 'delta', delta: builder.addMacraNode(node) }
            }
          }

          // Orchestrator
          if (nodeName === 'orchestrator') {
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

      console.log(`✅ [StreamConversation] Completed! Total updates: ${updateCount}`)
      yield { type: 'status', status: 'completed' }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      console.error('❌ [StreamConversation] Error:', message)
      if (stack) {
        console.error('Stack trace:', stack)
      }
      auditLogger.error({
        action: 'business-langgraph.streamConversation',
        metadata: { error: message, stack }
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
      // Stage 1: 核心三维度
      .addNode('customerSegmentsAgent', async (state) => this.runCustomerSegmentsAgent(state))
      .addNode('valuePropositionsAgent', async (state) => this.runValuePropositionsAgent(state))
      .addNode('revenueStreamsAgent', async (state) => this.runRevenueStreamsAgent(state))
      // Stage 1 Aggregator: 同步点
      .addNode('stage1Aggregator', async (state) => this.aggregateStage1(state))
      // Stage 2: 支撑六维度
      .addNode('customerRelationshipsAgent', async (state) => this.runCustomerRelationshipsAgent(state))
      .addNode('channelsAgent', async (state) => this.runChannelsAgent(state))
      .addNode('keyActivitiesAgent', async (state) => this.runKeyActivitiesAgent(state))
      .addNode('keyResourcesAgent', async (state) => this.runKeyResourcesAgent(state))
      .addNode('keyPartnershipsAgent', async (state) => this.runKeyPartnershipsAgent(state))
      .addNode('costStructureAgent', async (state) => this.runCostStructureAgent(state))
      // Orchestrator & Critic
      .addNode('orchestrator', async (state) => this.orchestrate(state))
      .addNode('culturalContextAgent', async (state) => this.runCulturalContextAgent(state))
      .addNode('culturalSimulationAgent', async (state) => this.runCulturalSimulationAgent(state))
      .addNode('culturalReportAgent', async (state) => this.runCulturalReportAgent(state))
      .addNode('critic', async (state) => this.runCritic(state))
      // Start
      .addEdge(START, 'routerAgent')
      // Router → Stage 1 (3 core dimensions)
      .addConditionalEdges('routerAgent', (state) => {
        const intent = state.intent?.intent || 'general'
        console.log(`🔀 [Graph Routing] Intent: ${intent}`)
        if (intent === 'generate_bmc') {
          // 两阶段模式：先执行核心3维度
          console.log(`  ➡️  Routing to Stage1 Agents: ${STAGE1_AGENTS.join(', ')}`)
          return [...STAGE1_AGENTS]
        }
        if (intent === 'detect_conflicts') {
          console.log('  ➡️  Routing to Critic')
          return ['critic']
        }
        console.log('  ➡️  Routing to Orchestrator (general intent)')
        return ['orchestrator']
      })
      // Stage 1 → Stage 1 Aggregator (同步点)
      .addEdge([...STAGE1_AGENTS], 'stage1Aggregator')
      // Stage 1 Aggregator → Stage 2 (6 supporting dimensions)
      .addConditionalEdges('stage1Aggregator', () => [...STAGE2_AGENTS])
      // Stage 2 → Orchestrator
      .addEdge([...STAGE2_AGENTS], 'orchestrator')
      // Orchestrator → Cultural Context → Cultural Skills → Critic → END
      .addConditionalEdges('orchestrator', (state) => {
        if (shouldRunCulturalSkills(state.question)) {
          return ['culturalContextAgent']
        }
        return ['critic']
      })
      .addEdge('culturalContextAgent', 'culturalSimulationAgent')
      .addEdge('culturalSimulationAgent', 'culturalReportAgent')
      .addEdge('culturalReportAgent', 'critic')
      .addEdge('critic', END)
      .compile()
  }

  // ============== Agent Nodes ==============

  private async routeIntent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    console.log('🧭 [routeIntent] Starting intent classification...')
    if (!this.model) {
      console.log('❌ [routeIntent] No LLM model configured')
      return { intent: { intent: 'general', reasoning: 'LLM not configured' }, planNodes: [] }
    }

    const prompt = `你是意图路由器，需要判断用户的需求类型。

用户问题：${state.question}

请分析用户意图，返回以下之一：

**优先级1（最常用）：generate_bmc**
只要用户问题涉及以下任何方面，都应该选择 generate_bmc：
- 商业模式、商业分析、业务分析
- 市场分析、行业分析、竞争分析
- 品牌发展、企业发展、战略规划
- 产品、服务、客户、渠道、收入、成本等商业要素
- 创业、投资、融资、盈利模式
- 即使用户没有明确说"生成画布"或"CC-BMC"，只要涉及商业话题，就选择此项

**优先级2（仅限特殊场景）：analyze**
- 用户已经有现成的画布或分析结果，要求进一步分析或提供建议
- 用户明确说"分析我的XXX"或"优化我的XXX"

**优先级3（仅限冲突检测）：detect_conflicts**
- 用户明确要求检测逻辑冲突、矛盾、风险

**优先级4（极少使用）：general**
- 纯粹的闲聊、问候
- 与商业无关的通用问题（如天气、新闻等）

返回 JSON 格式：
{
  "intent": "generate_bmc",
  "reasoning": "用户提到了'新能源汽车市场'和'品牌发展'，属于商业分析范畴，应该生成完整的 CC-BMC 画布来系统化分析"
}
`

    let result: Intent

    try {
      console.log('🤖 [routeIntent] Calling LLM for intent classification...')
      const structured = this.model.withStructuredOutput(IntentSchema, {
        name: 'IntentClassification',
        strict: true
      })
      result = await structured.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      console.log('✅ [routeIntent] Intent classified:', result)
    } catch (error) {
      console.error('❌ [routeIntent] Intent classification failed:', String(error))
      auditLogger.error({
        action: 'business-langgraph.routeIntent',
        metadata: { error: String(error) }
      })
      result = { intent: 'generate_bmc', reasoning: 'Failed to classify intent, defaulting to generate_bmc' }
      console.log('🔄 [routeIntent] Using fallback intent:', result)
    }

    const planNodes = await this.buildSemanticPlanNodes(state.question, result)
    console.log(`📋 [routeIntent] Generated ${planNodes.length} plan nodes`)
    return { intent: result, planNodes }
  }

  private async buildSemanticPlanNodes(question: string, intent: Intent): Promise<MacraNodeData[]> {
    if (!this.model) return []
    if (!shouldRunSemanticPlan(question, intent.intent)) return []

    const intentSummary = `用户意图：${intent.intent}\n意图判断：${intent.reasoning}`
    const prompt = `你是语义确认 Agent，需要把用户需求整理成可确认的理解清单，帮助用户确认你是否理解正确。

用户问题：${question}

${intentSummary}

${SEMANTIC_PLAN_RULES}

${SEMANTIC_PLAN_JSON_FORMAT}`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(question)])
      const content = response.content as string
      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runSemanticPlanAgent'), 'runSemanticPlanAgent')

      if (nodes.length === 0) {
        return []
      }

      return nodes.map((node) => ({
        ...node,
        id: `semantic-plan-${nanoid(8)}`,
        type: 'plan-node' as const,
        label: node.label || '语义确认',
        metadata: {
          ...node.metadata,
          agent_signature: AGENT_TYPES.SEMANTIC_PLAN,
          semantic_status: node.metadata?.semantic_status ?? 'pending'
        }
      }))
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.buildSemanticPlanNodes',
        metadata: { error: String(error) }
      })
      return []
    }
  }

  private async runCustomerSegmentsAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { customerSegmentsNodes: [] }

    const prompt = createEnhancedAgentPrompt({
      agentName: 'CustomerSegment_Agent（客户细分专家）',
      domain: '客户细分 (Customer Segments)',
      focus: '目标客户群体、用户画像、市场规模、需求特征',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.CUSTOMER_SEGMENTS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['客户细分 (Customer Segments)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

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
        type: CC_BMC_NODE_TYPES.CUSTOMER_SEGMENTS,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'CustomerRelationship_Agent（客户关系专家）',
      domain: '客户关系 (Customer Relationships)',
      focus: '维系客户方式、服务模式、用户粘性、触点管理',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.CUSTOMER_RELATIONSHIPS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['客户关系 (Customer Relationships)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.CUSTOMER_RELATIONSHIPS,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'Channels_Agent（渠道通路专家）',
      domain: '渠道通路 (Channels)',
      focus: '触达方式、线上/线下渠道、分发策略、渠道组合',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.CHANNELS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['渠道通路 (Channels)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.CHANNELS,
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

    const prompt = createEnhancedAgentPrompt({
      agentName: 'ValueProposition_Agent（价值主张专家）',
      domain: '价值主张 (Value Propositions)',
      focus: '核心价值、差异化优势、解决的痛点、独特卖点',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.VALUE_PROPOSITIONS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['价值主张 (Value Propositions)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

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
        type: CC_BMC_NODE_TYPES.VALUE_PROPOSITIONS,
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

    const prompt = createEnhancedAgentPrompt({
      agentName: 'RevenueStream_Agent（收入来源专家）',
      domain: '收入来源 (Revenue Streams)',
      focus: '商业模式、定价策略、收入结构、盈利方式',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.REVENUE_STREAMS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['收入来源 (Revenue Streams)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

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
        type: CC_BMC_NODE_TYPES.REVENUE_STREAMS,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'KeyActivity_Agent（关键业务专家）',
      domain: '关键业务 (Key Activities)',
      focus: '核心活动、业务流程、运营重点、关键任务',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.KEY_ACTIVITIES,
      relatedDimensions: DIMENSION_RELATIONSHIPS['关键业务 (Key Activities)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.KEY_ACTIVITIES,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'KeyResource_Agent（核心资源专家）',
      domain: '核心资源 (Key Resources)',
      focus: '关键资产、技术能力、人才团队、核心资源',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.KEY_RESOURCES,
      relatedDimensions: DIMENSION_RELATIONSHIPS['核心资源 (Key Resources)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.KEY_RESOURCES,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'KeyPartnership_Agent（重要合作专家）',
      domain: '重要合作 (Key Partnerships)',
      focus: '战略伙伴、供应商、渠道合作、外部依赖',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.KEY_PARTNERSHIPS,
      relatedDimensions: DIMENSION_RELATIONSHIPS['重要合作 (Key Partnerships)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.KEY_PARTNERSHIPS,
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

    // 添加延迟避免触发 API 限流（Stage2 Agent）
    await delay(300)

    let prompt = createEnhancedAgentPrompt({
      agentName: 'CostStructure_Agent（成本结构专家）',
      domain: '成本结构 (Cost Structure)',
      focus: '主要成本、成本控制、盈利能力、成本结构',
      question: state.question,
      nodeType: CC_BMC_NODE_TYPES.COST_STRUCTURE,
      relatedDimensions: DIMENSION_RELATIONSHIPS['成本结构 (Cost Structure)'],
      knowledgeEvidence: state.knowledgeEvidence ?? []
    })

    // 注入第一阶段上下文（如果存在）
    if (state.stage1Summary) {
      prompt = `${prompt}\n\n${state.stage1Summary}`
    }

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
        type: CC_BMC_NODE_TYPES.COST_STRUCTURE,
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

  private async runCulturalContextAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { culturalContextNodes: [] }
    if (!shouldRunCulturalSkills(state.question)) return { culturalContextNodes: [] }

    // 添加延迟避免触发 API 限流（Cultural Skills Agent）
    await delay(500)

    const contextSummary = this.buildCulturalContextSummary(state)
    if (!contextSummary) {
      return { culturalContextNodes: [] }
    }

    const prompt = `你是跨文化商业策略专家，需要基于以下画布信息生成跨文化适配分析。

【用户问题】
${state.question}

【画布要点】
${contextSummary}

${CULTURAL_REQUIREMENTS}

${CULTURAL_CONTEXT_RULES}

${CULTURAL_CONTEXT_JSON_FORMAT}`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCulturalContextAgent'), 'runCulturalContextAgent')

      if (nodes.length === 0) {
        return { culturalContextNodes: [] }
      }

      const validatedNodes = nodes.map((node) => {
        const label = node.label && node.label !== '未命名' ? node.label : '跨文化洞察'
        const culturalContext = node.metadata?.cultural_context || node.summary || node.content || ''
        const tags = Array.isArray(node.metadata?.tags) && node.metadata.tags.length > 0
          ? node.metadata.tags
          : ['跨文化', '地域适配']

        return {
          ...node,
          id: `cultural-context-${nanoid(8)}`,
          type: 'insight-note' as const,
          label,
          metadata: {
            ...node.metadata,
            agent_signature: AGENT_TYPES.CULTURAL_CONTEXT,
            cultural_context: culturalContext,
            tags
          }
        }
      })

      return { culturalContextNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCulturalContextAgent',
        metadata: { error: String(error) }
      })
      return { culturalContextNodes: [] }
    }
  }

  private async runCulturalSimulationAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { culturalSimulationNodes: [] }
    if (!shouldRunCulturalSkills(state.question)) return { culturalSimulationNodes: [] }

    // 添加延迟避免触发 API 限流（Cultural Skills Agent）
    await delay(500)

    const contextSummary = this.buildCulturalContextSummary(state)
    if (!contextSummary) {
      return { culturalSimulationNodes: [] }
    }

    const scenario = pickCulturalScenario(state.question)
    const prompt = `你是跨文化沟通教练，请基于以下场景和画布信息提供沟通模拟与建议。

【场景】
标题：${scenario.title}
类别：${scenario.category}
描述：${scenario.description}
目标：${scenario.goal}
难度：${scenario.level}

【用户问题】
${state.question}

【画布要点】
${contextSummary}

${CULTURAL_REQUIREMENTS}

${CULTURAL_SIMULATION_RULES}

${CULTURAL_SIMULATION_JSON_FORMAT}`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCulturalSimulationAgent'), 'runCulturalSimulationAgent')

      if (nodes.length === 0) {
        return { culturalSimulationNodes: [] }
      }

      const validatedNodes = nodes.map((node) => {
        const label = node.label && node.label !== '未命名' ? node.label : `${scenario.title}模拟`
        const culturalContext = node.metadata?.cultural_context || node.summary || node.content || ''
        const tags = Array.isArray(node.metadata?.tags) && node.metadata.tags.length > 0
          ? node.metadata.tags
          : ['跨文化', '沟通模拟', scenario.category]

        return {
          ...node,
          id: `cultural-simulation-${nanoid(8)}`,
          type: 'insight-note' as const,
          label,
          metadata: {
            ...node.metadata,
            agent_signature: AGENT_TYPES.CULTURAL_SIMULATION,
            cultural_context: culturalContext,
            tags
          }
        }
      })

      return { culturalSimulationNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCulturalSimulationAgent',
        metadata: { error: String(error) }
      })
      return { culturalSimulationNodes: [] }
    }
  }

  private async runCulturalReportAgent(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    if (!this.model) return { culturalReportNodes: [] }
    if (!shouldRunCulturalSkills(state.question)) return { culturalReportNodes: [] }

    // 添加延迟避免触发 API 限流（Cultural Skills Agent）
    await delay(500)

    const contextSummary = this.buildCulturalContextSummary(state)
    if (!contextSummary) {
      return { culturalReportNodes: [] }
    }

    const template = pickCulturalReportTemplate(state.question)
    const tone = template.tones[0] ?? '正式'
    const prompt = `你是跨文化报告专家，请基于以下模板与画布信息生成策略报告。

【模板】
名称：${template.name}
说明：${template.description}
语气：${tone}

【用户问题】
${state.question}

【画布要点】
${contextSummary}

${CULTURAL_REQUIREMENTS}

${CULTURAL_REPORT_RULES}

${CULTURAL_REPORT_JSON_FORMAT}`

    try {
      const response = await this.model.invoke([new SystemMessage(prompt), new HumanMessage(state.question)])
      const content = response.content as string

      const nodes = normalizeSingleNode(extractAndParseJSON(content, 'runCulturalReportAgent'), 'runCulturalReportAgent')

      if (nodes.length === 0) {
        return { culturalReportNodes: [] }
      }

      const validatedNodes = nodes.map((node) => {
        const label = node.label && node.label !== '未命名' ? node.label : template.name
        const culturalContext = node.metadata?.cultural_context || node.summary || node.content || ''
        const tags = Array.isArray(node.metadata?.tags) && node.metadata.tags.length > 0
          ? node.metadata.tags
          : ['跨文化', '策略报告', template.name]

        return {
          ...node,
          id: `cultural-report-${nanoid(8)}`,
          type: 'insight-note' as const,
          label,
          metadata: {
            ...node.metadata,
            agent_signature: AGENT_TYPES.CULTURAL_REPORT,
            cultural_context: culturalContext,
            tags
          }
        }
      })

      return { culturalReportNodes: validatedNodes }
    } catch (error) {
      auditLogger.error({
        action: 'business-langgraph.runCulturalReportAgent',
        metadata: { error: String(error) }
      })
      return { culturalReportNodes: [] }
    }
  }

  private async orchestrate(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    // 生成边（连接关系）- 完整的 CC-BMC 逻辑连接
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

    return { edges }
  }

  /**
   * 第一阶段聚合器：汇总前3个核心维度的输出
   * 为第二阶段提供全局上下文
   */
  private async aggregateStage1(state: BusinessStateType): Promise<Partial<BusinessStateType>> {
    const stage1Nodes = [
      ...state.customerSegmentsNodes,
      ...state.valuePropositionsNodes,
      ...state.revenueStreamsNodes
    ]

    if (stage1Nodes.length === 0) {
      return {
        stage1Complete: true,
        stage1Summary: '第一阶段未生成有效节点'
      }
    }

    // 构建结构化摘要
    const summary = this.buildStage1Context(state)

    auditLogger.info({
      action: 'business-langgraph.aggregateStage1',
      metadata: {
        stage1NodeCount: stage1Nodes.length,
        summaryLength: summary.length
      }
    })

    return {
      stage1Complete: true,
      stage1Summary: summary
    }
  }

  /**
   * 构建第一阶段上下文摘要
   * 用于第二阶段Agent的Prompt增强
   */
  private buildStage1Context(state: BusinessStateType): string {
    const sections: string[] = []

    sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    sections.push('【第一阶段分析结果】')
    sections.push('以下是商业模式核心三要素的分析结果，请在你的分析中参考这些信息：')
    sections.push('')

    // 客户细分
    if (state.customerSegmentsNodes.length > 0) {
      sections.push('**1️⃣ 客户细分 (Customer Segments)**')
      state.customerSegmentsNodes.forEach((node) => {
        const content = node.summary || node.content || ''
        sections.push(`• ${node.label}：${content}`)
      })
      sections.push('')
    }

    // 价值主张
    if (state.valuePropositionsNodes.length > 0) {
      sections.push('**2️⃣ 价值主张 (Value Propositions)**')
      state.valuePropositionsNodes.forEach((node) => {
        const content = node.summary || node.content || ''
        sections.push(`• ${node.label}：${content}`)
      })
      sections.push('')
    }

    // 收入来源
    if (state.revenueStreamsNodes.length > 0) {
      sections.push('**3️⃣ 收入来源 (Revenue Streams)**')
      state.revenueStreamsNodes.forEach((node) => {
        const content = node.summary || node.content || ''
        sections.push(`• ${node.label}：${content}`)
      })
      sections.push('')
    }

    sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    sections.push('')
    sections.push('请基于以上第一阶段的分析结果，深入思考你负责的维度如何与这些核心要素协同。')

    return sections.join('\n')
  }

  private buildCulturalContextSummary(state: BusinessStateType): string {
    const nodes = [
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

    if (nodes.length === 0) return ''

    return nodes
      .map((node) => {
        const content = (node.summary || node.content || '').replace(/\s+/g, ' ').trim()
        const trimmed = content.length > 120 ? `${content.slice(0, 120)}...` : content
        const domain = node.domain || '综合'
        return `- ${domain} / ${node.label}：${trimmed}`
      })
      .join('\n')
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
  // 跟踪每个维度已经放置的节点数量，用于错开布局
  private readonly domainCounters = new Map<string, number>()

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
    // 向后兼容：如果没有 summary/fullContent，则使用 content
    const summary = macraNode.summary || macraNode.content || ''
    const fullContent = macraNode.fullContent || macraNode.content || ''

    // 使用 DOMAIN_POSITIONS 中定义的区域位置，如果没有则使用默认顺序布局
    let position: { x: number; y: number }

    if (macraNode.domain && DOMAIN_POSITIONS[macraNode.domain]) {
      // 获取该维度的基础位置
      const basePosition = DOMAIN_POSITIONS[macraNode.domain]

      // 同一维度的节点垂直错开，每个节点向下偏移 280px
      const count = this.domainCounters.get(macraNode.domain) || 0
      this.domainCounters.set(macraNode.domain, count + 1)

      position = {
        x: basePosition.x,
        y: basePosition.y + (count * 280)
      }
    } else {
      // 没有维度信息的节点使用默认顺序布局
      position = { x: ROOT_POSITION.x, y: this.nextY }
      this.nextY += NODE_SPACING
    }

    const node: CanvasNode = {
      id: macraNode.id,
      type: 'note', // ReactFlow 的通用类型，前端会根据 data 渲染具体组件
      position,
      data: {
        type: 'note',
        title: macraNode.label,
        content: summary, // 默认显示摘要
        variant: 'insight',
        meta: {
          macraType: macraNode.type,
          domain: macraNode.domain,
          agentType: macraNode.agentType,
          severity: macraNode.severity,
          conflictType: macraNode.conflictType,
          isInteractive: macraNode.isInteractive,
          summary, // 添加 summary 字段
          fullContent, // 添加 fullContent 字段
          metadata: macraNode.metadata
        }
      }
    }

    this.nodes.set(node.id, node)

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

    // - 修复缺少开头引号的属性名（如 domain": → "domain":）
    // 匹配模式：行首空白 + 非引号字母 + "：
    jsonStr = jsonStr.replace(/(\s+)([a-zA-Z_][a-zA-Z0-9_]*)":/g, '$1"$2":')

    // - 修复缺少结尾引号的属性名（如 "domain → "domain"）
    jsonStr = jsonStr.replace(/"([a-zA-Z_][a-zA-Z0-9_]*):/g, '"$1":')

    // 4. 解析 JSON
    const nodes = JSON.parse(jsonStr) as unknown

    if (!Array.isArray(nodes) || nodes.length === 0) {
      auditLogger.error({
        action: `business-langgraph.${agentName}.parseJSON`,
        metadata: { error: 'Parsed result is not a valid array', nodes }
      })
      return []
    }

    const normalized = nodes
      .map((node) => normalizeMacraNodeData(node, agentName))
      .filter((node): node is MacraNodeData => Boolean(node))

    if (normalized.length === 0) {
      auditLogger.error({
        action: `business-langgraph.${agentName}.parseJSON`,
        metadata: { error: 'No valid nodes after normalization' }
      })
      return []
    }

    return normalized
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

function normalizeMacraNodeData(input: unknown, agentName: string): MacraNodeData | null {
  if (!input || typeof input !== 'object') {
    auditLogger.warn({
      action: `business-langgraph.${agentName}.normalizeMacraNode`,
      metadata: { message: 'Invalid node payload', input }
    })
    return null
  }

  const raw = input as Record<string, unknown>
  const baseContent = typeof raw.content === 'string' ? raw.content : ''
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label : '未命名'
  const summaryCandidate = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  const fullContentCandidate = typeof raw.fullContent === 'string' ? raw.fullContent.trim() : ''
  const summary = summaryCandidate || baseContent || label
  const fullContent = fullContentCandidate || summary

  const metadata =
    typeof raw.metadata === 'object' && raw.metadata !== null && !Array.isArray(raw.metadata)
      ? raw.metadata
      : {}

  const normalized = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `auto-${nanoid(8)}`,
    type: typeof raw.type === 'string' && MACRA_NODE_TYPES.includes(raw.type as (typeof MACRA_NODE_TYPES)[number])
      ? raw.type
      : 'cc-bmc-card',
    label,
    summary,
    fullContent,
    content: typeof raw.content === 'string' ? raw.content : undefined,
    domain: typeof raw.domain === 'string' && Object.values(CC_BMC_DOMAINS).includes(raw.domain as CCBMCDomain)
      ? raw.domain
      : undefined,
    metadata,
    agentType:
      typeof raw.agentType === 'string' && Object.values(AGENT_TYPES).includes(raw.agentType as AgentType)
        ? raw.agentType
        : undefined,
    isInteractive: typeof raw.isInteractive === 'boolean' ? raw.isInteractive : undefined,
    severity:
      typeof raw.severity === 'string' && ['high', 'medium', 'low'].includes(raw.severity)
        ? raw.severity
        : undefined,
    conflictType:
      typeof raw.conflictType === 'string' &&
      ['resource-goal', 'compliance-business', 'channel-product', 'other'].includes(raw.conflictType)
        ? raw.conflictType
        : undefined
  }

  const parsed = MacraNodeDataSchema.safeParse(normalized)
  if (!parsed.success) {
    auditLogger.warn({
      action: `business-langgraph.${agentName}.normalizeMacraNode`,
      metadata: { error: parsed.error.message }
    })
    return null
  }

  return parsed.data
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

// ============== MACRA 区域布局（Business Model Canvas 经典布局） ==============
const DOMAIN_POSITIONS: Record<string, { x: number; y: number }> = {
  // 左上区域 - 供应链/内部运营
  [CC_BMC_DOMAINS.KEY_PARTNERSHIPS]: { x: 200, y: 200 },
  [CC_BMC_DOMAINS.KEY_ACTIVITIES]: { x: 200, y: 500 },
  [CC_BMC_DOMAINS.KEY_RESOURCES]: { x: 200, y: 800 },

  // 中间区域 - 价值核心
  [CC_BMC_DOMAINS.VALUE_PROPOSITIONS]: { x: 700, y: 500 },

  // 右上区域 - 客户/市场
  [CC_BMC_DOMAINS.CUSTOMER_SEGMENTS]: { x: 1200, y: 200 },
  [CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS]: { x: 1200, y: 500 },
  [CC_BMC_DOMAINS.CHANNELS]: { x: 1200, y: 800 },

  // 底部区域 - 财务
  [CC_BMC_DOMAINS.COST_STRUCTURE]: { x: 400, y: 1150 },
  [CC_BMC_DOMAINS.REVENUE_STREAMS]: { x: 1000, y: 1150 }
}
