'use client'

/**
 * FloatingMasthead — fixed top overlay that floats over the React Flow
 * canvas without intercepting pan / zoom events. Same visual content as
 * the P2 static Masthead but positioned via `position: fixed; top: 0`
 * with `pointer-events: auto` only on its interactive elements.
 *
 * The masthead intentionally bleeds against the ink canvas (no panel
 * background, no shadow) so the editorial "this is the front page"
 * feel reads even when the viewport is mostly canvas.
 */

import type { AgentByline } from '@/shared/design-system/tokens-v2'

export type AgentPresenceLite = {
  id: string
  name: string
  glyph: string
  role: AgentByline
  status: 'idle' | 'active' | 'debating'
}

const ROLE_TINT: Record<AgentByline, string> = {
  market:      'text-byline-market',
  product:     'text-byline-product',
  finance:     'text-byline-finance',
  critic:      'text-byline-critic',
  synthesizer: 'text-byline-synthesizer',
}

const STATUS_DOT: Record<AgentPresenceLite['status'], string> = {
  idle:     'bg-ink-ash3',
  active:   'bg-paper',
  debating: 'bg-press',
}

interface FloatingMastheadProps {
  workspaceName: string
  edition?: string
  agents: AgentPresenceLite[]
}

export function FloatingMasthead({
  workspaceName,
  edition,
  agents,
}: FloatingMastheadProps) {
  return (
    <header
      // pointer-events:none on the outer hull so panning the canvas
      // beneath isn't blocked; re-enabled on interactive child elements.
      className="fixed top-0 left-0 right-0 z-[40] pointer-events-none"
    >
      <div className="flex items-center gap-6 px-6 py-3 border-b-[1.5px] border-paper/30 bg-ink/85 backdrop-blur-[2px] pointer-events-auto">
        {/* LEFT — kicker stack (compact) */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
            STARLINK · BOARDROOM
          </span>
          {edition ? (
            <span className="font-instr text-[10px] tabular-nums text-ink-ash4">
              {edition}
            </span>
          ) : null}
        </div>

        {/* DIVIDER rule */}
        <span aria-hidden="true" className="h-8 w-px bg-paper/20 shrink-0" />

        {/* CENTER — workspace title in Fraunces (left-aligned, takes
            remaining space, truncates instead of fighting agents) */}
        <h1
          className="font-display font-[700] text-paper text-[22px] xl:text-[26px] leading-[1.05] truncate min-w-0 flex-1"
          title={workspaceName}
        >
          {workspaceName}
        </h1>

        {/* RIGHT — agent presence plates */}
        <ul className="flex items-center gap-3 shrink-0">
          {agents.length === 0 ? (
            <li className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
              SESSION IDLE
            </li>
          ) : (
            agents.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline gap-1.5"
                aria-label={`${a.name} ${a.status}`}
              >
                <span
                  aria-hidden="true"
                  className={`font-display text-[14px] font-[700] leading-none ${ROLE_TINT[a.role]}`}
                >
                  {a.glyph}
                </span>
                <span className="font-instr text-[10px] uppercase tracking-kicker text-paper">
                  {a.name}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[a.status]}`}
                />
              </li>
            ))
          )}
        </ul>
      </div>
    </header>
  )
}
