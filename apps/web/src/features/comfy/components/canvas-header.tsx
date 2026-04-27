import { Download, LayoutGrid, PanelsTopLeft, Sparkles, Zap } from 'lucide-react'
import { WORKFLOW_STAGE_LABELS, type WorkflowStage } from '../store/workflow-stage'
import { TOKENS } from './canvas-design-tokens'

type CanvasHeaderProps = {
  isAnimating: boolean
  onOpenTutorial: () => void
  viewMode?: 'freeform' | 'bmc'
  onViewModeChange?: (mode: 'freeform' | 'bmc') => void
  workflowStage: WorkflowStage
}

/**
 * Canvas header (refresh-2026-04).
 *
 * Refreshed surfaces vs. previous version:
 *  - dropped amber accent + cyan accent dual-gradient → single cyan-300 accent
 *  - 12 px logo (was 48 px), monochrome icon (was gradient block)
 *  - workflow stage rail visible at md+ (was hidden until xl)
 *  - 1 px ring instead of glow shadow on active state
 *  - export button is now ghost-style; only "快速入门" remains as the CTA
 *
 * Cross-cutting tokens come from `canvas-design-tokens.ts` so the rest of the
 * canvas can be migrated component-by-component without breaking visual
 * consistency mid-rollout.
 */
export function CanvasHeader({
  isAnimating,
  onOpenTutorial,
  viewMode = 'freeform',
  onViewModeChange,
  workflowStage
}: CanvasHeaderProps) {
  return (
    <header
      className={`relative z-20 flex items-center justify-between px-6 py-3 ${TOKENS.surface.bar} ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.1s' }}
    >
      {/* Brand cluster */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <Sparkles className="h-4 w-4 text-cyan-300" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className={TOKENS.text.h1}>智绘 · 无限画布</h1>
          <p className={TOKENS.text.kicker}>MACRA Business Intelligence</p>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {/* Compact stage badge — single source of truth for the workflow stage.
            Replaced the 5-pill rail to reduce visual noise; the user already
            sees per-stage progress in the bottom command tray. */}
        <div className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.06] bg-slate-950/50 px-2.5 py-1.5">
          <span className={TOKENS.text.kickerAccent}>STAGE</span>
          <span className="text-[11px] font-medium text-white">
            {WORKFLOW_STAGE_LABELS[workflowStage]}
          </span>
        </div>

        {/* View-mode segmented control */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-white/[0.06] bg-slate-950/50 p-1"
          role="group"
          aria-label="Canvas view"
        >
          <button
            type="button"
            onClick={() => onViewModeChange?.('freeform')}
            className={
              viewMode === 'freeform' ? TOKENS.button.segmentActive : TOKENS.button.segmentIdle
            }
            aria-pressed={viewMode === 'freeform'}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            自由画布
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.('bmc')}
            className={
              viewMode === 'bmc' ? TOKENS.button.segmentActive : TOKENS.button.segmentIdle
            }
            aria-pressed={viewMode === 'bmc'}
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
            BMC 九宫格
          </button>
        </div>

        {/* Export — secondary action (ghost) */}
        <button type="button" className={TOKENS.button.ghost}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          导出
        </button>

        {/* Primary CTA */}
        <button type="button" onClick={onOpenTutorial} className={TOKENS.button.primary}>
          <Zap className="h-3.5 w-3.5" strokeWidth={2} />
          快速入门
        </button>
      </div>
    </header>
  )
}
