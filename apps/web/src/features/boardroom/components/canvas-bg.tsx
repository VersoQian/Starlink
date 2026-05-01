'use client'

/**
 * CanvasBg — atmospheric layers behind the React Flow surface.
 *
 *   z-0  ink solid           — true black base
 *   z-1  paper-grain          — SVG noise, multiply blend, 0.06 opacity
 *   z-2  dot-grid (8 px)      — 1px ash3/8% dots, snap-aligned
 *   z-3  React Flow shapes    — nodes + edges (provided by caller)
 *
 * Pure presentational; consumers wrap it around <ReactFlow/> children.
 *
 * Notes:
 *   - The ink-grain helper class lives in globals.css.
 *   - The dot grid uses a CSS background-image with two stacked
 *     radial-gradient stops so it pans/scales WITH the canvas if
 *     the consumer wants — but here we keep it fixed to the viewport
 *     so zooming doesn't blur the texture.
 *   - The grid spacing matches `panOnScrollSpeed` defaults so panning
 *     feels grid-aligned without us having to wire the React Flow
 *     translate transform.
 */

import type { ReactNode } from 'react'

interface CanvasBgProps {
  children: ReactNode
}

export function CanvasBg({ children }: CanvasBgProps) {
  return (
    <div className="relative h-full w-full bg-ink overflow-hidden">
      {/* Layer 1 — paper grain (multiply on ink) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] pointer-events-none bg-grain-ink"
      />

      {/* Layer 2 — 8px dot grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(74,71,68,0.18) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0',
        }}
      />

      {/* Layer 3 — React Flow content */}
      <div className="relative z-[3] h-full w-full">{children}</div>
    </div>
  )
}
