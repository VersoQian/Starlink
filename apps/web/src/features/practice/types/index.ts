// 场景定义
export type Scenario = {
  id: string
  title: string
  category: string
  description: string
  goal: string
  level: string
  samplePrompts: string[]
}

// 消息类型
export type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  feedback?: string // 实时反馈（用于 AI 回复）
}

// 洞察类型
export type Insight = {
  title: string
  detail: string
}

// 资源类型
export type Resource = {
  title: string
  url?: string
}

// 失败案例类型
export type FailureCase = {
  id: string
  title: string
  scenario: string // 场景类型（如：中国谈判、韩国演示等）
  mistake: string // 错误行为
  consequence: string // 后果
  correction: string // 正确做法
  severity: 'high' | 'medium' | 'low' // 严重程度
}

// 模拟会话类型
export type SimulationSession = {
  id: string
  scenarioId: string
  messages: Message[]
  createdAt: number
}

// API响应类型
export type SimulationResponse = {
  scenario: Scenario
  reply: string
  feedback?: string // AI 对当前回复的评价反馈
  insights: Insight[]
  resources: Resource[]
  quickReplies: string[]
}

// API请求类型
export type SimulationRequest = {
  scenarioId: string
  message: string
  history: Array<{ role: string; content: string }>
}
