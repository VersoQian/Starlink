'use client'

/**
 * CanvasTutorialDialog — Editorial Boardroom v2 (2026-05-02).
 *
 * Onboarding overlay shown via the "快速入门" header button (and once
 * automatically on first canvas visit per CANVAS_TUTORIAL_STORAGE_KEY).
 *
 * v1 was glass-effect + amber→emerald gradient banner + 3 differently-
 * colored Lucide icons + amber→emerald gradient pill buttons + glowing
 * progress dots + animate-gradient (the only place still using that
 * keyframe). Replaced with editorial cover card: kicker rail / Fraunces
 * step title / Geist body / mono step counter / paper-on-ink primary.
 */

import { ChevronRight, X } from 'lucide-react'

const TUTORIAL_STEPS = [
  {
    kicker: '01 · WELCOME',
    title: '欢迎来到智绘画布',
    description: '通过 AI 驱动的可视化画布，让商业想法变成现实。',
  },
  {
    kicker: '02 · DESCRIBE',
    title: '描述你的愿景',
    description: '用自然语言描述你的商业想法，AI 将为你构建初始结构。',
  },
  {
    kicker: '03 · COLLABORATE',
    title: '实时协作优化',
    description: '拖拽节点、建立连接，AI 助手会持续提供专业建议。',
  },
]

type CanvasTutorialDialogProps = {
  open: boolean
  tutorialStep: number
  onClose: () => void
  onNext: () => void
}

export function CanvasTutorialDialog({
  open,
  tutorialStep,
  onClose,
  onNext,
}: CanvasTutorialDialogProps) {
  if (!open) return null
  const step = TUTORIAL_STEPS[tutorialStep] ?? TUTORIAL_STEPS[0]
  const isLast = tutorialStep >= TUTORIAL_STEPS.length - 1

  return (
    <div
      className="fixed inset-0 bg-ink/85 z-50 flex items-center justify-center p-8 animate-editorial-swap"
      role="dialog"
      aria-modal="true"
      aria-label="Canvas tutorial"
    >
      <article className="bg-ink-ash1 border-[1.5px] border-paper/30 max-w-[480px] w-full overflow-hidden animate-editorial-publish">
        {/* Header — kicker rail + close */}
        <header className="flex items-center justify-between px-6 py-3 border-b-[1px] border-ink-ash3/30">
          <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
            STARLINK · TUTORIAL
          </p>
          <button
            onClick={onClose}
            className="p-1 text-ink-ash4 hover:text-paper transition-colors"
            aria-label="跳过"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </header>

        {/* Body — Fraunces step title + Geist body */}
        <div className="px-8 py-7">
          <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 mb-3">
            {step.kicker}
          </p>
          <h2 className="font-display font-[700] text-[26px] leading-[1.1] tracking-[0.01em] text-paper mb-3">
            {step.title}
          </h2>
          <p className="font-body text-[14px] leading-[1.6] text-paper/85 max-w-measure-cell">
            {step.description}
          </p>
        </div>

        {/* Step indicator — three rules; current = paper, others = ash */}
        <div className="px-8 pb-2 flex items-center gap-2">
          {TUTORIAL_STEPS.map((_, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={`h-[2px] flex-1 transition-colors ${
                index === tutorialStep ? 'bg-paper' : 'bg-ink-ash3/40'
              }`}
            />
          ))}
        </div>

        {/* Footer — counter + skip + primary CTA */}
        <footer className="flex items-center gap-3 px-8 py-5 border-t-[1px] border-ink-ash3/30">
          <span className="font-instr text-[10px] tabular-nums uppercase tracking-kicker text-ink-ash4 mr-auto">
            STEP {String(tutorialStep + 1).padStart(2, '0')} / {String(TUTORIAL_STEPS.length).padStart(2, '0')}
          </span>
          <button
            onClick={onClose}
            className="border-[0.5px] border-ink-ash3/40 px-3 py-1.5 font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 hover:border-paper/40 hover:text-paper transition-colors"
          >
            跳过
          </button>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-1.5 bg-paper text-ink px-3 py-1.5 font-instr text-[10px] uppercase tracking-kicker hover:bg-paper-ash2 transition-colors"
          >
            {isLast ? '开始使用' : '下一步'}
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </footer>
      </article>
    </div>
  )
}
