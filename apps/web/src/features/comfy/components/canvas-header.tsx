'use client'

/**
 * CanvasHeader — Editorial Boardroom v2 mast (2026-05-02).
 *
 * Replaces the v1 cyan-glass header (Sparkles icon + h1/kicker text +
 * gradient stage chip + glass segmented control). New visual:
 *
 *   ◇  无限画布 · CANVAS                STAGE · 待机    [自由 | 九宫格]   导入  导出  快速入门
 *      MACRA · BUSINESS INTELLIGENCE
 *
 *   - Brand: Fraunces 字号 18px serif title + mono kicker rail; no
 *     gradient logo block
 *   - Stage: mono UPPERCASE kicker + paper-tinted current value, not
 *     a chip
 *   - Segmented: brutalist 1px paper border, ink-ash1 idle, paper
 *     active (no glass)
 *   - Buttons: Import / Export = ghost (paper-ash3 text + 0.5px
 *     border); 快速入门 = primary paper-on-ink press style
 *   - Bottom rule: 1.5 px paper-tinted divider replaces the v1
 *     "shadow-2xl" raise effect
 *
 * Functional surface unchanged — same prop shape, same handler
 * contract.
 */

import { useRef } from 'react'
import { Download, LayoutGrid, PanelsTopLeft, RefreshCw, Upload, Zap } from 'lucide-react'
import { WORKFLOW_STAGE_LABELS, type WorkflowStage } from '../store/workflow-stage'

type CanvasHeaderProps = {
  isAnimating: boolean
  onOpenTutorial: () => void
  viewMode?: 'freeform' | 'bmc'
  onViewModeChange?: (mode: 'freeform' | 'bmc') => void
  onRecalculate?: () => void
  isRecalculating?: boolean
  workflowStage: WorkflowStage
  onExportCanvas?: () => void
  onImportCanvas?: (file: File) => void
}

const SEG_BASE =
  'inline-flex items-center gap-1.5 px-3 py-1.5 font-body text-[11px] font-medium tracking-[0.02em] transition-colors'
const SEG_ACTIVE = 'bg-stratum-navy text-white'
const SEG_IDLE   = 'bg-transparent text-stratum-muted hover:text-stratum-navy'

const BTN_GHOST =
  'inline-flex items-center gap-1.5 border border-stratum-line bg-white rounded-full px-3 py-1.5 font-body text-[11px] font-medium text-stratum-muted hover:text-stratum-navy hover:border-stratum-blue/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm'

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 bg-stratum-navy text-white rounded-full px-3.5 py-1.5 font-body text-[11px] font-semibold hover:bg-stratum-navy-soft transition-colors shadow-sm'

export function CanvasHeader({
  isAnimating,
  onOpenTutorial,
  viewMode = 'freeform',
  onViewModeChange,
  workflowStage,
  onExportCanvas,
  onImportCanvas,
  onRecalculate,
  isRecalculating
}: CanvasHeaderProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const handleImportClick = (): void => {
    importInputRef.current?.click()
  }

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file && onImportCanvas) onImportCanvas(file)
    // Reset so picking the same file twice in a row still triggers onChange.
    event.target.value = ''
  }

  return (
    <header
      className={`relative z-20 flex items-center justify-between gap-4 px-6 py-3 bg-white border-b border-stratum-line ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.1s' }}
    >
      {/* Brand — Manrope-styled headline + sky-blue kicker */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-stratum-navy text-white text-[18px] leading-none shrink-0"
        >
          ◇
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="font-display font-[700] text-stratum-navy text-[17px] tracking-tight leading-tight truncate">
            智绘画布 · Strategy Canvas
          </h1>
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-stratum-blue truncate">
            MACRA · BUSINESS INTELLIGENCE
          </p>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3 shrink-0">
        {/* STAGE pill */}
        <div className="hidden sm:flex items-center gap-2 bg-stratum-surface-low border border-stratum-line rounded-full px-3 py-1 whitespace-nowrap">
          <span className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-stratum-muted">
            STAGE
          </span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-stratum-blue" />
          <span className="font-body text-[11px] font-medium text-stratum-navy">
            {WORKFLOW_STAGE_LABELS[workflowStage]}
          </span>
        </div>

        {/* View-mode segmented control — pill on white */}
        <div
          className="flex items-stretch bg-stratum-surface-low border border-stratum-line rounded-full p-0.5"
          role="group"
          aria-label="Canvas view"
        >
          <button
            type="button"
            onClick={() => onViewModeChange?.('freeform')}
            className={`${SEG_BASE} rounded-full ${viewMode === 'freeform' ? SEG_ACTIVE : SEG_IDLE}`}
            aria-pressed={viewMode === 'freeform'}
          >
            <PanelsTopLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            自由
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.('bmc')}
            className={`${SEG_BASE} rounded-full ${viewMode === 'bmc' ? SEG_ACTIVE : SEG_IDLE}`}
            aria-pressed={viewMode === 'bmc'}
          >
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
            九宫格
          </button>
        </div>

        {/* Import — ghost */}
        <button
          type="button"
          onClick={handleImportClick}
          disabled={!onImportCanvas}
          className={BTN_GHOST}
          aria-label="导入画布"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
          导入
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />

        {/* Export — ghost */}
        <button
          type="button"
          onClick={onExportCanvas}
          disabled={!onExportCanvas}
          className={BTN_GHOST}
          aria-label="导出画布"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
          导出
        </button>

        {/* Re-Calculate — re-run critic conflict scan */}
        {onRecalculate ? (
          <button
            type="button"
            onClick={onRecalculate}
            disabled={isRecalculating}
            className={BTN_GHOST}
            aria-label="重新检测冲突"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRecalculating ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
            {isRecalculating ? '检测中…' : 'Re-Calc'}
          </button>
        ) : null}

        {/* Primary CTA — paper-on-ink press style */}
        <button
          type="button"
          onClick={onOpenTutorial}
          className={BTN_PRIMARY}
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2} fill="#89CEFF" />
          快速入门
        </button>
      </div>
    </header>
  )
}
