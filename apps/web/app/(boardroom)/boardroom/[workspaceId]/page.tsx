/**
 * Editorial Boardroom canvas page.
 *
 * Full-viewport ReactFlow canvas (BoardroomCanvas) with floating HUDs
 * (Masthead at top, Conductor at bottom). The (boardroom) route group
 * bypasses the (app) sidebar+header layout so the canvas owns 100vh.
 *
 * P2 (this commit): static demo data on the canvas — illustrates the
 * 9-cell BMC + 4 agent avatars + Osterwalder relationship edges.
 * P3 wires Yjs / GraphQL / agent stream as the data source.
 */

import { BoardroomCanvas } from '@/features/boardroom/components/boardroom-canvas'
import { FloatingMasthead, type AgentPresenceLite } from '@/features/boardroom/components/hud/floating-masthead'
import { FloatingConductor } from '@/features/boardroom/components/hud/floating-conductor'
import { StacksDrawer, type StacksKbDoc, type StacksCitation, type StacksMemoryItem } from '@/features/boardroom/components/hud/stacks-drawer'
import { WireDrawer, type WireDispatch, type WireDebate } from '@/features/boardroom/components/hud/wire-drawer'
import {
  INITIAL_BMC_NODES,
  INITIAL_AGENT_NODES,
  INITIAL_BMC_EDGES,
} from '@/features/boardroom/data/initial-bmc-layout'

interface PageProps {
  params: { workspaceId: string }
}

