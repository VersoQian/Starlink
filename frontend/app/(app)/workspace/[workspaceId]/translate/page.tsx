'use client'

import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'
import { Copy, Check, History, Sparkles, ChevronDown } from 'lucide-react'

type TranslateMode = 'standard' | 'formal' | 'casual' | 'professional' | 'simplified-traditional' | 'traditional-simplified'

type TranslationHistory = {
  id: string
  source: string
  target: string
  mode: string
  timestamp: Date
}

const LANGUAGE_OPTIONS = [
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
  { id: 'formal', label: '正式语气', description: '适合商务、学术场景' },
  { id: 'casual', label: '口语化', description: '日常对话、社交媒体' },
  { id: 'professional', label: '专业术语', description: '保留行业术语和技术词汇' }
]

const CONVERSION_MODES = [
  { id: 'simplified-traditional', label: '简→繁', description: '简体转繁体' },
  { id: 'traditional-simplified', label: '繁→简', description: '繁体转简体' }
]

export default function TranslatePage({ params }: { params: { workspaceId: string } }) {
  const [sourceText, setSourceText] = useState('')
  const [targetText, setTargetText] = useState('')
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [targetLanguage, setTargetLanguage] = useState('zh-CN')
  const [mode, setMode] = useState<TranslateMode>('standard')
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<TranslationHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'translate' | 'convert'>('translate')

  const targetTextRef = useRef<HTMLTextAreaElement>(null)

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

      // 添加到历史记录
      const newHistory: TranslationHistory = {
        id: Date.now().toString(),
        source: sourceText,
        target: data.translation,
        mode: TRANSLATE_MODES.find(m => m.id === mode)?.label || CONVERSION_MODES.find(m => m.id === mode)?.label || mode,
        timestamp: new Date()
      }
      setHistory([newHistory, ...history.slice(0, 9)]) // 保留最近10条
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
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败')
    }
  }

  const handleSwap = () => {
    setSourceText(targetText)
    setTargetText(sourceText)
    const temp = sourceLanguage
    setSourceLanguage(targetLanguage)
    setTargetLanguage(temp === 'auto' ? 'en' : temp)
  }

  const loadHistoryItem = (item: TranslationHistory) => {
    setSourceText(item.source)
    setTargetText(item.target)
    setShowHistory(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F6F7FF] to-[#EEF1FF] px-8 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">智能翻译助手</h1>
              <p className="mt-1 text-sm text-slate-600">
                支持多语言翻译、繁简转换、多种语气风格
              </p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 rounded-full border border-[#E3E6FF] bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[#F7F8FF]"
            >
              <History className="h-4 w-4" />
              历史记录 ({history.length})
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 主翻译区 */}
          <div className="space-y-6">
            {/* Tab切换 */}
            <div className="flex gap-3">
              <button
                onClick={() => setActiveTab('translate')}
                className={clsx(
                  'rounded-2xl px-6 py-3 text-sm font-semibold transition',
                  activeTab === 'translate'
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-[#C8CBFF]'
                    : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'
                )}
              >
                多语言翻译
              </button>
              <button
                onClick={() => setActiveTab('convert')}
                className={clsx(
                  'rounded-2xl px-6 py-3 text-sm font-semibold transition',
                  activeTab === 'convert'
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-[#C8CBFF]'
                    : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-800'
                )}
              >
                繁简转换
              </button>
            </div>

            {/* 主卡片 */}
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-indigo-100/40">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 源文本 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">源语言</p>
                      {activeTab === 'translate' && (
                        <select
                          value={sourceLanguage}
                          onChange={(e) => setSourceLanguage(e.target.value)}
                          className="mt-1 rounded-lg border border-[#E3E6FF] bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-[#9B87F5] focus:outline-none"
                        >
                          <option value="auto">自动检测</option>
                          {LANGUAGE_OPTIONS.map(lang => (
                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <button
                      onClick={() => setSourceText('')}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      清空
                    </button>
                  </div>

                  <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    placeholder={activeTab === 'translate' ? '输入要翻译的文本...' : '输入简体或繁体中文...'}
                    className="h-64 w-full resize-none rounded-xl border border-[#E3E6FF] bg-[#F7F8FF] px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#9B87F5] focus:outline-none"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{sourceText.length} 字符</span>
                  </div>
                </div>

                {/* 翻译结果 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">目标语言</p>
                      {activeTab === 'translate' && (
                        <select
                          value={targetLanguage}
                          onChange={(e) => setTargetLanguage(e.target.value)}
                          className="mt-1 rounded-lg border border-[#E3E6FF] bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-[#9B87F5] focus:outline-none"
                        >
                          {LANGUAGE_OPTIONS.map(lang => (
                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <button
                      onClick={handleCopy}
                      disabled={!targetText}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-40"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>

                  <div className="relative h-64 w-full rounded-xl border border-[#E3E6FF] bg-[#F7F8FF] px-4 py-3">
                    {targetText ? (
                      <p className="whitespace-pre-wrap text-sm text-slate-800">{targetText}</p>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        翻译结果将显示在这里
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{targetText.length} 字符</span>
                  </div>
                </div>
              </div>

              {/* 控制栏 */}
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#E3E6FF] pt-6">
                <div className="flex items-center gap-3">
                  {activeTab === 'translate' && (
                    <button
                      onClick={handleSwap}
                      className="rounded-xl border border-[#E3E6FF] bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#F7F8FF]"
                    >
                      ⇄ 交换语言
                    </button>
                  )}
                </div>

                <button
                  onClick={handleTranslate}
                  disabled={!sourceText.trim() || isTranslating}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md',
                    !sourceText.trim() || isTranslating
                      ? 'cursor-not-allowed bg-slate-300'
                      : 'bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] hover:from-[#8E7EEE] hover:to-[#6E60E6]'
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {isTranslating ? '翻译中...' : activeTab === 'translate' ? '开始翻译' : '开始转换'}
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-4">
            {/* 翻译模式 */}
            <div className="rounded-2xl border border-[#E3E6FF] bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {activeTab === 'translate' ? '翻译风格' : '转换模式'}
              </h3>
              <div className="mt-3 space-y-2">
                {(activeTab === 'translate' ? TRANSLATE_MODES : CONVERSION_MODES).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setMode(item.id as TranslateMode)}
                    className={clsx(
                      'w-full rounded-xl p-3 text-left transition',
                      mode === item.id
                        ? 'bg-[#EEF0FF] ring-1 ring-[#9B87F5]'
                        : 'bg-[#F7F8FF] hover:bg-[#EEF0FF]'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 快速示例 */}
            <div className="rounded-2xl border border-[#E3E6FF] bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">快速示例</h3>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setSourceText('Hello, how are you today?')}
                  className="w-full rounded-lg bg-[#F7F8FF] px-3 py-2 text-left text-xs text-slate-700 hover:bg-[#EEF0FF]"
                >
                  英文→中文
                </button>
                <button
                  onClick={() => setSourceText('我们需要在本季度完成产品发布')}
                  className="w-full rounded-lg bg-[#F7F8FF] px-3 py-2 text-left text-xs text-slate-700 hover:bg-[#EEF0FF]"
                >
                  中文→英文
                </button>
                <button
                  onClick={() => {
                    setActiveTab('convert')
                    setMode('simplified-traditional')
                    setSourceText('这是简体中文的示例文本')
                  }}
                  className="w-full rounded-lg bg-[#F7F8FF] px-3 py-2 text-left text-xs text-slate-700 hover:bg-[#EEF0FF]"
                >
                  简体→繁体
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 历史记录弹窗 */}
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-[#E3E6FF] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">翻译历史</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                {history.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    暂无翻译历史
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        className="w-full rounded-xl border border-[#E3E6FF] bg-[#F7F8FF] p-4 text-left transition hover:bg-[#EEF0FF]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-2">
                            <p className="text-sm text-slate-700 line-clamp-2">{item.source}</p>
                            <p className="text-xs text-slate-500">→</p>
                            <p className="text-sm text-slate-900 font-medium line-clamp-2">{item.target}</p>
                          </div>
                          <div className="text-right">
                            <span className="rounded-full bg-[#EEF0FF] px-2 py-1 text-xs text-[#7A6EEF]">
                              {item.mode}
                            </span>
                            <p className="mt-2 text-xs text-slate-400">
                              {item.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
