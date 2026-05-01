'use client'

/**
 * AgentAvatarNode — minimal "name plate" for an agent's presence on the
 * canvas. Visual is a typographic seal, not a chat-bubble avatar:
 *
 *   ┌────────────┐
 *   │            │
 *   │     M      │   Fraunces 36 px display, byline-tinted
 *   │            │
 *   │ ────────── │   rule-hair
 *   │  MARKET    │   mono kicker, paper-ash3
 *   │   active   │   status, smaller mono
 *   │   ●        │   status dot inline
 *   │            │
 *   └────────────┘
 *
 * Width 96 px, ink-ash1 background, 1.5px paper-bottom rule when the
 * agent is the "currently speaking" one (P3 wires this). Source-only
 * handles on top + bottom — agents don't accept incoming wires.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { AgentByline } from '@/shared/design-system/tokens-v2'

export type AgentAvatarNodeData = {
  agentId: string
  /** Display name — kept SHORT (single word). */
  name: string
  /** Single-letter glyph (M / P / F / C / S). */
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

const STATUS_DOT: Record<AgentAvatarNodeData['status'], string> = {
  idle:     'bg-ink-ash3',
  active:   'bg-paper',
  debating: 'bg-press',
}

const STATUS_LABEL: Record<AgentAvatarNodeData['status'], string> = {
  idle:     'idle',
  active:   'active',
  debating: 'debating',
}

const HANDLE_BASE =
  'h-2 w-2 !border-[0.5px] !border-paper/40 !bg-ink-ash2 hover:!bg-paper transition-colors'

function AgentAvatarNodeImpl({ data, selected }: NodeProps<AgentAvatarNodeData>) {
  const tint = ROLE_TINT[data.role]
  const speaking = data.status === 'active' || data.status === 'debating'

  return (
    <article
      data-agent={data.agentId}
      className={[
        'relative w-[96px] bg-ink-ash1 font-body text-paper',
        'flex flex-col items-center justify-between',
        'transition-[border-color] duration-100 ease-out',
        selected
          ? 'border-[1.5px] border-paper/80'
          : speaking
          ? 'border-[1px] border-paper/40'
          : 'border-[1px] border-ink-ash3/30 hover:border-ink-ash2/60',
      ].join(' ')}
    >
      <Handle id="t" type="source" position={Position.Top}    className={HANDLE_BASE} />
      <Handle id="b" type="source" position={Position.Bottom} className={HANDLE_BASE} />

      {/* GLYPH — large display character */}
      <div className="px-3 pt-4 pb-2">
        <span
          aria-hidden="true"
          className={`font-display font-[700] text-[36px] leading-none ${tint}`}
        >
          {data.glyph}
        </span>
      </div>

      {/* RULE */}
      <div className="self-stretch border-t-[0.5px] border-ink-ash3/16" />

      {/* NAME + STATUS */}
      <div className="px-2 py-2 flex flex-col items-center gap-1">
        <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
          {data.name}
        </span>
        <span className="flex items-center gap-1 font-instr text-[9px] uppercase tracking-kicker text-ink-ash4">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[data.status]} ${
              data.status === 'debating' ? 'animate-editorial-publish' : ''
            }`}
          />
          {STATUS_LABEL[data.status]}
        </span>
      </div>
    </article>
  )
}

export const AgentAvatarNode = memo(AgentAvatarNodeImpl)
