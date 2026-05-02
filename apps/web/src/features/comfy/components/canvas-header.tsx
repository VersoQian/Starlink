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
import { Download, LayoutGrid, PanelsTopLeft, Upload, Zap } from 'lucide-react'
import { WORKFLOW_STAGE_LABELS, type WorkflowStage } from '../store/workflow-stage'

type CanvasHeaderProps = {
  isAnimating: boolean
  onOpenTutorial: () => void
  viewMode?: 'freeform' | 'bmc'
  onViewModeChange?: (mode: 'freeform' | 'bmc') => void
  workflowStage: WorkflowStage
  onExportCanvas?: () => void
  onImportCanvas?: (file: File) => void
}

const SEG_BASE =
  'inline-flex items-center gap-1.5 px-2.5 py-1 font-instr text-[10px] uppercase tracking-kicker transition-colors'
const SEG_ACTIVE = 'bg-paper text-ink'
const SEG_IDLE   = 'bg-transparent text-paper-ash3 hover:text-paper'

const BTN_GHOST =
  'inline-flex items-center gap-1.5 border-[0.5px] border-ink-ash3/40 px-2.5 py-1 font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 hover:border-paper/40 hover:text-paper transition-colors disabled:opacity-30 disabled:cursor-not-allowed'

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 bg-paper text-ink px-3 py-1 font-instr text-[10px] uppercase tracking-kicker hover:bg-paper-ash2 transition-colors'

export function CanvasHeader({
  isAnimating,
  onOpenTutorial,
  viewMode = 'freeform',
  onViewModeChange,
  workflowStage,
  onExportCanvas,
  onImportCanvas
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
      className={`relative z-20 flex items-center justify-between gap-4 px-6 py-3 bg-ink border-b-[1.5px] border-paper/30 ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.1s' }}
    >
      {/* Brand — Fraunces title + mono kicker, no gradient block */}
      <div className="flex items-baseline gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="font-display font-[700] text-paper text-[18px] leading-none shrink-0"
        >
          ◇
        </span>
        <div className="flex flex-col leading-tight min-w-0">
          <h1 className="font-display font-[700] text-paper text-[16px] tracking-[0.02em] leading-tight truncate">
            无限画布 · CANVAS
          </h1>
          <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 truncate">
            MACRA · BUSINESS INTELLIGENCE
          </p>
        </div>
      </div>

      {/* Vertical rule */}
      <span aria-hidden="true" className="h-8 w-px bg-paper/20 shrink-0" />

      {/* Right cluster */}
      <div className="flex items-center gap-3 shrink-0">
        {/* STAGE — mono kicker + paper-tinted value */}
        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
            STAGE
          </span>
          <span className="font-instr text-[10px] uppercase tracking-kicker text-paper">
            {WORKFLOW_STAGE_LABELS[workflowStage]}
          </span>
        </div>

        {/* View-mode segmented control — brutalist 1px paper border */}
        <div
          className="flex items-stretch border-[1px] border-paper/30"
          role="group"
          aria-label="Canvas view"
        >
          <button
            type="button"
            onClick={() => onViewModeChange?.('freeform')}
            className={`${SEG_BASE} ${viewMode === 'freeform' ? SEG_ACTIVE : SEG_IDLE}`}
            aria-pressed={viewMode === 'freeform'}
          >
            <PanelsTopLeft className="h-3 w-3" strokeWidth={1.5} />
            自由
          </button>
          <span aria-hidden="true" className="w-px bg-paper/20" />
          <button
            type="button"
            onClick={() => onViewModeChange?.('bmc')}
            className={`${SEG_BASE} ${viewMode === 'bmc' ? SEG_ACTIVE : SEG_IDLE}`}
            aria-pressed={viewMode === 'bmc'}
          >
            <LayoutGrid className="h-3 w-3" strokeWidth={1.5} />
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
          <Upload className="h-3 w-3" strokeWidth={1.5} />
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
          <Download className="h-3 w-3" strokeWidth={1.5} />
          导出
        </button>

        {/* Primary CTA — paper-on-ink press style */}
        <button
          type="button"
          onClick={onOpenTutorial}
          className={BTN_PRIMARY}
        >
          <Zap className="h-3 w-3" strokeWidth={2} />
          快速入门
        </button>
      </div>
    </header>
  )
}
