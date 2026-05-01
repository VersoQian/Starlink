/**
 * Canonical Osterwalder BMC layout — initial node positions for the
 * boardroom canvas.
 *
 * Coordinate system: React Flow uses CSS-style (x: right+, y: down+).
 * We place 9 BMC cells in a 5×3 grid with cell width 280 + gap 32 px.
 *   col widths : 5 × (280 + 32) - 32 = 1528 px total
 *   row heights: KP/VP/CS span 2 rows; others 1 row
 *
 * The user can drag any cell elsewhere — the initial layout is just a
 * "the boardroom opens here" placement, NOT a fixed BMC grid.
 */

import type { Node, Edge } from 'reactflow'
import type { BmcCellNodeData } from '../components/nodes/bmc-cell-node'
import type { AgentAvatarNodeData } from '../components/nodes/agent-avatar-node'

const CELL_W = 280
const ROW_H = 220   // tall enough for header + body + footer; rough fit
const GAP   = 32

// 5 columns, indexed 0..4, x positions:
const COL_X = Array.from({ length: 5 }, (_, i) => i * (CELL_W + GAP))
// 3 rows (top half row1+row2, bottom half row3), y positions:
const ROW_Y = [0, ROW_H + GAP, (ROW_H + GAP) * 2]

export const INITIAL_BMC_NODES: Node<BmcCellNodeData>[] = [
  // ROW 1
  {
    id: 'kp',
    type: 'bmcCell',
    position: { x: COL_X[0], y: ROW_Y[0] },
    data: {
      dim: 'KP',
      label: 'KEY PARTNERSHIPS',
      byline: 'product',
      bylineGlyph: 'P',
      agentId: 'product-agent',
      occurredAt: '2026-05-01T12:35:18Z',
      confidence: 'mid',
      content: '卡组织（Visa / MC / JCB）、收单银行（Goldfinch 等）、合规咨询、欺诈风控供应商。',
      citations: [4],
    },
    // KP is canonically tall — span 2 rows worth of vertical space
    style: { height: ROW_H * 2 + GAP },
  },
  {
    id: 'ka',
    type: 'bmcCell',
    position: { x: COL_X[1], y: ROW_Y[0] },
    data: {
      dim: 'KA',
      label: 'KEY ACTIVITIES',
      byline: 'product',
      bylineGlyph: 'P',
      agentId: 'product-agent',
      occurredAt: '2026-05-01T12:35:01Z',
      confidence: 'high',
      content: '支付基础设施 + 合规 + 反欺诈（Radar）+ 开发者体验（SDK / Docs）。',
    },
  },
  {
    id: 'vp',
    type: 'bmcCell',
    position: { x: COL_X[2], y: ROW_Y[0] },
    data: {
      dim: 'VP',
      label: 'VALUE PROPS',
      byline: 'product',
      bylineGlyph: 'P',
      agentId: 'product-agent',
      occurredAt: '2026-05-01T12:34:55Z',
      confidence: 'high',
      content: 'API-first + 30 分钟集成 + 全球 135 货币 + PCI 合规免责。开发者优先的支付栈。',
      citations: [3],
    },
    style: { height: ROW_H * 2 + GAP },
  },
  {
    id: 'cr',
    type: 'bmcCell',
    position: { x: COL_X[3], y: ROW_Y[0] },
    data: {
      dim: 'CR',
      label: 'CUSTOMER RELS',
      byline: 'market',
      bylineGlyph: 'M',
      agentId: 'market-agent',
      occurredAt: '2026-05-01T12:34:30Z',
      confidence: 'mid',
      content: '自服务 + 开发者社区 + 分级支持（Starter / Scale / Enterprise）。',
    },
  },
  {
    id: 'cs',
    type: 'bmcCell',
    position: { x: COL_X[4], y: ROW_Y[0] },
    data: {
      dim: 'CS',
      label: 'CUSTOMER SEGS',
      byline: 'market',
      bylineGlyph: 'M',
      agentId: 'market-agent',
      occurredAt: '2026-05-01T12:34:18Z',
      confidence: 'high',
      content: '互联网原生企业 + 开发者团队 + 在线市场（SaaS / marketplaces / 平台）。',
      citations: [1, 2],
    },
    style: { height: ROW_H * 2 + GAP },
  },

  // ROW 2 — middle column
  {
    id: 'kr',
    type: 'bmcCell',
    position: { x: COL_X[1], y: ROW_Y[1] },
    data: {
      dim: 'KR',
      label: 'KEY RESOURCES',
      byline: 'product',
      bylineGlyph: 'P',
      agentId: 'product-agent',
      occurredAt: '2026-05-01T12:35:10Z',
      confidence: 'high',
      content: '工程团队、卡网络许可证、银行合作网络（40+ 国家）。',
      citations: [4],
    },
  },
  {
    id: 'ch',
    type: 'bmcCell',
    position: { x: COL_X[3], y: ROW_Y[1] },
    data: {
      dim: 'CH',
      label: 'CHANNELS',
      byline: 'market',
      bylineGlyph: 'M',
      agentId: 'market-agent',
      occurredAt: '2026-05-01T12:34:42Z',
      confidence: 'mid',
      content: '自助 onboarding + 文档驱动 + 集成市场 + 合作伙伴渠道。',
    },
  },

  // ROW 3 — full-width bottom
  {
    id: 'cost',
    type: 'bmcCell',
    position: { x: COL_X[0], y: ROW_Y[2] },
    data: {
      dim: 'COST',
      label: 'COST STRUCTURE',
      byline: 'finance',
      bylineGlyph: 'F',
      agentId: 'finance-agent',
      occurredAt: '2026-05-01T12:35:32Z',
      confidence: 'mid',
      content: '交换费 (interchange, dominant) · 工程薪资 · 合规 + KYC · 服务器与带宽。',
    },
    style: { width: CELL_W * 2 + GAP },
  },
  {
    id: 'revenue',
    type: 'bmcCell',
    position: { x: COL_X[2], y: ROW_Y[2] },
    data: {
      dim: 'REVENUE',
      label: 'REVENUE STREAMS',
      byline: 'finance',
      bylineGlyph: 'F',
      agentId: 'finance-agent',
      occurredAt: '2026-05-01T12:35:25Z',
      confidence: 'high',
      content: '交易费 2.9% + $0.30 (mid-band) · 国际附加费 · 企业级订阅 (Enterprise).',
    },
    style: { width: CELL_W * 3 + GAP * 2 },
  },
]

