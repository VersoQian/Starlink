'use client'

import type { TimelineIteration } from '@/types/timeline'

type TimelineHistoryPanelProps = {
  iterations: TimelineIteration[]
  loading?: boolean
  onRestore: (iteration: TimelineIteration) => void
}

export function TimelineHistoryPanel({ iterations, loading, onRestore }: TimelineHistoryPanelProps) {
  return (
    <aside className="pointer-events-auto w-72 max-h-[420px] overflow-hidden rounded-3xl border border-[#E3E6FF] bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">历史版本</h3>
          <p className="text-xs text-slate-400">记录每轮拆分与行动</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-center text-xs text-slate-400">加载中...</div>
      ) : iterations.length === 0 ? (
        <div className="mt-6 text-xs text-slate-400">暂无历史记录，开始拆分任务吧。</div>
      ) : (
        <ul className="mt-4 space-y-3 text-sm text-slate-600 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
          {iterations
            .slice()
            .sort((a, b) => b.version - a.version)
            .map((iteration) => (
              <li key={iteration.id} className="rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] px-3 py-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#7C80A9]">
                  <span>第 {iteration.version} 轮</span>
                  <span>{new Date(iteration.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 max-h-14 overflow-hidden text-sm text-slate-700">{iteration.summary || '—'}</p>
                <button
                  className="mt-3 w-full rounded-full border border-[#D5DAFF] px-3 py-1 text-xs font-medium text-[#6F76E5] transition hover:bg-white"
                  onClick={() => onRestore(iteration)}
                >
                  查看并恢复
                </button>
              </li>
            ))}
        </ul>
      )}
    </aside>
  )
}
