'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useTheme, cn } from '@/lib/theme'

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
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('simulation')

  return (
    <div className={cn('min-h-screen px-8 py-10', theme.colors.background.primary)}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={cn('text-3xl font-semibold', theme.colors.text.primary)}>跨文化助手</h1>
            <p className={cn('mt-1 text-sm', theme.colors.text.secondary)}>情境模拟 + 报告生成，支持礼节提示、策略建议与偏见校验。</p>
          </div>
          <div className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-xs shadow-sm', theme.colors.background.card, theme.colors.text.muted)}>
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
                  ? cn('shadow-md ring-1', theme.colors.background.card, theme.colors.text.primary, theme.colors.border.hover)
                  : cn('hover:shadow-md', theme.colors.background.card, theme.colors.text.tertiary, `hover:${theme.colors.text.secondary}`)
              )}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className={cn('text-xs', theme.colors.text.muted)}>{tab.description}</div>
            </button>
          ))}
        </div>

        <div className={cn('rounded-3xl p-6 shadow-xl', theme.colors.background.card)}>
          {activeTab === 'simulation' ? <SimulationPanel /> : <ReportPanel />}
        </div>
      </div>
    </div>
  )
}

function SimulationPanel() {
  const { theme } = useTheme()
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
        <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.secondary)}>
          <p className={cn('text-xs font-semibold uppercase tracking-wide', theme.colors.text.muted)}>场景库</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索场景或类别..."
            className={cn('mt-3 w-full rounded-xl border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.card, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
          />
        </div>
        <div className={cn('space-y-2 overflow-hidden rounded-2xl border', theme.colors.border.default, theme.colors.background.card)}>
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
                'w-full border-b px-4 py-3 text-left transition last:border-none',
                theme.colors.border.default,
                selected?.id === item.id
                  ? cn('text-cyan-500', theme.colors.brand.light)
                  : cn(theme.colors.text.primary, theme.colors.interactive.hover)
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{item.title}</p>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-600">{item.level}</span>
              </div>
              <p className={cn('mt-1 line-clamp-2 text-xs', theme.colors.text.secondary)}>{item.description}</p>
              <p className={cn('mt-1 text-[11px]', theme.colors.text.muted)}>目标：{item.goal}</p>
            </button>
          ))}
        </div>
      </div>

      <div className={cn('flex flex-col rounded-2xl border p-4 shadow-inner', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>Conversation</p>
            <h3 className={cn('text-lg font-semibold', theme.colors.text.primary)}>{selected?.title ?? '选择一个场景开始'}</h3>
          </div>
          <button
            type="button"
            className={cn('rounded-full border px-3 py-1 text-xs transition', theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)}
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
        <div ref={listRef} className={cn('flex-1 space-y-3 overflow-y-auto rounded-xl p-4 min-h-[400px] max-h-[500px]', theme.colors.background.card)}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                msg.role === 'assistant'
                  ? cn(theme.colors.brand.light, theme.colors.text.secondary)
                  : 'ml-auto bg-gradient-to-r from-cyan-400 to-blue-500 text-white'
              )}
            >
              {msg.text}
              {msg.tone === 'warning' && <p className="mt-2 text-xs text-amber-600">提示：请稍后再试</p>}
            </div>
          ))}
          {loading && (
            <div className={cn('inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs', theme.colors.brand.light, theme.colors.text.muted)}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
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
                className={cn('rounded-full px-3 py-1 text-xs transition', theme.colors.brand.light, 'text-cyan-500', 'hover:bg-cyan-500/20')}
                onClick={() => setInput(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className={cn('flex items-center gap-2 rounded-2xl border px-3 py-2', theme.colors.border.default, theme.colors.background.card)}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的回应或问题..."
              className={cn('h-16 flex-1 resize-none border-none outline-none placeholder:text-slate-400', theme.colors.background.card, theme.colors.text.primary)}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-cyan-500 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.secondary)}>
          <p className={cn('text-xs font-semibold uppercase tracking-wide', theme.colors.text.muted)}>情境建议</p>
          <div className="mt-3 space-y-3">
            {insights.map((item) => (
              <div key={item.title} className={cn('rounded-xl px-4 py-3 shadow-sm', theme.colors.background.card)}>
                <p className={cn('text-sm font-semibold', theme.colors.text.primary)}>{item.title}</p>
                <p className={cn('mt-1 text-xs', theme.colors.text.secondary)}>{item.detail}</p>
              </div>
            ))}
            {insights.length === 0 && <p className={cn('text-xs', theme.colors.text.muted)}>发送内容后自动生成礼节与策略提示。</p>}
          </div>
        </div>
        <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.secondary)}>
          <p className={cn('text-xs font-semibold uppercase tracking-wide', theme.colors.text.muted)}>参考资料</p>
          <div className="mt-3 space-y-2">
            {resources.map((item) => (
              <a
                key={item.title}
                href={item.url ?? '#'}
                className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm underline-offset-4 hover:underline', theme.colors.background.card, 'text-cyan-500')}
                target="_blank"
                rel="noreferrer"
              >
                {item.title}
                <span className={cn('text-xs', theme.colors.text.muted)}>外链</span>
              </a>
            ))}
            {resources.length === 0 && <p className={cn('text-xs', theme.colors.text.muted)}>等待生成后出现资源链接。</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReportPanel() {
  const { theme } = useTheme()
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
        <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.secondary)}>
          <h3 className={cn('text-sm font-semibold', theme.colors.text.primary)}>1. 输入内容</h3>
          <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>粘贴产品说明、会议纪要或市场笔记。</p>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={10}
            className={cn('mt-3 w-full resize-y rounded-xl border px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.card, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
            placeholder="例如：我们计划在亚太三年内占领X%市场..."
          />
        </div>

        <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.secondary)}>
          <h3 className={cn('text-sm font-semibold', theme.colors.text.primary)}>2. 配置</h3>
          <label className={cn('mt-3 block text-xs font-medium', theme.colors.text.secondary)}>模板</label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value)}
            className={cn('mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none', theme.colors.border.default, theme.colors.background.card, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
          >
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} · {tpl.description}
              </option>
            ))}
          </select>

          <label className={cn('mt-4 block text-xs font-medium', theme.colors.text.secondary)}>语气</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className={cn('mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none', theme.colors.border.default, theme.colors.background.card, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
          >
            {(currentTemplate?.tones ?? ['正式', '中性', '亲和']).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className={cn('mt-4 space-y-2 text-sm', theme.colors.text.primary)}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ensureNeutrality}
                onChange={(e) => setEnsureNeutrality(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
              />
              保证文化中立
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyFormatting}
                onChange={(e) => setApplyFormatting(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
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
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow hover:from-cyan-500 hover:to-blue-600 disabled:opacity-60"
            >
              {loading ? '生成中...' : '生成草稿'}
            </button>
            <button
              type="button"
              onClick={() => runGeneration('regenerate')}
              disabled={loading}
              className={cn('rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-60', theme.colors.border.default, theme.colors.text.primary, theme.colors.interactive.hover)}
            >
              改写段落
            </button>
            <button
              type="button"
              onClick={() => runGeneration('tone')}
              disabled={loading}
              className={cn('rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-60', theme.colors.border.default, theme.colors.text.primary, theme.colors.interactive.hover)}
            >
              语气润色
            </button>
            <button
              type="button"
              onClick={() => runGeneration('bias')}
              disabled={loading}
              className={cn('rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-60', theme.colors.border.default, theme.colors.text.primary, theme.colors.interactive.hover)}
            >
              偏见校验
            </button>
          </div>
        </div>
      </div>

      <div className={cn('rounded-2xl border p-4 shadow-inner', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>Output</p>
            <h3 className={cn('text-lg font-semibold', theme.colors.text.primary)}>{result?.title ?? '等待生成'}</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={cn('rounded-full border px-3 py-1 text-xs transition', theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)}
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
                className={cn('rounded-full border px-3 py-1 text-xs transition', theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)}
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
        <div className={cn('h-[520px] overflow-y-auto rounded-xl px-4 py-3 text-sm leading-relaxed shadow-sm', theme.colors.background.card, theme.colors.text.primary)}>
          {result ? (
            <pre className="whitespace-pre-wrap font-sans">{result.content}</pre>
          ) : (
            <div className={cn('flex h-full items-center justify-center text-xs', theme.colors.text.muted)}>
              生成的报告将展示在这里，支持再次润色与偏见校验。
            </div>
          )}
        </div>
        {result && (
          <div className={cn('mt-3 flex items-center gap-3 text-xs', theme.colors.text.muted)}>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-500">
              模板：{result.template.name}
            </span>
            {result.formattingApplied && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600">已排版</span>}
            {result.neutralityChecked && <span className="rounded-full bg-blue-500/10 px-3 py-1 text-blue-600">文化中立</span>}
          </div>
        )}
      </div>
    </div>
  )
}
