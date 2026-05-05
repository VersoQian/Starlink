'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, History, Sparkles } from 'lucide-react'
import { ToolHeroCard, ToolPanel } from '@/shared/components/tool-page-shell'
import {
  buildTranslationHistoryStorageKey,
  buildTranslationPreviewStorageKey,
  type TranslationHistorySnapshot
} from '@/shared/lib/tool-preview-storage'
import { cn } from '@/shared/lib/utils'

type TranslateMode =
  | 'standard'
  | 'formal'
  | 'casual'
  | 'professional'
  | 'simplified-traditional'
  | 'traditional-simplified'

type TranslationHistory = {
  id: string
  source: string
  target: string
  mode: string
  timestamp: Date
}

const LANGUAGE_OPTIONS = [
  { label: '自动检测', value: 'auto' },
  { label: '英文', value: 'en' },
  { label: '中文（简体）', value: 'zh-CN' },
  { label: '中文（繁体）', value: 'zh-TW' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '西班牙语', value: 'es' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' }
]

const TRANSLATE_MODES = [
  { id: 'standard', label: '标准翻译', description: '平衡准确性和流畅度' },
  { id: 'formal', label: '正式语气', description: '适合商务、提案和汇报' },
  { id: 'casual', label: '口语化', description: '更适合日常沟通与社媒表达' },
  { id: 'professional', label: '专业术语', description: '尽量保留行业上下文和术语' }
] as const

const CONVERSION_MODES = [
  { id: 'simplified-traditional', label: '简→繁', description: '简体中文转换为繁体中文' },
  { id: 'traditional-simplified', label: '繁→简', description: '繁体中文转换为简体中文' }
] as const

const quickExamples = [
  {
    label: '商务邮件',
    source: 'Please prepare a localized launch memo for our partners in Singapore and Hong Kong.',
    tab: 'translate' as const,
    mode: 'formal' as TranslateMode
  },
  {
    label: '产品说明',
    source: '我们需要将研究结论转成更适合海外投资人的表达方式。',
    tab: 'translate' as const,
    mode: 'professional' as TranslateMode
  },
  {
    label: '简繁转换',
    source: '這是一段需要在兩岸市場之間快速切換的示例文本。',
    tab: 'convert' as const,
    mode: 'traditional-simplified' as TranslateMode
  }
]

export default function TranslatePage({ params }: { params: { workspaceId: string } }) {
  const [sourceText, setSourceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [mode, setMode] = useState<TranslateMode>('standard')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<TranslationHistory[]>([])
  const [historyHydrated, setHistoryHydrated] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'translate' | 'convert'>('translate')

  useEffect(() => {
    const rawHistory = localStorage.getItem(buildTranslationHistoryStorageKey(params.workspaceId))
    if (!rawHistory) {
      setHistoryHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(rawHistory) as TranslationHistorySnapshot[]
      setHistory(
        parsed.map((item) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }))
      )
    } catch {
      localStorage.removeItem(buildTranslationHistoryStorageKey(params.workspaceId))
    } finally {
      setHistoryHydrated(true)
    }
  }, [params.workspaceId])

  useEffect(() => {
    if (!historyHydrated) return
    const payload: TranslationHistorySnapshot[] = history.map((item) => ({
      ...item,
      timestamp: item.timestamp.toISOString()
    }))
    localStorage.setItem(buildTranslationHistoryStorageKey(params.workspaceId), JSON.stringify(payload))
  }, [history, historyHydrated, params.workspaceId])

  const activeModeLabel = useMemo(() => {
    const options = activeTab === 'translate' ? TRANSLATE_MODES : CONVERSION_MODES
    return options.find((item) => item.id === mode)?.label ?? mode
  }, [activeTab, mode])

  const toolStats = useMemo(
    () => [
      {
        label: 'Input',
        value: `${sourceText.length}`,
        detail: '当前待转换内容的字符数'
      },
      {
        label: 'Output',
        value: `${targetText.length}`,
        detail: '已生成结果的字符数'
      },
      {
        label: 'History',
        value: `${history.length}`,
        detail: '本地保留的最近转换记录'
      },
      {
        label: 'Mode',
        value: activeModeLabel,
        detail: activeTab === 'translate' ? '多语言表达' : '字形转换'
      }
    ],
    [activeModeLabel, activeTab, history.length, sourceText.length, targetText.length]
  )

  const handleTranslate = async () => {
    if (!sourceText.trim()) return

    setIsTranslating(true)
    setError(null)

    try {
      const endpoint = activeTab === 'convert' ? '/api/translate/convert' : '/api/translate'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          sourceLanguage: sourceLanguage === 'auto' ? undefined : sourceLanguage,
          targetLanguage,
          mode,
          workspaceId: params.workspaceId
        })
      })

      if (!response.ok) {
        throw new Error('翻译失败，请稍后重试')
      }

      const data = await response.json()
      setTargetText(data.translation)

      const nextHistory: TranslationHistory = {
        id: Date.now().toString(),
        source: sourceText,
        target: data.translation,
        mode: activeModeLabel,
        timestamp: new Date()
      }
      setHistory((previous) => [nextHistory, ...previous.slice(0, 9)])
      localStorage.setItem(
        buildTranslationPreviewStorageKey(params.workspaceId),
        JSON.stringify({
          source: sourceText,
          target: data.translation,
          mode: activeModeLabel,
          updatedAt: new Date().toISOString()
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败')
    } finally {
      setIsTranslating(false)
    }
  }

  const handleCopy = async () => {
    if (!targetText) return
    try {
      await navigator.clipboard.writeText(targetText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('复制失败')
    }
  }

  const handleSwap = () => {
    setSourceText(targetText)
    setTargetText(sourceText)
    const nextSource = targetLanguage
    const nextTarget = sourceLanguage === 'auto' ? 'en' : sourceLanguage
    setSourceLanguage(nextSource)
    setTargetLanguage(nextTarget)
  }

  const applyExample = (example: (typeof quickExamples)[number]) => {
    setActiveTab(example.tab)
    setMode(example.mode)
    setSourceText(example.source)
    setTargetText('')
  }

  const loadHistoryItem = (item: TranslationHistory) => {
    setSourceText(item.source)
    setTargetText(item.target)
    setShowHistory(false)
  }

  const currentModeOptions = activeTab === 'translate' ? TRANSLATE_MODES : CONVERSION_MODES

  return (
    <div className="space-y-8 text-[var(--stratum-ink)]">
      <ToolHeroCard
        theme="emerald"
        eyebrow="@translate"
        title="Translation Relay"
        description="把研究结论、知识材料和对外表达在不同语言与语境之间快速转换。这不是独立主页面，而是为智慧画布和输出层服务的语义转换工具。"
        actions={
          <>
            <Link
              href={`/workspace/${params.workspaceId}/canvas` as Route}
              className="rounded-full bg-[var(--stratum-navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              返回智慧画布
            </Link>
            <Link
              href={`/workspace/${params.workspaceId}/deep-research` as Route}
              className="rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              打开研究工具
            </Link>
            <button
              onClick={() => setShowHistory(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              <History className="h-4 w-4" />
              历史记录
            </button>
          </>
        }
        stats={toolStats}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ToolPanel className="rounded-[32px] p-6" eyebrow="Conversion Desk" title="双栏语义转换台">
          <div className="flex flex-wrap gap-3">
            {[
              { id: 'translate', label: '多语言翻译' },
              { id: 'convert', label: '繁简转换' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'translate' | 'convert')}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  activeTab === tab.id
                    ? 'bg-[var(--stratum-navy)] text-white'
                    : 'bg-[var(--stratum-surface-low)] text-slate-600 hover:bg-[#e9f3ee]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[28px] border border-[rgba(16,185,129,0.18)] bg-[linear-gradient(180deg,rgba(240,253,250,0.62)_0%,rgba(255,255,255,0.92)_100%)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Source Layer</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--stratum-ink)]">原始内容</h3>
                </div>
                <button onClick={() => setSourceText('')} className="text-xs text-slate-400 transition hover:text-slate-600">
                  清空
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">源语言</span>
                  <select
                    value={sourceLanguage}
                    onChange={(event) => setSourceLanguage(event.target.value)}
                    disabled={activeTab !== 'translate'}
                    className="h-11 w-full rounded-2xl border border-[var(--stratum-line)] bg-white px-4 text-sm text-[var(--stratum-ink)] outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">目标语言</span>
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    disabled={activeTab !== 'translate'}
                    className="h-11 w-full rounded-2xl border border-[var(--stratum-line)] bg-white px-4 text-sm text-[var(--stratum-ink)] outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    {LANGUAGE_OPTIONS.filter((option) => option.value !== 'auto').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={activeTab === 'translate' ? '输入要翻译的文本...' : '输入需要进行简繁转换的文本...'}
                className="mt-4 h-72 w-full resize-none rounded-[24px] border border-[var(--stratum-line)] bg-white px-4 py-4 text-sm leading-7 text-[var(--stratum-ink)] outline-none placeholder:text-slate-400"
              />

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>{sourceText.length} 字符</span>
                {activeTab === 'translate' ? (
                  <button
                    onClick={handleSwap}
                    className="rounded-full bg-[var(--stratum-surface-low)] px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-[#e9f3ee]"
                  >
                    交换语言
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-[var(--stratum-line)] bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Output Layer</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--stratum-ink)]">转换结果</h3>
                </div>
                <button
                  onClick={handleCopy}
                  disabled={!targetText}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700 disabled:opacity-40"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>

              <div className="mt-4 flex h-72 rounded-[24px] bg-[var(--stratum-surface-low)] px-4 py-4">
                {targetText ? (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--stratum-ink)]">{targetText}</p>
                ) : (
                  <div className="flex w-full items-center justify-center text-sm text-slate-400">
                    结果会显示在这里
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>{targetText.length} 字符</span>
                {targetText ? (
                  <Link
                    href={`/workspace/${params.workspaceId}/canvas` as Route}
                    className="rounded-full bg-[#e8faf2] px-3 py-1.5 font-semibold text-emerald-700"
                  >
                    发送回画布
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--stratum-line)] pt-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Active Mode</p>
              <p className="mt-2 text-sm font-semibold text-[var(--stratum-ink)]">{activeModeLabel}</p>
            </div>
            <button
              onClick={handleTranslate}
              disabled={!sourceText.trim() || isTranslating}
              className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#10b981_0%,#0f766e_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_20px_40px_rgba(16,185,129,0.24)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {isTranslating ? '转换中...' : activeTab === 'translate' ? '开始翻译' : '开始转换'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-[22px] bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </ToolPanel>

        <div className="space-y-5">
          <ToolPanel eyebrow="Modes" title="选择语气与转换方式">
            <div className="space-y-3">
              {currentModeOptions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  className={cn(
                    'w-full rounded-[24px] border px-4 py-4 text-left transition',
                    mode === item.id
                      ? 'border-emerald-200 bg-[#ebfbf3]'
                      : 'border-[var(--stratum-line)] bg-white hover:bg-[var(--stratum-surface-low)]'
                  )}
                >
                  <p className="text-sm font-semibold text-[var(--stratum-ink)]">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </button>
              ))}
            </div>
          </ToolPanel>

          <ToolPanel eyebrow="Quick Starts" title="专属卡片示例">
            <div className="space-y-3">
              {quickExamples.map((example) => (
                <button
                  key={example.label}
                  onClick={() => applyExample(example)}
                  className="w-full rounded-[24px] bg-[var(--stratum-surface-low)] px-4 py-4 text-left transition hover:bg-[#e9f3ee]"
                >
                  <p className="text-sm font-semibold text-[var(--stratum-ink)]">{example.label}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{example.source}</p>
                </button>
              ))}
            </div>
          </ToolPanel>

          <ToolPanel eyebrow="Recent History" title="最近输出">
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[var(--stratum-line)] px-4 py-4 text-sm text-slate-500">
                  还没有本地转换记录。
                </div>
              ) : (
                history.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="w-full rounded-[22px] bg-[var(--stratum-surface-low)] px-4 py-4 text-left transition hover:bg-[#e9f3ee]"
                  >
                    <p className="line-clamp-2 text-sm text-[var(--stratum-ink)]">{item.source}</p>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-600">{item.target}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-400">{item.mode}</p>
                  </button>
                ))
              )}
            </div>
          </ToolPanel>
        </div>
      </section>

      {showHistory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-[var(--stratum-line)] px-6 py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">History Drawer</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--stratum-ink)]">翻译历史</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full bg-[var(--stratum-surface-low)] px-3 py-2 text-sm font-semibold text-slate-600"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[68vh] space-y-3 overflow-y-auto px-6 py-6">
              {history.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[var(--stratum-line)] px-4 py-6 text-center text-sm text-slate-500">
                  暂无翻译历史
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="w-full rounded-[24px] border border-[var(--stratum-line)] bg-[var(--stratum-surface-low)] px-5 py-5 text-left transition hover:bg-[#e9f3ee]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm text-[var(--stratum-ink)]">{item.source}</p>
                        <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-600">{item.target}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                          {item.mode}
                        </span>
                        <p className="mt-2 text-xs text-slate-400">
                          {item.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
