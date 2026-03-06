import type { WorkspaceGraphResponse } from '@/types/graph'
import { AGENT_TYPES } from '@/types/macra'

export type AgentContributionStage = 'planning' | 'execution' | 'review' | 'decision'

export type AgentContribution = {
  nodeId: string
  title: string
  content: string
  domain?: string
  confidence?: string
  macraType?: string
  stage: AgentContributionStage
  positionY: number
}

export type AgentSnapshot = {
  id: string
  name: string
  role: string
  perspective: string
  accent: string
  contributions: AgentContribution[]
  domains: string[]
}

export type AgentWorkspaceSnapshot = {
  workspaceId: string
  nodeCount: number
  edgeCount: number
  agents: AgentSnapshot[]
}

export type SeminarSnapshot = {
  planning: AgentContribution[]
  execution: AgentContribution[]
  review: AgentContribution[]
  decision: AgentContribution[]
  openingStatements: Array<{ agentId: string; agentName: string; summary: string }>
  finalRecommendation: string
}

type AgentProfile = Omit<AgentSnapshot, 'contributions' | 'domains'>

type NodeMeta = {
  macraType?: string
  domain?: string
  metadata?: {
    agent_signature?: string
    confidence?: string
  }
  agentType?: string
}

type NodeDataShape = {
  title?: string
  content?: string
  meta?: NodeMeta
}

const AGENT_PROFILES: Record<string, AgentProfile> = {
  [AGENT_TYPES.ORCHESTRATOR]: {
    id: AGENT_TYPES.ORCHESTRATOR,
    name: '总协调 Agent',
    role: '任务规划与收敛',
    perspective: '负责任务拆解、阶段目标和最终决策收敛',
    accent: '#6366f1'
  },
  [AGENT_TYPES.MARKET]: {
    id: AGENT_TYPES.MARKET,
    name: '市场 Agent',
    role: '市场与客户洞察',
    perspective: '聚焦客户细分、渠道和竞争格局',
    accent: '#f59e0b'
  },
  [AGENT_TYPES.PRODUCT]: {
    id: AGENT_TYPES.PRODUCT,
    name: '产品 Agent',
    role: '价值主张与交付',
    perspective: '聚焦价值主张、关键活动和能力配置',
    accent: '#10b981'
  },
  [AGENT_TYPES.FINANCE]: {
    id: AGENT_TYPES.FINANCE,
    name: '财务 Agent',
    role: '收益与成本模型',
    perspective: '聚焦收入来源、成本结构与财务可行性',
    accent: '#0ea5e9'
  },
  [AGENT_TYPES.CRITIC]: {
    id: AGENT_TYPES.CRITIC,
    name: '质询 Agent',
    role: '冲突识别与反证',
    perspective: '识别逻辑冲突、证据缺口和执行风险',
    accent: '#ef4444'
  }
}

function getProfile(agentId: string): AgentProfile {
  return (
    AGENT_PROFILES[agentId] ?? {
      id: agentId,
      name: agentId,
      role: '专项分析',
      perspective: '围绕其负责维度提供分析结论',
      accent: '#64748b'
    }
  )
}

function inferAgentId(node: WorkspaceGraphResponse['nodes'][number]): string | null {
  const data = node.data as NodeDataShape | undefined
  const meta = data?.meta
  if (meta?.metadata?.agent_signature) {
    return meta.metadata.agent_signature
  }
  if (meta?.agentType) {
    return meta.agentType
  }
  return null
}

function classifyStage(agentId: string, macraType?: string, title = '', content = ''): AgentContributionStage {
  const haystack = `${title}\n${content}`
  if (agentId === AGENT_TYPES.CRITIC || macraType === 'conflict-alert') {
    return 'review'
  }
  if (agentId === AGENT_TYPES.ORCHESTRATOR) {
    if (/规划|计划|路线|拆解|阶段|里程碑/.test(haystack)) {
      return 'planning'
    }
    return 'decision'
  }
  return 'execution'
}

function toContribution(node: WorkspaceGraphResponse['nodes'][number], agentId: string): AgentContribution {
  const data = (node.data ?? {}) as NodeDataShape
  const meta = data.meta
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : node.id
  const content = typeof data.content === 'string' ? data.content : ''

  return {
    nodeId: node.id,
    title,
    content,
    domain: meta?.domain,
    confidence: meta?.metadata?.confidence,
    macraType: meta?.macraType,
    stage: classifyStage(agentId, meta?.macraType, title, content),
    positionY: node.position?.y ?? 0
  }
}

export function buildAgentWorkspaceSnapshot(graph: WorkspaceGraphResponse): AgentWorkspaceSnapshot {
  const grouped = new Map<string, AgentContribution[]>()

  for (const node of graph.nodes) {
    const agentId = inferAgentId(node)
    if (!agentId) continue
    const contribution = toContribution(node, agentId)
    const current = grouped.get(agentId) ?? []
    current.push(contribution)
    grouped.set(agentId, current)
  }

  const agents = [...grouped.entries()]
    .map(([agentId, contributions]) => {
      const profile = getProfile(agentId)
      const sorted = [...contributions].sort((a, b) => a.positionY - b.positionY)
      const domains = [...new Set(sorted.map((item) => item.domain).filter(Boolean) as string[])]

      return {
        ...profile,
        contributions: sorted,
        domains
      } satisfies AgentSnapshot
    })
    .sort((a, b) => b.contributions.length - a.contributions.length)

  return {
    workspaceId: graph.workspaceId,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    agents
  }
}

export function buildSeminarSnapshot(snapshot: AgentWorkspaceSnapshot): SeminarSnapshot {
  const planning = snapshot.agents.flatMap((agent) => agent.contributions.filter((item) => item.stage === 'planning'))
  const execution = snapshot.agents.flatMap((agent) => agent.contributions.filter((item) => item.stage === 'execution'))
  const review = snapshot.agents.flatMap((agent) => agent.contributions.filter((item) => item.stage === 'review'))
  const decision = snapshot.agents.flatMap((agent) => agent.contributions.filter((item) => item.stage === 'decision'))

  const openingStatements = snapshot.agents
    .map((agent) => {
      const first = agent.contributions.find((item) => item.stage === 'execution') ?? agent.contributions[0]
      if (!first) return null
      return {
        agentId: agent.id,
        agentName: agent.name,
        summary: first.content || first.title
      }
    })
    .filter(Boolean) as Array<{ agentId: string; agentName: string; summary: string }>

  const finalDecision = decision[decision.length - 1]?.content ?? decision[decision.length - 1]?.title
  const fallbackDecision = execution[execution.length - 1]?.content ?? '等待执行阶段产出后生成决策结论。'

  return {
    planning,
    execution,
    review,
    decision,
    openingStatements,
    finalRecommendation: finalDecision || fallbackDecision
  }
}

