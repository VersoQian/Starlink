/**
 * demo-canvas-synth — local fallback that synthesizes a believable BMC
 * canvas from a seed string. Used when the GraphQL backend is offline
 * (ECONNREFUSED) so users can still preview the v2 light canvas with
 * actual nodes / drawer / chat / citation panels populated.
 *
 * Generates:
 *   - 6 cc-bmc-card nodes (one per BMC dimension shown in the layout)
 *   - 1 conflict-alert node (so right-panel "实时冲突" lights up)
 *   - 1 agent-avatar node (so user can click and chat with it)
 *   - 4 edges connecting cards + critic
 *   - 3 knowledgeEvidence entries (so citation panel shows sources)
 *
 * Pure function — returns the data; callers wire it into the comfy store.
 */

import type { Node, Edge } from 'reactflow'
import type { MacraNodeData } from '@/types/macra'

export type DemoSynthResult = {
  nodes: Node[]
  edges: Edge[]
  macraNodes: Map<string, MacraNodeData>
  knowledgeEvidence: Array<{
    id: string
    docId: string
    title: string
    snippet: string
    score: number
  }>
  chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>
}

const POSITIONS = {
  customerSegments:      { x:  120, y:   80 },
  valueProp:             { x:  680, y:  120 },
  channels:              { x:  120, y:  340 },
  revenueStreams:        { x: 1100, y:  340 },
  costStructure:         { x:  120, y:  600 },
  keyResources:          { x:  680, y:  600 },
  conflict:              { x: 1100, y:   80 },
  marketAgent:           { x: 1480, y:  340 },
}

