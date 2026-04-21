'use client'

import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useComfyStore } from '../../store'
import { getToolById } from '../../registries/tool-registry'

const STATUS_LABELS = {
  idle: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败'
} as const

export function ToolDrawerPanel() {
  const activeToolId = useComfyStore((state) => state.activeToolId)
  const closeToolDrawer = useComfyStore((state) => state.closeToolDrawer)
  const runState = useComfyStore((state) =>
    activeToolId ? state.toolRunStates[activeToolId] : undefined
  )
  const tool = getToolById(activeToolId)

  if (!tool) return null

  const Icon = tool.icon
  const DrawerComponent = tool.DrawerComponent
  const status = runState?.status ?? 'idle'

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-40 flex justify-end">
      <aside className="pointer-events-auto flex h-full w-[430px] flex-col border-l border-white/10 bg-slate-950/92 shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="border-b border-white/10 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.accentClassName} shadow-lg shadow-black/20`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">{tool.command}</p>
                <h2 className="mt-1 truncate text-lg font-black text-white title-font">{tool.name}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{tool.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeToolDrawer}
              className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="关闭工具抽屉"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Tool State</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
              {status === 'running' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />
              ) : status === 'completed' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-500" />
              )}
              {STATUS_LABELS[status]}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {DrawerComponent ? (
            <DrawerComponent tool={tool} />
          ) : (
            <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
              这个工具还没有配置 DrawerComponent。
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
