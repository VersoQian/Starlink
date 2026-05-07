'use client'

/**
 * P11.18 · Agent health chip + popover detail panel.
 *
 * Polls GET /health/agents every 30s. When any agent is `degraded`
 * (error rate ≥ AGENT_SLO_DEGRADED_THRESHOLD on the server, default
 * 30%), shows a press-red chip with the count. Otherwise hidden.
 *
 * Click the chip to expand a floating panel showing per-agent SLO
 * snapshots: latency p50/p95, error/fallback rates, lifetime totals.
 *
 * Lives in the bottom-right action zone next to Layers / KB buttons.
 */

import { useEffect, useState, useRef } from 'react'
import { AlertTriangle, Activity, X } from 'lucide-react'

type AgentSnapshot = {
  agentId: string
  windowSize: number
  errorRate: number
  fallbackRate: number
  latencyP50Ms: number
  latencyP95Ms: number
  totals: { invocations: number; errors: number; fallbacks: number }
  degraded: boolean
}

type HealthResponse = {
  degradedCount: number
  agents: AgentSnapshot[]
}

const POLL_MS = 30_000
const HEALTH_URL = (() => {
  // Server is on PORT 4000 in dev; in prod it's reverse-proxied so
  // same-origin /health/agents works. Detect dev via window.location.
  if (typeof window === 'undefined') return '/health/agents'
  if (window.location.port === '3000' || window.location.port === '3001') {
    return 'http://localhost:4000/health/agents'
  }
  return '/health/agents'
})()

export function AgentHealthChip() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchOnce = async () => {
      try {
        const res = await fetch(HEALTH_URL, { cache: 'no-store' })
        // 503 still returns a JSON body (any-degraded path) — read it.
        const j = (await res.json()) as HealthResponse
        if (!cancelled) {
          setData(j)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void fetchOnce()
    timer.current = setInterval(() => void fetchOnce(), POLL_MS)
    return () => {
      cancelled = true
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  // Always show a small "Activity" indicator if at least one agent has
  // run; expand to red chip when any are degraded. If we can't reach
  // the server, show nothing (don't pollute the canvas with infra noise).
  if (error || !data) return null
  if (data.agents.length === 0) return null

  const degraded = data.degradedCount > 0
  const Icon = degraded ? AlertTriangle : Activity

  return (
    <div className="absolute bottom-6 right-6 z-30 pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] shadow-sm transition-colors ${
          degraded
            ? 'border-[#B33028] bg-[#B33028] text-white hover:bg-[#9a2820]'
            : 'border-stratum-line bg-white text-stratum-muted hover:text-stratum-ink'
        }`}
        aria-label={degraded ? `${data.degradedCount} agent(s) degraded` : 'Agent health'}
      >
        <Icon className="h-3 w-3" strokeWidth={2} />
        {degraded ? `${data.degradedCount} DEGRADED` : `${data.agents.length} AGENT${data.agents.length === 1 ? '' : 'S'}`}
      </button>

      {open && (
        <div className="absolute bottom-10 right-0 w-[420px] max-h-[60vh] overflow-y-auto rounded-[1px] border-[1.5px] border-stratum-navy bg-white shadow-2xl">
          <div className="sticky top-0 flex items-center justify-between border-b-[1px] border-stratum-line bg-stratum-surface-low px-4 py-3">
            <div className="flex items-center gap-2">
              <Icon
                className={`h-4 w-4 ${degraded ? 'text-[#B33028]' : 'text-stratum-muted'}`}
                strokeWidth={1.75}
              />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-stratum-navy">
                Agent SLO · {data.agents.length} active
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-stratum-muted transition-colors hover:bg-stratum-line hover:text-stratum-ink"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <ul className="divide-y divide-stratum-line">
            {data.agents.map((a) => (
              <li key={a.agentId} className={`px-4 py-3 ${a.degraded ? 'bg-[#FDF1F0]' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-[12px] font-medium text-stratum-ink truncate">
                    {a.agentId}
                  </span>
                  {a.degraded && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#B33028]">
                      degraded
                    </span>
                  )}
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-0.5 font-mono text-[10px] tabular-nums text-stratum-muted">
                  <span>p50: <span className="text-stratum-ink">{a.latencyP50Ms}ms</span></span>
                  <span>p95: <span className="text-stratum-ink">{a.latencyP95Ms}ms</span></span>
                  <span>err: <span className={a.errorRate > 0 ? 'text-[#B33028]' : 'text-stratum-ink'}>{(a.errorRate * 100).toFixed(1)}%</span></span>
                  <span className="col-span-3 text-stratum-muted/70">
                    n={a.totals.invocations} · errors={a.totals.errors} · fallbacks={a.totals.fallbacks} · window={a.windowSize}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t-[1px] border-stratum-line px-4 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-stratum-muted">
            polled every {POLL_MS / 1000}s · /health/agents
          </div>
        </div>
      )}
    </div>
  )
}
