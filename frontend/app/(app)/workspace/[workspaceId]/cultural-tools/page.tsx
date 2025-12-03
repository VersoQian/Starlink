'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'

type TabId = 'simulation' | 'report'

type Scenario = {
  id: string
  title: string
  category: string
  description: string
  goal: string
  level: string
  samplePrompts: string[]
}

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  tone?: 'positive' | 'warning'
}

type Insight = { title: string; detail: string }

type Resource = { title: string; url?: string }

type Template = { id: string; name: string; description: string; tones: string[] }

type ReportResponse = {
  title: string
  content: string
  template: Template
  formattingApplied: boolean
  neutralityChecked: boolean
}

const tabs: { id: TabId; label: string; description: string }[] = [
  { id: 'simulation', label: '跨文化模拟', description: '场景化对话 + 礼节提示 + 策略建议' },
  { id: 'report', label: '策略报告', description: '输入内容，选择模板，一键生成跨文化报告' }
]

export default function CulturalToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('simulation')

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F7FF] to-[#EEF1FF] px-8 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">跨文化助手</h1>
            <p className="mt-1 text-sm text-slate-600">情境模拟 + 报告生成，支持礼节提示、策略建议与偏见校验。</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            连接状态：本地 API · 可配置自有 LLM 密钥
          </div>
        </header>

        <div className="flex gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={clsx(
                'rounded-2xl px-4 py-3 text-left shadow-sm transition',
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-md ring-1 ring-[#C8CBFF]'
                  : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'
              )}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className="text-xs text-slate-500">{tab.description}</div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-indigo-100/40">
          {activeTab === 'simulation' ? <SimulationPanel /> : <ReportPanel />}
        </div>
      </div>
    </div>
  )
}

function SimulationPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Scenario | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fetchScenarios = async () => {
      const res = await fetch('/api/cultural/simulations')
      const data = await res.json()
      setScenarios(data.scenarios ?? [])
      if (!selected && data.scenarios?.[0]) {
        setSelected(data.scenarios[0])
        seedOpening(data.scenarios[0])
      }
    }
    fetchScenarios()
  }, [selected])

  const filteredScenarios = useMemo(() => {
    if (!search.trim()) return scenarios
    return scenarios.filter((item) =>
      `${item.title}${item.description}${item.category}`.toLowerCase().includes(search.toLowerCase())
    )
  }, [scenarios, search])

  const seedOpening = (scenario: Scenario) => {
    setMessages([
      {
        id: 'assistant-welcome',
        role: 'assistant',
        text: `情境：${scenario.title}。我会提示礼节、策略与可执行话术。先简述你的目标或直接发出开场白。`
      }
    ])
  }

  const sendMessage = async () => {
    if (!input.trim() || !selected) return
    const pendingId = `user-${Date.now()}`
    const userMsg: ChatMessage = { id: pendingId, role: 'user', text: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/cultural/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selected.id,
          message: userMsg.text,
          history: messages.map((m) => ({
            role: m.role,
            content: m.text
          }))
        })
      })
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: data.reply ?? '稍后再试。' }
      ])
      setInsights(data.insights ?? [])
      setResources(data.resources ?? [])
      setQuickReplies(data.quickReplies ?? [])
      scrollToBottom()
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: `出现错误：${error instanceof Error ? error.message : '请重试'}`,
          tone: 'warning'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">场景库</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索场景或类别..."
            className="mt-3 w-full rounded-xl border border-[#E3E6FF] bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#9B87F5] focus:outline-none"
          />
        </div>
        <div className="space-y-2 overflow-hidden rounded-2xl border border-[#E3E6FF] bg-white">
          {filteredScenarios.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelected(item)
                setMessages([])
                seedOpening(item)
              }}
              className={clsx(
                'w-full border-b border-[#F0F1FF] px-4 py-3 text-left transition last:border-none',
                selected?.id === item.id ? 'bg-[#EEF0FF] text-[#4338CA]' : 'hover:bg-[#F7F8FF]'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{item.title}</p>
                <span className="rounded-full bg-[#F1E7FF] px-2 py-0.5 text-[10px] text-[#7A4CE5]">{item.level}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
              <p className="mt-1 text-[11px] text-slate-400">目标：{item.goal}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col rounded-2xl border border-[#E3E6FF] bg-[#F9FAFF] p-4 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Conversation</p>
            <h3 className="text-lg font-semibold text-slate-900">{selected?.title ?? '选择一个场景开始'}</h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-[#E3E6FF] px-3 py-1 text-xs text-slate-500 hover:bg-white"
            onClick={() => {
              if (selected) {
                setMessages([])
                seedOpening(selected)
              }
            }}
          >
            重启
          </button>
        </div>
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-white p-4 min-h-[400px] max-h-[500px]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                msg.role === 'assistant'
                  ? 'bg-[#EEF0FF] text-slate-800'
                  : 'ml-auto bg-gradient-to-r from-[#9BE9D4] to-[#7CE1C2] text-slate-900'
              )}
            >
              {msg.text}
              {msg.tone === 'warning' && <p className="mt-2 text-xs text-amber-600">提示：请稍后再试</p>}
            </div>
          ))}
          {loading && (
            <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF0FF] px-3 py-2 text-xs text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#7A6EEF]" />
              正在生成回应…
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full bg-[#EEF0FF] px-3 py-1 text-xs text-[#4338CA] hover:bg-[#E3E6FF]"
                onClick={() => setInput(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-[#E3E6FF] bg-white px-3 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的回应或问题..."
              className="h-16 flex-1 resize-none border-none bg-white text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-[#8E7EEE] hover:to-[#6E60E6] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-[#E3E6FF] bg-[#F9FAFF] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">情境建议</p>
          <div className="mt-3 space-y-3">
            {insights.map((item) => (
              <div key={item.title} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
              </div>
            ))}
            {insights.length === 0 && <p className="text-xs text-slate-400">发送内容后自动生成礼节与策略提示。</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E3E6FF] bg-[#F9FAFF] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">参考资料</p>
          <div className="mt-3 space-y-2">
            {resources.map((item) => (
              <a
                key={item.title}
                href={item.url ?? '#'}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm text-[#4338CA] underline-offset-4 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {item.title}
                <span className="text-xs text-slate-400">外链</span>
              </a>
            ))}
            {resources.length === 0 && <p className="text-xs text-slate-400">等待生成后出现资源链接。</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportPanel() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [tone, setTone] = useState('正式')
  const [source, setSource] = useState('')
  const [ensureNeutrality, setEnsureNeutrality] = useState(true)
  const [applyFormatting, setApplyFormatting] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTemplates = async () => {
      const res = await fetch('/api/cultural/reports')
      const data = await res.json()
      setTemplates(data.templates ?? [])
      if (!templateId && data.templates?.[0]) {
        setTemplateId(data.templates[0].id)
        setTone(data.templates[0].tones?.[0] ?? '正式')
      }
    }
    fetchTemplates()
  }, [templateId])

  const currentTemplate = useMemo(
    () => templates.find((item) => item.id === templateId),
    [templates, templateId]
  )

  const runGeneration = async (action: 'draft' | 'regenerate' | 'tone' | 'bias') => {
    if (!source.trim() || !templateId) {
      setError('请填写输入内容并选择模板')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cultural/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          templateId,
          tone,
          ensureNeutrality,
          applyFormatting,
          action
        })
      })
      if (!res.ok) throw new Error('生成失败')
      const data = (await res.json()) as ReportResponse
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成出错')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] p-4">
          <h3 className="text-sm font-semibold text-slate-900">1. 输入内容</h3>
          <p className="mt-1 text-xs text-slate-500">粘贴产品说明、会议纪要或市场笔记。</p>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={10}
            className="mt-3 w-full resize-y rounded-xl border border-[#E3E6FF] bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#9B87F5] focus:outline-none"
            placeholder="例如：我们计划在亚太三年内占领X%市场..."
          />
        </div>

        <div className="rounded-2xl border border-[#E3E6FF] bg-[#F7F8FF] p-4">
          <h3 className="text-sm font-semibold text-slate-900">2. 配置</h3>
          <label className="mt-3 block text-xs font-medium text-slate-600">模板</label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#E3E6FF] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#9B87F5] focus:outline-none"
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} · {tpl.description}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs font-medium text-slate-600">语气</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#E3E6FF] bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#9B87F5] focus:outline-none"
          >
            {(currentTemplate?.tones ?? ['正式', '中性', '亲和']).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="mt-4 space-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ensureNeutrality}
                onChange={(e) => setEnsureNeutrality(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#7A6EEF] focus:ring-[#7A6EEF]"
              />
              保证文化中立
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyFormatting}
                onChange={(e) => setApplyFormatting(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#7A6EEF] focus:ring-[#7A6EEF]"
              />
              应用标准排版
            </label>
          </div>

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => runGeneration('draft')}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] px-4 py-2 text-sm font-semibold text-white shadow hover:from-[#8E7EEE] hover:to-[#6E60E6] disabled:opacity-60"
            >
              {loading ? '生成中...' : '生成草稿'}
            </button>
            <button
              type="button"
              onClick={() => runGeneration('regenerate')}
              disabled={loading}
              className="rounded-xl border border-[#E3E6FF] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#F7F8FF] disabled:opacity-60"
            >
              改写段落
            </button>
            <button
              type="button"
              onClick={() => runGeneration('tone')}
              disabled={loading}
              className="rounded-xl border border-[#E3E6FF] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#F7F8FF] disabled:opacity-60"
            >
              语气润色
            </button>
            <button
              type="button"
              onClick={() => runGeneration('bias')}
              disabled={loading}
              className="rounded-xl border border-[#E3E6FF] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#F7F8FF] disabled:opacity-60"
            >
              偏见校验
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E3E6FF] bg-[#F9FAFF] p-4 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Output</p>
            <h3 className="text-lg font-semibold text-slate-900">{result?.title ?? '等待生成'}</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-[#E3E6FF] px-3 py-1 text-xs text-slate-500 hover:bg-white"
              onClick={() => {
                setResult(null)
                setSource('')
              }}
            >
              清空
            </button>
            {result && (
              <button
                type="button"
                className="rounded-full border border-[#E3E6FF] px-3 py-1 text-xs text-slate-500 hover:bg-white"
                onClick={() => {
                  navigator.clipboard
                    .writeText(result.content)
                    .catch(() => setError('复制失败，请手动复制'))
                }}
              >
                复制
              </button>
            )}
          </div>
        </div>
        <div className="h-[520px] overflow-y-auto rounded-xl bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
          {result ? (
            <pre className="whitespace-pre-wrap font-sans">{result.content}</pre>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              生成的报告将展示在这里，支持再次润色与偏见校验。
            </div>
          )}
        </div>
        {result && (
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF0FF] px-3 py-1 text-[#4338CA]">
              模板：{result.template.name}
            </span>
            {result.formattingApplied && <span className="rounded-full bg-[#E5FBF1] px-3 py-1 text-emerald-600">已排版</span>}
            {result.neutralityChecked && <span className="rounded-full bg-[#E6ECFF] px-3 py-1 text-[#4C6FFF]">文化中立</span>}
          </div>
        )}
      </div>
    </div>
  )
}
