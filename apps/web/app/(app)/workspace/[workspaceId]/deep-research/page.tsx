'use client'

import { useState, useCallback, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import clsx from 'clsx'
import { useTheme, cn } from '@/lib/theme'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  researchData?: any
}

const researchHighlights = [
  {
    title: '多源聚合',
    description: '同时联通学术数据库、新闻快讯与行业报告'
  },
  {
    title: '结构化洞察',
    description: '自动生成研究概览、关键发现与策略建议'
  },
  {
    title: '一键导出',
    description: '支持 Markdown 报告下载，方便协作复盘'
  }
]

const starterPrompts = [
  {
    icon: '📈',
    title: '市场趋势分析',
    description: '人工智能在教育领域的应用现状和未来发展趋势'
  },
  {
    icon: '🎓',
    title: '学术研究',
    description: '机器学习在医疗诊断中的最新研究进展'
  },
  {
    icon: '💼',
    title: '行业洞察',
    description: '电商直播带货行业的发展现状与竞争格局'
  },
  {
    icon: '🌍',
    title: '国际形势',
    description: '全球气候变化对农业生产的深远影响'
  }
]

export default function DeepResearchPage({ params }: { params: { workspaceId: string } }) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue])

  const handleSend = async () => {
    const trimmedInput = inputValue.trim()
    if (!trimmedInput || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: trimmedInput,
      timestamp: new Date()
    }
    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setResearchError(null)
    setIsLoading(true)

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: '',
      timestamp: new Date()
    }
    setMessages((prev) => [...prev, loadingMessage])

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: trimmedInput,
          researchType: 'comprehensive',
          depth: 'medium',
          sources: ['academic', 'news'],
          language: 'zh'
        })
      })

      if (!response.ok) {
        const detailText = await response.text()
        let message = detailText
        try {
          const parsed = JSON.parse(detailText)
          if (parsed && typeof parsed.message === 'string') {
            message = parsed.message
          }
        } catch {
          // ignore parsing failure
        }
        throw new Error(message || '研究失败，请稍后重试')
      }

      const data = await response.json()

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: formatResearchResponse(data.result),
                researchData: data.result
              }
            : msg
        )
      )
    } catch (error) {
      setResearchError(error instanceof Error ? error.message : '研究失败，请重试')
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id))
    } finally {
      setIsLoading(false)
    }
  }

  const formatResearchResponse = (result: any): string => {
    let response = ''

    if (result.summary) {
      response += `## 研究概览\n\n${result.summary}\n\n`
    }

    if (result.keyPoints && result.keyPoints.length > 0) {
      response += `## 🔍 关键发现\n\n`
      result.keyPoints.forEach((point: string, index: number) => {
        response += `${index + 1}. ${point}\n\n`
      })
    }

    if (result.detailedAnalysis) {
      response += `## 📊 详细分析\n\n${result.detailedAnalysis}\n\n`
    }

    if (result.sources && result.sources.length > 0) {
      response += `## 📚 信息来源\n\n`
      result.sources.forEach((source: string, index: number) => {
        // 解析 URL：格式 "资源名称 (URL)" 或直接 URL
        const urlMatch = source.match(/^(.*?)\s*\((https?:\/\/[^\)]+)\)$/)
        if (urlMatch) {
          const [, name, url] = urlMatch
          response += `${index + 1}. <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-500 underline hover:text-cyan-600">${name.trim()}</a>\n\n`
        } else if (source.match(/^https?:\/\//)) {
          // 如果是纯 URL
          response += `${index + 1}. <a href="${source}" target="_blank" rel="noopener noreferrer" class="text-cyan-500 underline hover:text-cyan-600">${source}</a>\n\n`
        } else {
          // 普通文本
          response += `${index + 1}. ${source}\n\n`
        }
      })
    }

    if (result.recommendations && result.recommendations.length > 0) {
      response += `## 💡 建议与推荐\n\n`
      result.recommendations.forEach((rec: string, index: number) => {
        response += `${index + 1}. ${rec}\n\n`
      })
    }

    return response.trim()
  }

  const handleExport = useCallback(() => {
    const lastMessage = messages.filter((m) => m.type === 'assistant').pop()
    if (!lastMessage?.researchData) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `research-${timestamp}.md`

    const content = `# 深度研究报告

${formatResearchResponse(lastMessage.researchData)}

---
*生成时间：${new Date().toLocaleString('zh-CN')}*
`

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [messages])

  const handleNewChat = () => {
    setMessages([])
    setResearchError(null)
    setInputValue('')
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const hasAssistantResponse = messages.some((message) => message.type === 'assistant')
  const recentUserMessages = messages
    .filter((message) => message.type === 'user')
    .slice(-5)
    .reverse()

  return (
    <div className={cn('min-h-screen px-8 py-10', theme.colors.background.primary)}>
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className={cn('text-3xl font-semibold', theme.colors.text.primary)}>深度研究助手</h1>
              <p className={cn('mt-1 text-sm', theme.colors.text.secondary)}>
                输入研究问题，AI 自动聚合多源信息，生成结构化报告
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasAssistantResponse && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-cyan-500 hover:to-blue-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  导出报告
                </button>
              )}
              <button
                onClick={handleNewChat}
                className={cn('rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition', theme.colors.border.default, theme.colors.background.card, theme.colors.text.primary, theme.colors.interactive.hover)}
              >
                新建研究
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* 左侧边栏 */}
          <aside className="hidden lg:block space-y-4">
            <div className={cn('rounded-2xl border p-4 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
              <h3 className={cn('text-xs font-semibold uppercase tracking-wide', theme.colors.text.muted)}>
                能力亮点
              </h3>
              <div className="mt-3 space-y-2">
                {researchHighlights.map((item) => (
                  <div key={item.title} className={cn('rounded-xl p-3', theme.colors.background.secondary)}>
                    <p className={cn('text-sm font-semibold', theme.colors.text.primary)}>{item.title}</p>
                    <p className={cn('mt-1 text-xs', theme.colors.text.secondary)}>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className={cn('rounded-2xl border p-4 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
              <h3 className={cn('text-xs font-semibold uppercase tracking-wide', theme.colors.text.muted)}>
                历史记录
              </h3>
              <div className="mt-3 space-y-2">
                {recentUserMessages.length === 0 ? (
                  <div className={cn('rounded-xl border border-dashed p-3 text-center text-xs', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.muted)}>
                    暂无历史记录
                  </div>
                ) : (
                  recentUserMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn('line-clamp-2 cursor-pointer rounded-lg px-3 py-2 text-xs transition', theme.colors.background.secondary, theme.colors.text.primary, theme.colors.interactive.hover)}
                    >
                      {message.content}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* 主内容区 */}
          <main className={cn('flex flex-col rounded-3xl p-6 shadow-xl', theme.colors.background.card)}>
            {messages.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-3xl shadow-lg">
                    🔬
                  </div>
                  <h2 className={cn('mt-6 text-2xl font-bold', theme.colors.text.primary)}>开始新的研究</h2>
                  <p className={cn('mt-2 text-sm', theme.colors.text.secondary)}>
                    选择下方示例或直接输入你的研究问题
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt.title}
                      type="button"
                      onClick={() => {
                        setInputValue(prompt.description)
                        textareaRef.current?.focus()
                      }}
                      className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition hover:border-cyan-400', theme.colors.border.default, theme.colors.background.secondary, theme.colors.interactive.hover)}
                    >
                      <div className="text-2xl">{prompt.icon}</div>
                      <div className="flex-1">
                        <p className={cn('text-sm font-semibold', theme.colors.text.primary)}>{prompt.title}</p>
                        <p className={cn('mt-1 text-xs', theme.colors.text.secondary)}>{prompt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-4 overflow-y-auto min-h-[500px] max-h-[600px] pr-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      'flex gap-3',
                      message.type === 'assistant' ? 'justify-start' : 'justify-end'
                    )}
                  >
                    {message.type === 'assistant' && (
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-lg shadow-sm', theme.colors.brand.light)}>
                        🔬
                      </div>
                    )}
                    <div className={clsx('flex max-w-[80%] flex-col gap-1', message.type === 'assistant' ? 'items-start' : 'items-end')}>
                      <div
                        className={clsx(
                          'rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm',
                          message.type === 'assistant'
                            ? cn(theme.colors.brand.light, theme.colors.text.secondary)
                            : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white'
                        )}
                      >
                        {message.content === '' && isLoading ? (
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '0ms' }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '150ms' }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className={cn('text-xs', theme.colors.text.secondary)}>AI 正在研究中...</span>
                          </div>
                        ) : (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: message.content
                                .replace(/\n/g, '<br />')
                                .replace(/## (.*)/g, `<h3 class="font-semibold text-base mt-3 mb-2">$1</h3>`)
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }}
                          />
                        )}
                      </div>
                      <span className={cn('text-[10px] uppercase tracking-wider', theme.colors.text.muted)}>
                        {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {message.type === 'user' && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-lg shadow-sm">
                        👤
                      </div>
                    )}
                  </div>
                ))}
                {researchError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-semibold text-red-900">研究失败</h4>
                        <p className="mt-1 text-xs text-red-700">{researchError}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* 输入区域 */}
            <div className="mt-6 space-y-3">
              <div className={cn('flex items-end gap-3 rounded-2xl border px-4 py-3', theme.colors.border.default, theme.colors.background.card)}>
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的研究问题，例如：人工智能在医疗领域的应用..."
                  className={cn('flex-1 resize-none border-none outline-none placeholder:text-slate-400', theme.colors.background.card, theme.colors.text.primary)}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className={clsx(
                    'rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-2 text-sm font-semibold text-white shadow-md hover:from-cyan-500 hover:to-blue-600',
                    (!inputValue.trim() || isLoading) && 'cursor-not-allowed opacity-60'
                  )}
                >
                  {isLoading ? '研究中...' : '发送'}
                </button>
              </div>
              <p className={cn('text-center text-xs', theme.colors.text.muted)}>
                Enter 发送，Shift+Enter 换行 · AI 会自动整合多源信息生成报告
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
