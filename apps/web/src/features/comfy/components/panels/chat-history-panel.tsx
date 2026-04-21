'use client'

import { History, Sparkles } from 'lucide-react'
import { useComfyStore } from '../../store'

export function ChatHistoryPanel() {
  const chatMessages = useComfyStore((state) => state.chatMessages)

  return (
    <section className="flex min-h-[18rem] flex-1 flex-col rounded-[28px] border border-white/10 bg-white/[0.06] shadow-xl shadow-black/10 backdrop-blur">
      <div className="border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-200">Advisor</p>
              <h3 className="mt-1 text-sm font-black text-white title-font">AI 商业顾问</h3>
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 p-2 transition hover:bg-white/10"
            aria-label="查看历史"
          >
            <History className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {chatMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/25 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-white">还没有对话</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              底部输入框负责召唤 Agent 或工具，画布负责承载结果。
            </p>
          </div>
        ) : (
          chatMessages.map((message, index) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                  message.role === 'assistant'
                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/25'
                    : 'border border-white/20 bg-white/5'
                }`}
              >
                {message.role === 'assistant' ? (
                  <Sparkles className="h-4 w-4 text-white" />
                ) : (
                  <span className="text-xs font-bold text-amber-300 mono-font">U</span>
                )}
              </div>

              <div className={`flex max-w-[80%] flex-col gap-1.5 ${message.role === 'user' ? 'items-end' : ''}`}>
                <div
                  className={`rounded-2xl p-3.5 text-sm leading-relaxed ${
                    message.role === 'assistant'
                      ? 'rounded-tl-none border border-white/10 bg-white/5 text-slate-200 shadow-xl'
                      : 'rounded-tr-none bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/25'
                  }`}
                >
                  {message.content}
                </div>
                <span className="px-2 text-[10px] text-slate-500 mono-font">{message.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
