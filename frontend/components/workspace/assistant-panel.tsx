'use client'

import { useState } from 'react'

const mockMessages = [
  {
    id: 'm1',
    role: 'user',
    content: '总结《AI 行业白皮书》的关键结论。'
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      '1. 生成式 AI 正在重塑知识工作流程；\n2. 数据治理与安全是企业落地的主要关注点；\n3. 推荐围绕协同、可视化、自动化构建统一平台。'
  }
]

export function AssistantPanel() {
  const [input, setInput] = useState('')

  return (
    <aside
      className="flex h-full w-[360px] flex-col border-l border-[#E3E6FF] bg-white/85 backdrop-blur"
      data-testid="assistant-panel"
    >
      <header className="border-b border-[#E3E6FF] px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">研究助手</h2>
        <p className="mt-1 text-xs text-slate-500">优先使用画布资料，必要时联网页搜。</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm">
        {mockMessages.map((message) => (
          <div key={message.id} className="rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] p-4">
            <span className="text-xs uppercase tracking-widest text-slate-500">
              {message.role === 'user' ? '提问' : '助手'}
            </span>
            <p className="mt-2 whitespace-pre-line text-slate-700">{message.content}</p>
          </div>
        ))}
      </div>

      <form
        className="border-t border-[#E3E6FF] px-6 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!input.trim()) return
          setInput('')
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="向画布提问，或输入 / 触发快捷操作"
          className="h-24 w-full resize-none rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#9B87F5]/60 focus:ring-2 focus:ring-[#9B87F5]/20"
        />
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Shift + Enter 换行</span>
          <button className="rounded-full bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:from-[#8E7EEE] hover:to-[#6E60E6]" type="submit">
            发送
          </button>
        </div>
      </form>
    </aside>
  )
}