export default function BoardroomPage({ params }: PageProps) {
  const agents: AgentPresenceLite[] = [
    { id: 'market',  name: 'MARKET',  glyph: 'M', role: 'market',  status: 'active' },
    { id: 'product', name: 'PRODUCT', glyph: 'P', role: 'product', status: 'active' },
    { id: 'finance', name: 'FINANCE', glyph: 'F', role: 'finance', status: 'idle' },
    { id: 'critic',  name: 'CRITIC',  glyph: 'C', role: 'critic',  status: 'idle' },
  ]

  const allNodes = [...INITIAL_AGENT_NODES, ...INITIAL_BMC_NODES]

  // ─────────────────────────────────────────────────────────────────────
  // P2 demo data for the side drawers. P3 replaces these with subscriptions
  // to the live conversation stream (workspace KB + ConversationProgress
  // wire events + UserSkillExtractor memory items).
  // ─────────────────────────────────────────────────────────────────────

  const kbDocs: StacksKbDoc[] = [
    { id: 'stripe-pricing-2024',         title: 'Stripe Pricing Sheet 2024',       chunkCount: 7,  citedAs: [1, 2] },
    { id: 'stripe-banking-partners-2024', title: 'Stripe Banking Partners Memo',    chunkCount: 4,  citedAs: [4] },
    { id: 'stripe-investor-letter-2023',  title: 'Stripe FY-2023 Investor Letter',  chunkCount: 12, citedAs: [3] },
    { id: 'pcic-compliance-guide-v2',     title: 'PCI-DSS Compliance Guide v2',     chunkCount: 5,  citedAs: [] },
  ]

  const citations: StacksCitation[] = [
    { index: 1, docId: 'stripe-pricing-2024',         chunkId: 'chunk-1' },
    { index: 2, docId: 'stripe-pricing-2024',         chunkId: 'chunk-3' },
    { index: 3, docId: 'stripe-investor-letter-2023', chunkId: 'chunk-2' },
    { index: 4, docId: 'stripe-banking-partners-2024', chunkId: 'chunk-1' },
  ]

  const memory: StacksMemoryItem[] = [
    { id: 'm1', title: 'B2B SaaS PM 背景（5y）',  scope: 'user',      confidence: 0.85, byline: 'market'  },
    { id: 'm2', title: '回避定价讨论',             scope: 'user',      confidence: 0.80, byline: 'finance' },
    { id: 'm3', title: 'lean 启动·不打算融资',    scope: 'user',      confidence: 0.70, byline: 'finance' },
    { id: 'm4', title: '偏好 case study + 数字', scope: 'workspace', confidence: 0.55, byline: 'critic'  },
  ]

  const dispatches: WireDispatch[] = [
    {
      id: 'd1', occurredAt: '2026-05-01T12:34:00Z',
      agentId: 'orchestrator', agentName: 'ORCHESTRATOR', glyph: '◇', role: 'synthesizer',
      kind: 'phase', headline: '会话开启 · planning',
      body: '将"分析 Stripe 商业模式"分配给 market / product / finance 三个 generator agent。'
    },
    {
      id: 'd2', occurredAt: '2026-05-01T12:34:18Z',
      agentId: 'market-agent', agentName: 'MARKET-AGENT', glyph: 'M', role: 'market',
      kind: 'tool-call', body: 'customer-segments.cluster_personas(notes=[…], expected_clusters=3)'
    },
    {
      id: 'd3', occurredAt: '2026-05-01T12:34:30Z',
      agentId: 'market-agent', agentName: 'MARKET-AGENT', glyph: 'M', role: 'market',
      kind: 'dispatch', headline: 'CUSTOMER SEGMENTS 三聚类',
      body: '互联网原生企业 + 开发者团队 + 在线市场（SaaS / marketplaces / 平台公司）。基于 Stripe pricing 表与公司报告的客户画像聚类。',
      refs: ['stripe-pricing-2024#chunk-1', 'stripe-pricing-2024#chunk-3'],
    },
    {
      id: 'd4', occurredAt: '2026-05-01T12:35:01Z',
      agentId: 'product-agent', agentName: 'PRODUCT-AGENT', glyph: 'P', role: 'product',
      kind: 'dispatch', headline: 'KEY ACTIVITIES',
      body: '支付基础设施、合规、反欺诈（Radar）、开发者体验（SDK / 文档）。',
    },
    {
      id: 'd5', occurredAt: '2026-05-01T12:35:25Z',
      agentId: 'finance-agent', agentName: 'FINANCE-AGENT', glyph: 'F', role: 'finance',
      kind: 'dispatch', headline: 'REVENUE STREAMS · 2.9% + $0.30',
      body: 'mid-band 交易费 · 国际附加费 · 企业级订阅 (Enterprise tier)。',
      refs: ['stripe-investor-letter-2023#chunk-2'],
    },
    {
      id: 'd6', occurredAt: '2026-05-01T12:35:48Z',
      agentId: 'critic-agent', agentName: 'CRITIC', glyph: 'C', role: 'critic',
      kind: 'dispatch', headline: '高严重冲突 · 定价 ↔ 客户结构',
      body: 'mid-band 定价对开发者亲和（CS 命中），但与"互联网原生企业"中部分大客户的 enterprise 折扣需求构成内部不一致。建议 product / finance 协调。',
    },
  ]

  // P2 demo: surface a debate row to show the dual-column treatment.
  const debate: WireDebate = {
    id: 'debate-1',
    active: true,
    topic: '是否上调 enterprise tier 定价？',
    claimant: {
      id: 'dt-1', occurredAt: '2026-05-01T12:35:55Z',
      agentId: 'market-agent', agentName: 'MARKET', glyph: 'M', role: 'market',
      kind: 'debate-turn',
      body: 'enterprise 客户 LTV 高、价格不敏感。提价 15% 几乎不影响留存（基于行业基准）。',
    },
    opponent: {
      id: 'dt-2', occurredAt: '2026-05-01T12:36:02Z',
      agentId: 'market-opponent', agentName: 'MKT-OPP', glyph: 'M', role: 'critic',
      kind: 'debate-turn',
      body: '提价 15% 触发 RFP 重审 + 竞品（Adyen）跟价压力。短期 ARR 涨，6-12 月留存可能跌 8%。',
    },
  }

  return (
    <div className="h-screen w-screen bg-ink overflow-hidden">
      <FloatingMasthead
        workspaceName={params.workspaceId.toUpperCase()}
        edition="VOL II · ISSUE 28 · 2026-05-01"
        agents={agents}
      />
      <BoardroomCanvas
        initialNodes={allNodes}
        initialEdges={INITIAL_BMC_EDGES}
      />
      {/* Drawers default collapsed so the canvas owns the visual frame.
          User pulls them open via the edge tab when they want to consult
          references or follow the live wire. */}
      <StacksDrawer kbDocs={kbDocs} citations={citations} memory={memory} defaultOpen={false} />
      <WireDrawer dispatches={dispatches} debate={debate} defaultOpen={false} />
      <FloatingConductor
        phase="execution"
        round={1}
        tokenUsage="3.5k / 200k"
        elapsedSec={47}
      />
    </div>
  )
}
