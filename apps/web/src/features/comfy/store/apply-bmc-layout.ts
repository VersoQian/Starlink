/**
 * Override node positions to the canonical BMC 9-cell layout, instead
 * of trusting the single-column layout the server emits.
 *
 *   ┌─────────┬───────────┬───────────┬───────────┬───────────┐
 *   │   KP    │     KA    │     VP    │     CR    │     CS    │
 *   │         ├───────────┤           ├───────────┤           │
 *   │ (tall)  │     KR    │  (tall)   │     CH    │  (tall)   │
 *   ├─────────┴───────────┴───────────┴───────────┴───────────┤
 *   │                COST                │      REV          │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ CONFLICT-1   CONFLICT-2   CONFLICT-3   CONFLICT-4 ...   │  ← conflicts row
 *   └──────────────────────────────────────────────────────────┘
 *
 * Header strip (above row 1): root + insight notes.
 * Right column: agent avatars (market / product / finance).
 * Below bottom row: critic-output conflict-alert nodes, horizontally
 * distributed (5 per row, wraps to next row at index ≥ 5).
 *
 * The card width is 340px, gap is 60px → cell column starts at:
 *   col 0: x=80, col 1: x=480, col 2: x=880, col 3: x=1280, col 4: x=1680.
 * Row 1: y=200, row 2: y=520, row 3: y=900, conflicts: y=1280.
 */

import type { Node } from 'reactflow'

const COL = [80, 480, 880, 1280, 1680] as const
const ROW = {
  /** Top-most band: the 420px-wide report-card lives here, alone. */
  reportTop: -480,
  /** Insight strip: synthesizer / orchestrator notes, horizontally chained. */
  insightStrip: -260,
  /** Root note + (deprecated) header band. */
  header: -120,
  top: 200,
  mid: 520,
  bottom: 900,
  /** Conflict-alert row(s) live below the BMC bottom row. */
  conflicts: 1300,
} as const

/** Vertical gap when conflicts wrap to a second row.
 *  Conflict-alert nodes can grow to ~280px tall once content + tags fill in,
 *  so we leave 320px to avoid second-row overlap.
 */
const CONFLICT_ROW_HEIGHT = 320

/** Insight strip horizontal pitch (360px wide + 40px gap). */
const INSIGHT_PITCH = 400

/** Approximate BMC bounding rect — used to shove unpositioned data-source
 *  nodes off the canvas main grid when the server doesn't pin them.
 */
function isInsideBmcRect(x: number, y: number): boolean {
  return x >= COL[0] - 20 && x <= COL[4] + 360 && y >= ROW.top - 20 && y <= ROW.bottom + 280
}

const POSITION_MAP: Record<string, { x: number; y: number }> = {
  // Row 1 — top tier (5 columns)
  'product-key-partnerships':      { x: COL[0], y: ROW.top },     // KP
  'product-key-activities':        { x: COL[1], y: ROW.top },     // KA
  'product-value-propositions':    { x: COL[2], y: ROW.top },     // VP
  'market-customer-relationships': { x: COL[3], y: ROW.top },     // CR
  'market-customer-segments':      { x: COL[4], y: ROW.top },     // CS

  // Row 2 — mid tier (only KA→KR and CR→CH stack vertically)
  'product-key-resources':         { x: COL[1], y: ROW.mid },     // KR (below KA)
  'market-channels':               { x: COL[3], y: ROW.mid },     // CH (below CR)

  // Row 3 — bottom tier (cost spans cols 0-1, revenue spans cols 2-4)
  'finance-cost-structure':        { x: COL[0] + 200, y: ROW.bottom }, // COST mid
  'finance-revenue-streams':       { x: COL[2] + 200, y: ROW.bottom }, // REV mid

  // Right rail — agent avatars
  'avatar-market':                 { x: COL[4] + 460, y: ROW.top },
  'avatar-product':                { x: COL[4] + 460, y: ROW.mid },
  'avatar-finance':                { x: COL[4] + 460, y: ROW.bottom },
}

/** Header notes: root + insight note (orchestrator output). */
const HEADER_KEYS = ['root'] as const

const matchHeader = (id: string) => HEADER_KEYS.find((k) => id.startsWith(`${k}-`)) ?? null

const isConflictNode    = (id: string) => id.startsWith('conflict-')
const isInsightNode     = (id: string) => id.startsWith('insight-')
const isReportNode      = (id: string) => id.startsWith('report-')
const isDataSourceNode  = (id: string) => id.startsWith('data-source-') || id.startsWith('ds-')

export function applyBmcLayout<T extends Node>(nodes: T[]): T[] {
  let conflictOffset = 0
  let insightOffset = 0
  let dataSourceOffset = 0
  let reportOffset = 0

  return nodes.map((node) => {
    const pos = POSITION_MAP[node.id]
    if (pos) {
      return { ...node, position: pos }
    }
    if (matchHeader(node.id)) {
      // Root note: above BMC top row, horizontally centred over the canvas.
      return { ...node, position: { x: COL[2], y: ROW.header } }
    }
    if (isReportNode(node.id)) {
      // Report card is the comprehensive summary product. Pinned to its own
      // top-most band so it doesn't compete with insights or root.
      // 420px wide; multiple reports (re-generations) stack horizontally
      // with 460px pitch (420 + 40 gap) starting at COL[1].
      const x = COL[1] + reportOffset * 460
      reportOffset += 1
      return {
        ...node,
        position: { x, y: ROW.reportTop }
      }
    }
    if (isInsightNode(node.id)) {
      // Insight strip: horizontally chained, between report-card and root.
      // Starts at COL[0] so the leftmost insight aligns with the BMC grid
      // origin; each subsequent insight steps 400px right.
      const x = COL[0] + insightOffset * INSIGHT_PITCH
      insightOffset += 1
      return { ...node, position: { x, y: ROW.insightStrip } }
    }
    if (isConflictNode(node.id)) {
      // Conflict row(s) below bottom — 5 columns matching BMC top row,
      // wrap to second row at index ≥ 5. Row height widened to 320px to
      // accommodate node bodies that grew with severity tags + relatedAgents.
      const col = conflictOffset % 5
      const row = Math.floor(conflictOffset / 5)
      conflictOffset += 1
      return {
        ...node,
        position: {
          x: COL[col],
          y: ROW.conflicts + row * CONFLICT_ROW_HEIGHT
        }
      }
    }
    if (isDataSourceNode(node.id)) {
      // Data-source nodes: pin to the right rail BELOW the avatar stack so
      // they don't drift into the BMC area. If the server gave a position
      // outside the BMC rect, trust it; otherwise stack vertically here.
      const sx = node.position?.x
      const sy = node.position?.y
      const hasServerPos = typeof sx === 'number' && typeof sy === 'number'
      if (hasServerPos && !isInsideBmcRect(sx, sy)) {
        return node
      }
      const y = ROW.bottom + 320 + dataSourceOffset * 200
      dataSourceOffset += 1
      return { ...node, position: { x: COL[4] + 460, y } }
    }
    // Unmatched — leave server-issued position untouched.
    return node
  })
}
