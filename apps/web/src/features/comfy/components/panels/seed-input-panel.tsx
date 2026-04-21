'use client'

import { Button } from '@/shared/components/ui/button'
import { Loader2, Play, Wand2 } from 'lucide-react'
import { useComfyStore } from '../../store'
import { useComfyShellContext } from '../workspace-shell-context'

export function SeedInputPanel() {
  const {
    seedInput,
    onSeedInputChange,
    onSeedGeneration
  } = useComfyShellContext()
  const isOrchestratorProcessing = useComfyStore((state) => state.isOrchestratorProcessing)
  const workflowStage = useComfyStore((state) => state.workflowStage)

  const isComplete = workflowStage === 'output'

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-amber-300">Input</p>
          <h3 className="mt-1 text-sm font-black text-white title-font">业务画布起点</h3>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
            isOrchestratorProcessing
              ? 'border-cyan-300/30 bg-cyan-400/15 text-cyan-200'
              : isComplete
                ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200'
                : 'border-amber-300/30 bg-amber-400/15 text-amber-200'
          }`}
        >
          {isOrchestratorProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isComplete ? (
            <Play className="h-4 w-4" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
        </div>
      </div>

      <textarea
        value={seedInput}
        onChange={(event) => onSeedInputChange(event.target.value)}
        placeholder="用自然语言描述你的商业想法..."
        className="h-28 w-full resize-none rounded-2xl border border-white/15 bg-slate-950/35 px-4 py-3 text-sm text-slate-200 shadow-inner outline-none backdrop-blur-sm transition placeholder:text-slate-500 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/30"
        disabled={isOrchestratorProcessing}
      />

      <Button
        onClick={onSeedGeneration}
        disabled={!seedInput.trim() || isOrchestratorProcessing}
        className={`mt-3 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 py-6 font-bold text-white shadow-lg shadow-amber-500/25 hover:from-amber-500 hover:to-amber-600 ${
          isOrchestratorProcessing ? 'animate-pulse-glow' : ''
        }`}
      >
        {isOrchestratorProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            执行中...
          </>
        ) : isComplete ? (
          <>
            <Play className="mr-2 h-5 w-5" />
            继续生成下一轮
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-5 w-5" />
            生成画布
          </>
        )}
      </Button>
    </section>
  )
}
