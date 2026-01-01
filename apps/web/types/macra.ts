/**
 * MACRA (Multi-Agent Collaborative Reasoning Architecture) 类型定义
 * 智绘·无限商业画布系统
 */

// ============== CC-BMC 九大维度 ==============
export const CC_BMC_DOMAINS = {
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

// ============== 节点类型 ==============
export type NodeType =
  | 'cc-bmc-card'      // 核心业务卡片
  | 'agent-avatar'      // 虚拟顾问节点
  | 'conflict-alert'    // 冲突警示
  | 'insight-note'      // 洞察便签
  | 'data-source'       // 数据源节点

// ============== 置信度级别 ==============
export type ConfidenceLevel = 'high' | 'medium' | 'low'

// ============== 节点元数据 ==============
export interface NodeMetadata {
  source?: string                    // 数据来源（如"基于 NMPA 2024 新规"）
  confidence?: ConfidenceLevel       // 置信度
  agent_signature?: AgentType        // 创建此节点的 Agent
  created_at?: string                // 创建时间
  updated_at?: string                // 更新时间
  tags?: string[]                    // 标签
}

// ============== 节点数据结构 ==============
export interface MacraNodeData {
  id: string
  type: NodeType
  label: string
  content: string                    // 支持 Markdown
  domain?: CCBMCDomain               // CC-BMC 维度（仅 cc-bmc-card 使用）
  metadata: NodeMetadata
  position?: { x: number; y: number }
  status?: 'idle' | 'processing' | 'done' | 'error'

  // Agent Avatar 特有字段
  agentType?: AgentType
  isInteractive?: boolean            // 是否可以点击对话

  // Conflict Alert 特有字段
  severity?: 'high' | 'medium' | 'low'
  conflictType?: 'resource-goal' | 'compliance-business' | 'channel-product' | 'other'
}

// ============== 边类型 ==============
export type EdgeType =
  | 'default'         // 默认连接
  | 'conflict'        // 冲突关系（红色闪电）
  | 'suggestion'      // 建议关系
  | 'dependency'      // 依赖关系
  | 'data-flow'       // 数据流向

export interface MacraEdgeData {
  source: string
  target: string
  label?: string
  type: EdgeType
  animated?: boolean
  style?: {
    stroke?: string
    strokeWidth?: number
    strokeDasharray?: string
  }
}

// ============== Canvas Action 类型 ==============
export type CanvasActionType =
  | 'create_node'
  | 'update_node'
  | 'delete_node'
  | 'create_edge'
  | 'delete_edge'
  | 'batch_update'

export interface CanvasAction {
  action: CanvasActionType
  data: MacraNodeData | MacraEdgeData | { nodeIds: string[] } | any
}

// ============== Orchestrator 响应结构 ==============
export interface OrchestratorResponse {
  thought_process: string                // AI 的思考过程描述
  canvas_actions: CanvasAction[]         // 画布操作列表
}

// ============== Conflict 检测结果 ==============
export interface ConflictDetection {
  source_node_id: string
  target_node_id: string
  severity: 'high' | 'medium' | 'low'
  reason: string                         // 冲突原因
  suggestion: string                     // 化解建议
  visualization: {
    action: 'create_edge'
    type: 'conflict-link'
    label: string
    style: {
      stroke: string
      strokeWidth: number
      animated: boolean
    }
  }
}

export interface CriticResponse {
  conflicts: ConflictDetection[] | null
}

// ============== Orchestrator Request ==============
export interface OrchestratorRequest {
  user_prompt: string                    // 用户输入
  canvas_summary: {                      // 当前画布状态简述
    nodes: Array<{
      id: string
      type: NodeType
      label: string
      content: string
      domain?: CCBMCDomain
    }>
    edges: Array<{
      source: string
      target: string
      type: EdgeType
    }>
  }
  mode?: 'seed' | 'completion' | 'general'  // 生成模式
}

// ============== Critic Request ==============
export interface CriticRequest {
  canvas_data: {
    nodes: MacraNodeData[]
    edges: MacraEdgeData[]
  }
}

// ============== 帮助函数类型 ==============
export interface LayoutPosition {
  x: number
  y: number
}

export type LayoutAlgorithm = 'dagre' | 'elk' | 'manual' | 'force'
