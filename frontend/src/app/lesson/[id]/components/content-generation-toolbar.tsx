'use client'

import { useMemo, useState } from 'react'
import { DifyWorkflowService } from '@/services/DifyWorkflowService'
import type { DifyStreamEvent } from '@/utils/difyStream'

type ContentGenerationToolbarProps = {
  lessonId: string
}

const workflowService = new DifyWorkflowService()

export function ContentGenerationToolbar({ lessonId }: ContentGenerationToolbarProps) {
  const [prompt, setPrompt] = useState('请生成本课的核心摘要与行动建议。')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamBuffer, setStreamBuffer] = useState<string[]>([])
  const [result, setResult] = useState<string | null>(null)

  const isReady = useMemo(() => prompt.trim().length > 5, [prompt])

  const handleStreamEvent = (event: DifyStreamEvent) => {
    if (event.type === 'token' && event.data) {
      setStreamBuffer((current) => current.concat(event.data))
    }
    if (event.type === 'message' && typeof event.data === 'string') {
      setStreamBuffer((current) => current.concat(event.data))
    }
    if (event.type === 'completed') {
      setResult((current) => {
        const finalText =
          typeof event.data === 'string'
            ? event.data
            : streamBuffer.join('')
        return finalText || current
      })
    }
    if (event.type === 'error') {
      setError(event.error.message)
    }
  }

  const runWorkflow = async () => {
    if (!isReady || pending) return
    setPending(true)
    setError(null)
    setStreamBuffer([])
    setResult(null)

    try {
      await workflowService.executeWorkflow({
        workflowId: 'content-generation',
        inputs: {
          lessonId,
          prompt
        },
        mode: 'streaming',
        onEvent: handleStreamEvent
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-6 text-sm text-slate-200 shadow-lg shadow-indigo-500/10">
      <header className="space-y-1">
        <h3 className="text-base font-semibold text-white">AI 内容生成</h3>
        <p className="text-xs text-slate-300/80">
          调用 Dify Workflow 生成 Lesson 摘要、要点或行动项。可实时查看流式输出。
        </p>
      </header>

      <label className="mt-4 block text-xs font-medium uppercase tracking-widest text-slate-400">
        生成需求
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="mt-2 h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/60"
          placeholder="描述需要生成的内容，如“输出调研行动项列表”"
          disabled={pending}
        />
      </label>

      <button
        type="button"
        onClick={runWorkflow}
        disabled={!isReady || pending}
        className="mt-4 w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:from-indigo-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? '生成中…' : '调用 Dify Workflow'}
      </button>

      {error && (
        <p className="mt-3 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        <p className="text-xs font-medium text-slate-400">流式输出</p>
        <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
          {streamBuffer.length === 0 ? (
            <span className="text-slate-500">等待生成...</span>
          ) : (
            <span>{streamBuffer.join('')}</span>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-slate-400">最终结果</p>
          <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-xs leading-relaxed text-indigo-100">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}
