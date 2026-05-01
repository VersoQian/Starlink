'use client'

/**
 * BmcCellNode — Editorial Boardroom v2 BMC cell, rendered as a draggable
 * React Flow node. Replaces the v1 cc-bmc-card-node which used amber/
 * gradient/glow styling.
 *
 * Visual model (vertical reading order):
 *
 *   ┌─────────────────────────────────────┐
 *   │ ◆ M · MARKET-AGENT          [1][2]  │   byline + citations chip
 *   │ ─────────────────────────────────── │   rule-hair
 *   │ CUSTOMER  SEGMENTS                  │   Fraunces display, expanded tracking
 *   │ ─────────────────────────────────── │   rule-mid
 *   │ Body content (Geist sans). Multi-   │
 *   │ line. Geist 13 px / leading-1.5.    │   body
 *   │ Max measure 52ch.                   │
 *   │ ─────────────────────────────────── │   rule-hair
 *   │ 12:34:56                  CONF mid  │   meta footer (mono tabular)
 *   └─────────────────────────────────────┘
 *
 * 4 handles (top/right/bottom/left) for connections from any side. Selection
 * upgrades the border from 1px ash3/16 to 1.5px paper/80 — no glow, no
 * gradient. Hover bumps border to ash2/40.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { AgentByline } from '@/shared/design-system/tokens-v2'

export type BmcCellNodeData = {
  /** 9-dim id used for layout placement and edge routing. */
  dim: 'KP' | 'KA' | 'KR' | 'VP' | 'CR' | 'CH' | 'CS' | 'COST' | 'REVENUE'
  /** Display label (e.g. "客户细分"). */
  label: string
  /** Agent role for byline tint. */
  byline?: AgentByline
  /** Single-letter kicker glyph (M / P / F / etc). */
  bylineGlyph?: string
  /** "market-agent" / "product-agent". */
  agentId?: string
  /** ISO timestamp of last edit. */
  occurredAt?: string
  /** "high" / "mid" / "low" — surfaced as small CONF tag. */
  confidence?: 'high' | 'mid' | 'low'
  /** Body markdown / plain text. */
  content?: string
  /** Citation index numbers (e.g. [1, 2]). Render as small mono chips. */
  citations?: number[]
}

const ROLE_TINT: Record<AgentByline, string> = {
  market:      'text-byline-market',
  product:     'text-byline-product',
  finance:     'text-byline-finance',
  critic:      'text-byline-critic',
  synthesizer: 'text-byline-synthesizer',
}

const HANDLE_BASE =
  'h-2 w-2 !border-[0.5px] !border-paper/40 !bg-ink-ash2 hover:!bg-paper transition-colors'

function BmcCellNodeImpl({ data, selected }: NodeProps<BmcCellNodeData>) {
  const tint = data.byline ? ROLE_TINT[data.byline] : 'text-paper-ash3'
  const time = data.occurredAt ? formatTime(data.occurredAt) : null
  const empty = !data.content

  return (
    <article
      data-dim={data.dim}
      className={[
        'relative w-[280px] bg-ink-ash1 font-body text-paper',
        'transition-[border-color,opacity] duration-100 ease-out',
        selected
          ? 'border-[1.5px] border-paper/80'
          : 'border-[1px] border-ink-ash3/30 hover:border-ink-ash2/60',
      ].join(' ')}
    >
      {/* 4 connection handles, ash-toned. ReactFlow positions them on edge midpoints. */}
      <Handle id="t" type="source" position={Position.Top}    className={HANDLE_BASE} />
      <Handle id="r" type="source" position={Position.Right}  className={HANDLE_BASE} />
      <Handle id="b" type="source" position={Position.Bottom} className={HANDLE_BASE} />
      <Handle id="l" type="source" position={Position.Left}   className={HANDLE_BASE} />
      <Handle id="t-target" type="target" position={Position.Top}    className={HANDLE_BASE} style={{ opacity: 0 }} />
      <Handle id="r-target" type="target" position={Position.Right}  className={HANDLE_BASE} style={{ opacity: 0 }} />
      <Handle id="b-target" type="target" position={Position.Bottom} className={HANDLE_BASE} style={{ opacity: 0 }} />
      <Handle id="l-target" type="target" position={Position.Left}   className={HANDLE_BASE} style={{ opacity: 0 }} />

      {/* HEADER — byline + citation chips */}
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2 border-b-[0.5px] border-ink-ash3/16">
        <div className="flex items-baseline gap-2 min-w-0">
          {data.bylineGlyph ? (
            <span
              aria-hidden="true"
              className={`font-display text-[13px] font-[700] leading-none ${tint}`}
            >
              {data.bylineGlyph}
            </span>
          ) : null}
          <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 truncate">
            {data.agentId ?? 'unassigned'}
          </span>
        </div>
        {data.citations && data.citations.length > 0 ? (
          <ul className="flex items-baseline gap-1 shrink-0" aria-label="citations">
            {data.citations.map((n) => (
              <li
                key={n}
                className="font-instr text-[10px] tabular-nums text-press leading-none"
              >
                [{n}]
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {/* TITLE — Fraunces display */}
      <div className="px-4 pt-3 pb-3">
        <h3
          className={[
            'font-display font-[700] text-[18px] leading-[1.1]',
            'tracking-[0.04em] uppercase',
            'text-paper',
          ].join(' ')}
          title={data.label}
        >
          {data.label}
        </h3>
      </div>

      {/* BODY */}
      <div className="px-4 pb-3 border-t-[1px] border-ink-ash2/40">
        {empty ? (
          <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 py-3">
            待编辑
          </p>
        ) : (
          <p className="font-body text-[13px] leading-[1.55] text-paper/85 max-w-measure-cell pt-3 whitespace-pre-wrap">
            {data.content}
          </p>
        )}
      </div>

      {/* META FOOTER */}
      {(time || data.confidence) && (
        <footer className="flex items-baseline justify-between gap-2 px-4 pt-2 pb-2 border-t-[0.5px] border-ink-ash3/16">
          <span className="font-instr text-[10px] tabular-nums text-ink-ash4">
            {time ?? ''}
          </span>
          {data.confidence ? (
            <span className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
              CONF&nbsp;
              <span className={data.confidence === 'high' ? 'text-paper-ash3' : 'text-ink-ash4'}>
                {data.confidence}
              </span>
            </span>
          ) : null}
        </footer>
      )}
    </article>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(11, 19)
  } catch {
    return '--:--:--'
  }
}

export const BmcCellNode = memo(BmcCellNodeImpl)
