'use client'

/**
 * Top-left floating perspective switcher — Perspectives / Timeline / Heatmap.
 *
 * Currently only Perspectives is wired (the default canvas view). Timeline
 * and Heatmap are reserved for future analytics overlays; clicking them
 * surfaces a coming-soon hint in the action bar status text. Visual
 * spec follows the Stratum reference: white pill on `bg-stratum-surface`,
 * navy active fill, muted idle text.
 */

import { useState } from 'react'

type Perspective = 'perspectives' | 'timeline' | 'heatmap'

// P10.3 · shortened labels per user request "tab 太长了 短一点".
// Original: Perspectives / Timeline / Heatmap (~280px wide)
// Now:      视图 / 时序 / 热度 (~140px wide, halves footprint)
const TABS: ReadonlyArray<{ id: Perspective; label: string }> = [
  { id: 'perspectives', label: '视图' },
  { id: 'timeline',     label: '时序' },
  { id: 'heatmap',      label: '热度' },
]

export function CanvasPerspectiveToggle() {
  const [active, setActive] = useState<Perspective>('perspectives')

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-full shadow-md border border-stratum-line"
      role="tablist"
      aria-label="Canvas perspective"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActive(tab.id)}
            className={`px-3 py-1 rounded-full font-body text-[11px] font-semibold tracking-tight transition-colors ${
              isActive
                ? 'bg-stratum-navy text-white'
                : 'text-stratum-muted hover:text-stratum-navy'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
