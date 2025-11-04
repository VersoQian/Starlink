'use client'

import { useState } from 'react'

type AnalysisModalProps = {
  open: boolean
  pending: boolean
  errorMessage: string | null
  onClose: () => void
  onConfirm: (question: string) => Promise<void>
}

export function AnalysisModal({ open, pending, errorMessage, onClose, onConfirm }: AnalysisModalProps) {
  const [question, setQuestion] = useState('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center bg-[#1F2345]/40 backdrop-blur">
      <div className="w-[520px] rounded-3xl border border-[#E3E6FF] bg-white/95 p-7 shadow-[0_35px_80px_-40px_rgba(91,95,142,0.55)]">
        <h2 className="text-lg font-semibold text-slate-900">AI 拆分问题</h2>
        <p className="mt-2 text-sm text-slate-500">
          输入你正在思考的复杂问题，系统会生成多维度拆解与行动建议。
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!question.trim() || pending) return
            await onConfirm(question.trim())
            setQuestion('')
          }}
        >
          <div>
            <label className="text-xs uppercase tracking-widest text-slate-500">问题描述</label>
            <textarea
              className="mt-2 h-32 w-full resize-none rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#9B87F5]/60 focus:ring-2 focus:ring-[#9B87F5]/20"
              placeholder="例如：我们如何在未来六个月内提升企业知识库的搜索效率？"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={pending}
            />
          </div>
          {errorMessage && <p className="text-sm text-rose-500">{errorMessage}</p>}
          <div className="flex justify-end gap-3 text-sm">
            <button
              type="button"
              className="rounded-lg border border-[#E3E6FF] px-4 py-2 text-slate-600 hover:bg-white"
              onClick={() => {
                if (pending) return
                onClose()
                setQuestion('')
              }}
              disabled={pending}
            >
              取消
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] px-5 py-2 font-semibold text-white shadow-lg hover:from-[#8E7EEE] hover:to-[#6E60E6] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending || !question.trim()}
            >
              {pending ? '生成中…' : '生成拆解'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
