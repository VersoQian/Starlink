'use client'

import { AlertTriangle, Check, MessageCircle, X } from 'lucide-react'
import { useComfyShellContext } from '../workspace-shell-context'

export function HitlDecisionOverlayPanel() {
  const {
    pendingDecisionRequest,
    hitlInput,
    onHitlInputChange,
    onApproveAutoRevise,
    onApproveCustomDecision,
    onAcceptCurrentDecision
  } = useComfyShellContext()

  if (!pendingDecisionRequest) return null

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[28rem] rounded-3xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Critic 发现高严重度冲突</h3>
            <p className="text-xs text-slate-400">需要你的决策来继续研讨</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm leading-relaxed text-slate-300">
            {pendingDecisionRequest.payload.decision}
          </p>
        </div>

        <div className="mb-4 space-y-2">
          <button
            onClick={() => void onApproveAutoRevise()}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm text-white">让 Agent 自行修正</p>
              <p className="text-xs text-slate-400">Supervisor 将分派相关 Agent 进行修正</p>
            </div>
          </button>

          <div className="flex gap-2">
            <input
              value={hitlInput}
              onChange={(event) => onHitlInputChange(event.target.value)}
              placeholder="输入你的修正方向..."
              className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
            <button
              onClick={() => void onApproveCustomDecision()}
              disabled={!hitlInput.trim()}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-amber-500 hover:to-amber-600 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => void onAcceptCurrentDecision()}
            className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
          >
            <X className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <div>
              <p className="text-sm text-white">接受当前结果</p>
              <p className="text-xs text-slate-400">跳过修正，使用当前分析</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