// Agent avatars — placed in a "press box" above the BMC, off to the side
// so they don't block the cells. Vertical column on the left, vertically
// centered against the top half of the BMC.
const AVATAR_X = -160
const AVATAR_GAP = 16

export const INITIAL_AGENT_NODES: Node<AgentAvatarNodeData>[] = [
  {
    id: 'agent-market',
    type: 'agentAvatar',
    position: { x: AVATAR_X, y: ROW_Y[0] },
    data: { agentId: 'market-agent', name: 'MARKET',  glyph: 'M', role: 'market',  status: 'active' },
  },
  {
    id: 'agent-product',
    type: 'agentAvatar',
    position: { x: AVATAR_X, y: ROW_Y[0] + 140 + AVATAR_GAP },
    data: { agentId: 'product-agent', name: 'PRODUCT', glyph: 'P', role: 'product', status: 'active' },
  },
  {
    id: 'agent-finance',
    type: 'agentAvatar',
    position: { x: AVATAR_X, y: ROW_Y[0] + (140 + AVATAR_GAP) * 2 },
    data: { agentId: 'finance-agent', name: 'FINANCE', glyph: 'F', role: 'finance', status: 'idle' },
  },
  {
    id: 'agent-critic',
    type: 'agentAvatar',
    position: { x: AVATAR_X, y: ROW_Y[0] + (140 + AVATAR_GAP) * 3 },
    data: { agentId: 'critic-agent', name: 'CRITIC', glyph: 'C', role: 'critic', status: 'idle' },
  },
]

// Edges expressing canonical BMC relationships (Osterwalder).
// 1.5 px ash-2 stroke, no animation, simple label.
export const INITIAL_BMC_EDGES: Edge[] = [
  { id: 'e-vp-cs',   source: 'vp',  target: 'cs',  label: '服务于', sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-ch-cs',   source: 'ch',  target: 'cs',  label: '触达',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-cr-cs',   source: 'cr',  target: 'cs',  label: '维系',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-kr-vp',   source: 'kr',  target: 'vp',  label: '支撑',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-ka-vp',   source: 'ka',  target: 'vp',  label: '创造',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-kp-ka',   source: 'kp',  target: 'ka',  label: '提供',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-kp-kr',   source: 'kp',  target: 'kr',  label: '提供',   sourceHandle: 'r', targetHandle: 'l-target' },
  { id: 'e-cs-rev',  source: 'cs',  target: 'revenue', label: '带来', sourceHandle: 'b', targetHandle: 't-target' },
  { id: 'e-kr-cost', source: 'kr',  target: 'cost', label: '产生',   sourceHandle: 'b', targetHandle: 't-target' },
  { id: 'e-ka-cost', source: 'ka',  target: 'cost', label: '产生',   sourceHandle: 'b', targetHandle: 't-target' },
]
