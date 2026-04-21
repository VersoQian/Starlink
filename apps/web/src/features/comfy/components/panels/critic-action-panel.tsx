'use client'

import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useComfyStore } from '../../store'
import { useComfyShellContext } from '../workspace-shell-context'

export function CriticActionPanel() {
  const { onRunCritic } = useComfyShellContext()
  const isCriticProcessing = useComfyStore((state) => state.isCriticProcessing)
  const nodeCount = useComfyStore((state) => state.nodes.length)
  const conflictCount = useComfyStore((state) =>
    Array.from(state.macraNodes.values()).filter((node) => node.type === 'conflict-alert').length
  )

  if (nodeCount <= 3) return null

  return (
    <section className="rounded-[28px] border border-pink-300/15 bg-pink-400/[0.07] p-4 shadow-xl shadow-pink-950/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-pink-200">Review</p>
          <h3 className="mt-1 text-sm font-black text-white title-font">冲突检测</h3>
        </div>
        <div className="rounded-2xl border border-pink-300/20 bg-pink-400/15 px-3 py-2 text-center">
          <p className="text-sm font-black text-white">{conflictCount}</p>
          <p className="text-[9px] uppercase tracking-[0.22em] text-pink-200">Alerts</p>
        </div>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        对当前画布进行一致性扫描，发现严重冲突时进入 HITL 决策态。
      </p>

      <Button
        onClick={onRunCritic}
        disabled={isCriticProcessing}
        variant="outline"
        className="w-full rounded-2xl border-pink-300/25 bg-pink-400/10 py-5 text-pink-100 hover:border-pink-300/45 hover:bg-pink-400/20"
      >
        {isCriticProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            扫描中...
          </>
        ) : conflictCount > 0 ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            重新扫描
          </>
        ) : (
          <>
            <AlertTriangle className="mr-2 h-4 w-4" />
            冲突检测
          </>
        )}
      </Button>
    </section>
  )
}
