'use client'

/**
 * MentionProgressPill — floating top-center activity HUD.
 *
 * Why this exists:
 *   @-mention BMC generators take 60-120s (LLM call + cell summarizer +
 *   structural-edge recompute). With no in-flight signal the user thinks
 *   the page hung and either reloads (wasted work) or fires the mention
 *   again (duplicate work). This pill shows the live elapsed time + agent
 *   identity + a "done" morph for ~8s after completion so the user has
 *   continuous feedback.
 *
 * Data flow:
 *   useComfyStore.activeMentions — populated by mentionAgent /
 *   callLangGraph store actions. Each entry is `{ id, agentId, summary,
 *   startedAt, completedAt, status, affectedNodeIds, resultTag }`. Entries
 *   in status `running` show a live elapsed counter; entries in any
 *   terminal status (completed/failed/refused) show their resultTag.
 *
 * Pruning:
 *   1Hz interval calls `pruneActiveMentions` which drops terminal entries
 *   older than 8s. Running entries are never pruned by the interval —
 *   only `finalizeActiveMention` (called from the action's try/catch/
 *   finally) moves them to terminal so the interval can sweep them.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Check, AlertTriangle, Ban } from 'lucide-react'
import { useComfyStore } from '../store'
import { getAgent } from '../registries/agent-registry'
import { bylineAccent } from '@/shared/design-system/tokens-v2'

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

export function MentionProgressPill() {
  const activeMentions = useComfyStore((s) => s.activeMentions)
  const pruneActiveMentions = useComfyStore((s) => s.pruneActiveMentions)

  // 1Hz tick so the elapsed counter on running entries updates live and
  // terminal entries auto-prune. Using a counter (not Date.now) lets us
  // keep dep arrays stable in child memos.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (activeMentions.length === 0) return
    const id = setInterval(() => {
      setTick((n) => (n + 1) % 1000)
      pruneActiveMentions()
    }, 1000)
    return () => clearInterval(id)
  }, [activeMentions.length, pruneActiveMentions])

  const visible = useMemo(() => activeMentions, [activeMentions])

  if (visible.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label="Agent 调用进度"
    >
      {visible.map((m) => {
        const descriptor = getAgent(m.agentId)
        const accent = descriptor ? bylineAccent[descriptor.byline] : '#7A8B7E'
        const glyph = descriptor?.glyph ?? '✦'
        const displayName = descriptor?.displayName ?? m.agentId
        const elapsedMs = (m.completedAt ?? Date.now()) - m.startedAt
        const isRunning = m.status === 'running'
        const isDone = m.status === 'completed'
        const isFailed = m.status === 'failed'
        const isRefused = m.status === 'refused'
        // Icon + tone per status.
        const Icon = isRunning
          ? Loader2
          : isDone
            ? Check
            : isRefused
              ? Ban
              : AlertTriangle
        const iconClass = isRunning ? 'animate-spin' : ''
        return (
          <div
            key={m.id}
            className="pointer-events-auto flex items-center gap-2 rounded-full border-[1px] border-stratum-line bg-white/95 px-3 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm transition-opacity duration-500"
            style={{
              // Subtle left-edge tint in the agent's byline color so
              // multi-mention stacks read at a glance.
              boxShadow: `inset 3px 0 0 0 ${accent}, 0 2px 12px rgba(0,0,0,0.08)`,
              opacity: isRunning ? 1 : 0.92
            }}
          >
            {/* Agent glyph (display-serif, byline-tinted) */}
            <span
              aria-hidden="true"
              className="font-display text-[16px] font-[700] leading-none"
              style={{ color: accent }}
            >
              {glyph}
            </span>
            {/* Status icon */}
            <Icon
              className={`h-3.5 w-3.5 ${iconClass} ${
                isFailed
                  ? 'text-stratum-danger'
                  : isRefused
                    ? 'text-stratum-warn'
                    : 'text-stratum-navy'
              }`}
              strokeWidth={2}
            />
            {/* Agent display name */}
            <span className="font-body text-[11px] font-bold text-stratum-navy">
              {displayName}
            </span>
            {/* Elapsed / result tag */}
            <span className="font-instr text-[10px] uppercase tracking-kicker text-stratum-muted tabular-nums">
              {isRunning
                ? formatElapsed(elapsedMs)
                : (m.resultTag ?? '完成')}
            </span>
            {/* User-message preview (only while running, helps if multiple
                in flight — distinguish "@market-agent 加 SaaS 客户" from
                "@market-agent 加 toC 客户"). */}
            {isRunning && m.summary && (
              <span className="hidden max-w-[180px] truncate font-body text-[10px] text-stratum-muted md:inline">
                · {m.summary}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