export function synthesizeDemoCanvas(seed: string): DemoSynthResult {
  const trimmed = seed.trim() || '面向 B2B SaaS 的实时数据可视化产品'
  const stamp = Date.now()

  const cards: Array<{
    id: string
    domain: string
    title: string
    summary: string
    fullContent: string
    position: { x: number; y: number }
    agent: 'market' | 'product' | 'finance'
    citationDoc?: string
  }> = [
    {
      id: `bmc-cs-${stamp}`,
      domain: '客户细分',
      title: '目标客户画像',
      summary: `${trimmed} 的核心客户可能是\n中型 B2B SaaS 团队（50-500 人），关注数据驱动决策的 PM / 数据分析师 / 业务负责人。`,
      fullContent: '',
      position: POSITIONS.customerSegments,
      agent: 'market',
      citationDoc: 'doc-saas-buyer-2025',
    },
    {
      id: `bmc-vp-${stamp}`,
      domain: '价值主张',
      title: '核心价值主张',
      summary: '把分散在飞书/钉钉/Excel 的业务指标在一张实时画布上聚合，30 秒内拿到\n"现在哪个业务出问题了"的判断，比人工拼表快 10 倍以上。',
      fullContent: '',
      position: POSITIONS.valueProp,
      agent: 'product',
      citationDoc: 'doc-stripe-pricing-page',
    },
    {
      id: `bmc-ch-${stamp}`,
      domain: '渠道通路',
      title: '触达渠道',
      summary: 'PLG 优先：免费 14 天试用 + 知乎/即刻 内容运营 + 36kr 投放\n企业版通过销售直接对接 CIO/CTO。',
      fullContent: '',
      position: POSITIONS.channels,
      agent: 'market',
    },
    {
      id: `bmc-rev-${stamp}`,
      domain: '收入来源',
      title: '订阅 + 用量分层',
      summary: '按用户席位月费 ¥99/seat/月（团队版）+ 大型企业按数据量阶梯定价\n（5GB / 20GB / 无限）+ 一次性实施服务费。',
      fullContent: '',
      position: POSITIONS.revenueStreams,
      agent: 'finance',
      citationDoc: 'doc-stripe-pricing-page',
    },
    {
      id: `bmc-cost-${stamp}`,
      domain: '成本结构',
      title: '主要成本',
      summary: '云基础设施（按用量约 35%）+ 工程团队（45%）+ 销售/市场（15%）\n其余为 G&A。前 18 个月以工程为主。',
      fullContent: '',
      position: POSITIONS.costStructure,
      agent: 'finance',
    },
    {
      id: `bmc-kr-${stamp}`,
      domain: '核心资源',
      title: '关键资源与能力',
      summary: '自研流式数据引擎 + 与 30+ SaaS 工具的连接器生态 + 数据可视化 design system。\n竞争壁垒在引擎延迟与连接器覆盖度。',
      fullContent: '',
      position: POSITIONS.keyResources,
      agent: 'product',
    },
  ]

  const conflict = {
    id: `conflict-${stamp}`,
    title: '定价模型 vs 早期 PLG 渗透',
    severity: 'high' as const,
    conflictType: 'channel-product' as const,
    content:
      '**Critic 检出**：Finance Agent 提议的「席位月费 ¥99」对早期 PLG 渠道获客价格敏感度过高，可能拉低 Trial→Paid 转化。\n\n建议：**前 6 个月** 推免费版 + 价值阈值触发付费，**12 个月后** 再切到 ¥99/seat。',
    position: POSITIONS.conflict,
  }

  const agent = {
    id: `agent-market-${stamp}`,
    title: '市场分析专家',
    agentType: 'market' as const,
    description: '客户、渠道、关系分析',
    position: POSITIONS.marketAgent,
  }

  // ReactFlow nodes
  const reactFlowNodes: Node[] = [
    ...cards.map((c) => ({
      id: c.id,
      type: 'cc-bmc-card',
      position: c.position,
      data: {
        title: c.title,
        content: c.summary,
        meta: {
          macraType: 'cc-bmc-card',
          summary: c.summary,
          fullContent: c.fullContent || c.summary,
          domain: c.domain,
          metadata: {
            source: 'AI Synthesis · 演示模式',
            agent_signature: c.agent === 'market' ? 'Market_Agent' : c.agent === 'product' ? 'Product_Agent' : 'Finance_Agent',
          },
        },
      },
    })),
    {
      id: conflict.id,
      type: 'conflict-alert',
      position: conflict.position,
      data: {
        title: conflict.title,
        content: conflict.content,
        meta: {
          macraType: 'conflict-alert',
          severity: conflict.severity,
          conflictType: conflict.conflictType,
        },
      },
    },
    {
      id: agent.id,
      type: 'agent-avatar',
      position: agent.position,
      data: {
        title: agent.title,
        meta: {
          macraType: 'agent-avatar',
          agentType: agent.agentType,
          isInteractive: true,
        },
      },
    },
  ]

  // Edges connecting BMC cards + conflict to revenue card + critic to agent
  const edges: Edge[] = [
    { id: `e-cs-vp-${stamp}`, source: cards[0].id, target: cards[1].id, type: 'smoothstep' },
    { id: `e-ch-vp-${stamp}`, source: cards[2].id, target: cards[1].id, type: 'smoothstep' },
    { id: `e-vp-rev-${stamp}`, source: cards[1].id, target: cards[3].id, type: 'smoothstep' },
    { id: `e-rev-cost-${stamp}`, source: cards[3].id, target: cards[4].id, type: 'smoothstep' },
    { id: `e-vp-kr-${stamp}`, source: cards[1].id, target: cards[5].id, type: 'smoothstep' },
    { id: `e-conf-rev-${stamp}`, source: conflict.id, target: cards[3].id, type: 'smoothstep' },
    { id: `e-agent-cs-${stamp}`, source: agent.id, target: cards[0].id, type: 'smoothstep' },
  ]

  // macraNodes map
  const macraNodes = new Map<string, MacraNodeData>()
  cards.forEach((c) => {
    macraNodes.set(c.id, {
      id: c.id,
      type: 'cc-bmc-card',
      label: c.title,
      content: c.summary,
      summary: c.summary,
      fullContent: c.fullContent || c.summary,
      domain: c.domain as MacraNodeData['domain'],
      agentType: c.agent === 'market' ? 'market-agent' : c.agent === 'product' ? 'product-agent' : 'finance-agent',
      metadata: {
        source: 'AI Synthesis · 演示模式',
        agent_signature: c.agent === 'market' ? 'Market_Agent' : c.agent === 'product' ? 'Product_Agent' : 'Finance_Agent',
      },
      position: c.position,
    } as MacraNodeData)
  })
  macraNodes.set(conflict.id, {
    id: conflict.id,
    type: 'conflict-alert',
    label: conflict.title,
    content: conflict.content,
    summary: conflict.content,
    fullContent: conflict.content,
    severity: conflict.severity,
    conflictType: conflict.conflictType,
    metadata: { agent_signature: 'Critic_Agent' },
    position: conflict.position,
  } as MacraNodeData)
  macraNodes.set(agent.id, {
    id: agent.id,
    type: 'agent-avatar',
    label: agent.title,
    content: agent.description,
    summary: agent.description,
    fullContent: agent.description,
    agentType: 'market-agent',
    isInteractive: true,
    metadata: {},
    position: agent.position,
  } as MacraNodeData)

  // Knowledge evidence (citation panel population)
  const knowledgeEvidence = [
    {
      id: 'doc-saas-buyer-2025',
      docId: 'doc-saas-buyer-2025',
      title: '2025 中型 SaaS 买家行为报告',
      snippet: '50-500 人企业在 SaaS 采购上更看重 PLG 试用体验与 30 天内的 ROI 证据，付费转化窗口为试用第 7-14 天。',
      score: 0.87,
    },
    {
      id: 'doc-stripe-pricing-page',
      docId: 'doc-stripe-pricing-page',
      title: 'Stripe 定价方法论：使用量+席位双轨',
      snippet: 'Stripe 的开发者订阅采用使用量定价，企业版增加按席位分层的固定费率，二者结合在年化 ARR 上比单一模型平均高 41%。',
      score: 0.79,
    },
    {
      id: 'doc-yc-w24-data-saas',
      docId: 'doc-yc-w24-data-saas',
      title: 'YC W24 数据可视化赛道公司清单',
      snippet: 'YC W24 投了 11 家做实时数据 / BI / 可视化方向的初创，平均估值 ¥18M，多数走 PLG + 大型企业销售双轨。',
      score: 0.71,
    },
  ]

  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: trimmed },
    {
      role: 'assistant',
      content: `已根据「${trimmed}」生成初始 BMC，但在画下你的商业版图前我想先反问你三个问题——这是你最容易跳过、却最决定后续推演走得多远的部分：\n\n**1. 客户细分真伪检验**\n你写下的"中型 B2B SaaS 团队"——他们最近一次主动找解决方案是因为什么具体事件？（如果想不到，那可能是你想让他们成为客户，而不是他们正要找你）\n\n**2. 价值主张反向证伪**\n如果"30 秒拿到判断"这个价值真的成立，为什么 2025 之前的 BI 工具没把它做出来？技术不够？认知不到？还是市场愿付价格不够？\n\n**3. 收入模型自洽性**\n席位月费 ¥99 × 早期 PLG → critic 已检出冲突。在你心里，PLG 渗透优先 vs 单位经济模型立得住，哪个对早期更重要？为什么？\n\n_（演示模式：本地合成 Socratic 回复；server + PG 起来后接真 ideation-coach pipeline）_`,
    },
  ]

  return {
    nodes: reactFlowNodes,
    edges,
    macraNodes,
    knowledgeEvidence,
    chatMessages,
  }
}
