/**
 * Editorial Boardroom v2 demo route.
 *
 * Lives alongside the existing /workspace/[workspaceId]/canvas page so
 * the user can A/B compare the redesign without affecting production
 * surfaces. P3 will swap the placeholder content for real data sources.
 *
 * URL: /workspace/<id>/v2
 */

import { BoardroomShell } from '@/shared/layout/boardroom-shell'
import { Masthead, type AgentPresence } from '@/shared/layout/masthead'
import { Frontpage, type BmcCell } from '@/shared/layout/frontpage'
import { Wire, type WireDispatch } from '@/shared/layout/wire'
import { Stacks, type StackEntry } from '@/shared/layout/stacks'
import { Conductor } from '@/shared/layout/conductor'

interface PageProps {
  params: { workspaceId: string }
}

export default function WorkspaceV2Page({ params }: PageProps) {
  // ──────────────────────────────────────────────────────────────────
  // P2 placeholder data — illustrates the layout. P3 replaces with the
  // real Yjs / GraphQL / agent stream sources.
  // ──────────────────────────────────────────────────────────────────

  const agents: AgentPresence[] = [
    { id: 'market',  name: 'MARKET',  initial: 'M', role: 'market',  status: 'active' },
    { id: 'product', name: 'PRODUCT', initial: 'P', role: 'product', status: 'active' },
    { id: 'finance', name: 'FINANCE', initial: 'F', role: 'finance', status: 'idle' },
    { id: 'critic',  name: 'CRITIC',  initial: 'C', role: 'critic',  status: 'idle' },
  ]

  const bmcCells: BmcCell[] = [
    {
      dim: 'CS',
      label: '客户细分',
      byline: 'market',
      attribution: 'market-agent · 12:34',
      content: '互联网原生企业 + 开发者团队 + 在线市场。 [1] [2]',
    },
    {
      dim: 'VP',
      label: '价值主张',
      byline: 'product',
      attribution: 'product-agent · 12:35',
      content: '30 分钟集成、API-first、全球 135+ 货币、PCI 合规免责。 [3]',
    },
    {
      dim: 'CH',
      label: '渠道通路',
      byline: 'market',
      content: '自助 onboarding + 文档 + 集成市场。',
    },
    {
      dim: 'CR',
      label: '客户关系',
      byline: 'market',
      content: '自服务 + 开发者社区 + 分级支持。',
    },
    {
      dim: 'KP',
      label: '重要合作',
      byline: 'product',
      content: '卡组织（Visa / MC / JCB）、收单银行（Goldfinch 等）。 [4]',
    },
    {
      dim: 'KA',
      label: '关键业务',
      byline: 'product',
      content: '支付基础设施 + 合规 + 反欺诈（Radar）。',
    },
    {
      dim: 'KR',
      label: '核心资源',
      byline: 'product',
      content: '工程团队、卡网络许可、银行合作网络。',
    },
    {
      dim: 'COST',
      label: '成本结构',
      byline: 'finance',
      content: '交换费 (interchange, dominant) · 工程薪资 · 合规 · 服务器。',
    },
    {
      dim: 'REVENUE',
      label: '收入来源',
      byline: 'finance',
      content: '交易费 2.9% + $0.30 (mid-band) · 国际附加费 · 企业级订阅。',
    },
  ]

  const dispatches: WireDispatch[] = [
    {
      id: '1',
      occurredAt: '2026-05-01T12:34:18Z',
      agentName: 'MARKET',
      role: 'market',
      kind: 'claim',
      body: '目标客群是 internet-native 企业 + 开发者，而非传统 retail。规模约 2M 在线商户。',
      citations: ['stripe-pricing-2024#1'],
    },
    {
      id: '2',
      occurredAt: '2026-05-01T12:34:55Z',
      agentName: 'PRODUCT',
      role: 'product',
      kind: 'claim',
      body: 'Value prop 核心是 developer experience — 30min integration、SDK 覆盖 12 语言。Radar / Connect / Billing 是延伸。',
    },
    {
      id: '3',
      occurredAt: '2026-05-01T12:35:30Z',
      agentName: 'CRITIC',
      role: 'critic',
      kind: 'rebuttal',
      body: '"30min integration" 是营销口径，benchmark 显示中位数约 4.5h。建议 product-agent 引用真实数据。',
    },
  ]

  const stackEntries: StackEntry[] = [
    {
      index: 1,
      docId: 'stripe-pricing-2024',
      chunkId: 'chunk-1',
      excerpt: 'Stripe charges 2.9% + $0.30 per successful card transaction; international cards add 1.5%.',
    },
    {
      index: 2,
      docId: 'stripe-customers-2024',
      chunkId: 'chunk-2',
      excerpt: 'Stripe serves 2M+ businesses globally; primary segments are SaaS, marketplaces, and platforms.',
    },
    {
      index: 3,
      docId: 'stripe-product-vp-2024',
      chunkId: 'chunk-7',
      excerpt: 'API-first integration enables developers to take their first payment in under 30 minutes...',
    },
    {
      index: 4,
      docId: 'stripe-banking-partners-2024',
      chunkId: 'chunk-3',
      excerpt: 'Banking partners include Goldfinch Bank, Wells Fargo, and a network spanning 40+ countries.',
    },
  ]

  return (
    <BoardroomShell
      masthead={
        <Masthead
          workspaceName={`Workspace · ${params.workspaceId}`}
          edition="Vol II · Issue 28 · 2026-05-01"
          agents={agents}
        />
      }
      stacks={<Stacks entries={stackEntries} />}
      frontpage={<Frontpage cells={bmcCells} />}
      wire={<Wire dispatches={dispatches} />}
      conductor={
        <Conductor
          phase="execution"
          round={1}
          tokenUsage="3.5k / 200k"
          elapsedSec={47}
        />
      }
    />
  )
}
