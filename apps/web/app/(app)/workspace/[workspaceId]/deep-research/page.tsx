'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ArrowRightIcon } from '@radix-ui/react-icons'
import { ToolHeroCard } from '@/shared/components/tool-page-shell'
import { buildResearchPreviewStorageKey } from '@/shared/lib/tool-preview-storage'
import { cn } from '@/shared/lib/utils'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  researchData?: ResearchResult
}

type ResearchResult = {
  summary?: string
  keyPoints?: string[]
  detailedAnalysis?: string
  sources?: string[]
  recommendations?: string[]
}

const researchHighlights = [
  {
    title: '聚合分析',
    description: '把多源资料压缩成可挂接到智慧画布的结论块。'
  },
  {
    title: '研究工具',
    description: '它是画布的分析工具，不是独立主战场。'
  },
  {
    title: '结论回流',
    description: '研究摘要和建议应当回到画布继续建模与收敛。'
  }
]

const starterPrompts = [
  {
    title: '市场趋势分析',
    description: '请分析欧洲 AI 教育市场未来 24 个月的增长机会、监管约束和进入节奏。'
  },
  {
    title: '竞品结构比较',
    description: '请比较目前主要 AI 协作平台的差异化价值、商业模式和防御壁垒。'
  },
  {
    title: '风险研究',
    description: '请识别进入医疗 AI 领域时最关键的合规、数据和商业化风险。'
  },
  {
    title: '落地策略',
    description: '请给出从研究结论走向画布建模的关键假设、证据缺口和下一步。'
  }
]

function formatResearchResponse(result: ResearchResult): string {
  let response = ''

  if (result.summary) {
    response += `## 研究概览\n\n${result.summary}\n\n`
  }

  if (result.keyPoints && result.keyPoints.length > 0) {
    response += '## 关键发现\n\n'
    result.keyPoints.forEach((point: string, index: number) => {
      response += `${index + 1}. ${point}\n\n`
    })
  }

  if (result.detailedAnalysis) {
    response += `## 详细分析\n\n${result.detailedAnalysis}\n\n`
  }

  if (result.sources && result.sources.length > 0) {
    response += '## 信息来源\n\n'
    result.sources.forEach((source: string, index: number) => {
      const urlMatch = source.match(/^(.*?)\s*\((https?:\/\/[^\)]+)\)$/)
      if (urlMatch) {
        const [, name, url] = urlMatch
        response += `${index + 1}. <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-sky-600 underline">${name.trim()}</a>\n\n`
      } else if (source.match(/^https?:\/\//)) {
        response += `${index + 1}. <a href="${source}" target="_blank" rel="noopener noreferrer" class="text-sky-600 underline">${source}</a>\n\n`
      } else {
        response += `${index + 1}. ${source}\n\n`
      }
    })
  }

  if (result.recommendations && result.recommendations.length > 0) {
    response += '## 建议与推荐\n\n'
    result.recommendations.forEach((rec: string, index: number) => {
      response += `${index + 1}. ${rec}\n\n`
    })
  }

  return response.trim()
}

export default function DeepResearchPage({ params }: { params: { workspaceId: string } }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [researchError, setResearchError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`
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
      id: `${Date.now() + 1}`,
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

  const handleExport = useCallback(() => {
    const lastMessage = messages.filter((m) => m.type === 'assistant').pop()
    if (!lastMessage?.researchData) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `research-${timestamp}.md`
    const content = `# 深度研究报告\n\n${formatResearchResponse(lastMessage.researchData)}\n\n---\n*生成时间：${new Date().toLocaleString('zh-CN')}*\n`

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
      void handleSend()
    }
  }

  const hasAssistantResponse = messages.some((message) => message.type === 'assistant')
  const recentUserMessages = messages.filter((message) => message.type === 'user').slice(-4).reverse()
  const latestAssistant = messages.filter((message) => message.type === 'assistant').slice(-1)[0] ?? null
  const latestQuestion = messages.filter((message) => message.type === 'user').slice(-1)[0]?.content ?? ''

  useEffect(() => {
    if (!latestAssistant?.researchData) return

    const summary =
      latestAssistant.researchData.summary ??
      latestAssistant.researchData.keyPoints?.[0] ??
      latestAssistant.content.replace(/<[^>]+>/g, '').slice(0, 240)

    const payload = {
      question: latestQuestion,
      summary,
      sourceCount: latestAssistant.researchData.sources?.length ?? 0,
      updatedAt: new Date().toISOString()
    }

    localStorage.setItem(buildResearchPreviewStorageKey(params.workspaceId), JSON.stringify(payload))
  }, [latestAssistant, latestQuestion, params.workspaceId])

  const toolStats = useMemo(
    () => [
      { label: 'Research Turns', value: `${messages.filter((message) => message.type === 'assistant').length}` },
      { label: 'Queued Questions', value: `${messages.filter((message) => message.type === 'user').length}` },
      { label: 'Sources', value: `${latestAssistant?.researchData?.sources?.length ?? 0}` }
    ],
    [latestAssistant?.researchData?.sources?.length, messages]
  )

  return (
    <div className="space-y-8 text-[var(--stratum-ink)]">
      <ToolHeroCard
        theme="amber"
        eyebrow="@research"
        title="Deep Research Console"
        description="这是智慧画布的分析工具页，负责把资料压缩成结论、证据缺口和建议。研究完成后，结果应该回带到画布继续建模、推演和决策。"
        actions={
          <>
            <Link
              href={`/workspace/${params.workspaceId}/canvas` as Route}
              className="rounded-full bg-[var(--stratum-navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              返回智慧画布
            </Link>
            <Link
              href={`/workspace/${params.workspaceId}/knowledge` as Route}
              className="rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              打开知识工具
            </Link>
            {hasAssistantResponse && (
              <button
                onClick={handleExport}
                className="rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white"
              >
                导出报告
              </button>
            )}
          </>
        }
        stats={[
          {
            label: 'Research Turns',
            value: `${messages.filter((message) => message.type === 'assistant').length}`,
            detail: '已完成的研究输出轮次'
          },
          {
            label: 'Queued Questions',
            value: `${messages.filter((message) => message.type === 'user').length}`,
            detail: '当前研究会话中累计提出的问题'
          },
          {
            label: 'Sources',
            value: `${latestAssistant?.researchData?.sources?.length ?? 0}`,
            detail: '最近一轮研究引用的来源数量'
          },
          {
            label: 'Mode',
            value: 'analysis',
            detail: '面向画布回流的结论生成'
          }
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <article className="stratum-card rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Tool Signals</p>
            <div className="mt-4 grid gap-3">
              {toolStats.map((stat) => (
                <div key={stat.label} className="rounded-[22px] bg-[var(--stratum-surface-low)] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--stratum-navy)]">{stat.value}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="stratum-card rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">能力定位</p>
            <div className="mt-4 space-y-3">
              {researchHighlights.map((item) => (
                <div key={item.title} className="rounded-[22px] bg-[var(--stratum-surface-low)] px-4 py-4">
                  <p className="text-sm font-semibold text-[var(--stratum-ink)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="stratum-card rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Recent Questions</p>
              <button
                onClick={handleNewChat}
                className="rounded-full bg-[var(--stratum-surface-low)] px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                新建研究
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {recentUserMessages.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[var(--stratum-line)] px-4 py-4 text-sm text-slate-500">
                  暂无历史问题
                </div>
              ) : (
                recentUserMessages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => {
                      setInputValue(message.content)
                      textareaRef.current?.focus()
                    }}
                    className="block w-full rounded-[22px] bg-[var(--stratum-surface-low)] px-4 py-4 text-left text-sm leading-6 text-slate-600 transition hover:bg-[#e9edf2]"
                  >
                    {message.content}
                  </button>
                ))
              )}
            </div>
          </article>
        </aside>

        <main className="stratum-card rounded-[32px] p-6">
          {messages.length === 0 ? (
            <div className="space-y-6">
              <div className="rounded-[28px] bg-[var(--stratum-surface-low)] px-6 py-6">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Starter Prompts</p>
                <h2 className="stratum-display mt-3 text-3xl font-semibold text-[var(--stratum-ink)]">选择一个研究切口</h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  发起研究后，你得到的不是终点报告，而是一批应该回流到智慧画布的结论、证据缺口和行动建议。
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
                    className="rounded-[24px] border border-[var(--stratum-line)] bg-white px-5 py-5 text-left transition hover:border-[rgba(0,140,199,0.28)] hover:bg-[#fbfdff]"
                  >
                    <p className="text-sm font-semibold text-[var(--stratum-ink)]">{prompt.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{prompt.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[24px] bg-[var(--stratum-surface-low)] px-5 py-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Research Output</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  研究结果已生成后，优先回到智慧画布，把关键发现转成节点、假设和行动路径。
                </p>
              </div>

              <div className="max-h-[680px] min-h-[520px] space-y-4 overflow-y-auto pr-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn('flex gap-3', message.type === 'assistant' ? 'justify-start' : 'justify-end')}
                  >
                    {message.type === 'assistant' && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4ff] text-sm font-semibold text-[var(--stratum-blue)]">
                        AI
                      </div>
                    )}
                    <div className={cn('flex max-w-[82%] flex-col gap-1', message.type === 'assistant' ? 'items-start' : 'items-end')}>
                      <div
                        className={cn(
                          'rounded-[24px] px-5 py-4 text-sm leading-7',
                          message.type === 'assistant'
                            ? 'bg-[var(--stratum-surface-low)] text-slate-600'
                            : 'bg-[var(--stratum-navy)] text-white'
                        )}
                      >
                        {message.content === '' && isLoading ? (
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--stratum-blue)]" style={{ animationDelay: '0ms' }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--stratum-blue)]" style={{ animationDelay: '120ms' }} />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--stratum-blue)]" style={{ animationDelay: '240ms' }} />
                            </div>
                            <span className="text-xs text-slate-500">Researching...</span>
                          </div>
                        ) : (
                          <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: message.content
                                .replace(/\n/g, '<br />')
                                .replace(/## (.*)/g, '<h3 class="font-semibold text-base mt-3 mb-2 text-[#191c1e]">$1</h3>')
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        {message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {message.type === 'user' && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--stratum-navy)] text-xs font-semibold text-white">
                        You
                      </div>
                    )}
                  </div>
                ))}

                {researchError && (
                  <div className="rounded-[24px] bg-rose-50 px-5 py-4 text-sm leading-6 text-rose-700">
                    {researchError}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="rounded-[28px] border border-[var(--stratum-line)] bg-white px-4 py-4">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入你的研究问题，生成可回流到智慧画布的分析结论..."
                className="min-h-[56px] w-full resize-none border-none bg-transparent text-sm leading-7 text-[var(--stratum-ink)] outline-none placeholder:text-slate-400"
                rows={1}
                disabled={isLoading}
              />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">Enter 发送，Shift+Enter 换行</p>
                <div className="flex items-center gap-2">
                  {latestAssistant?.researchData && (
                    <Link
                      href={`/workspace/${params.workspaceId}/canvas` as Route}
                      className="inline-flex items-center gap-2 rounded-full bg-[#eaf4ff] px-4 py-2 text-xs font-semibold text-[var(--stratum-blue)]"
                    >
                      回到画布应用结果
                      <ArrowRightIcon />
                    </Link>
                  )}
                  <button
                    onClick={() => void handleSend()}
                    disabled={!inputValue.trim() || isLoading}
                    className="rounded-full bg-[var(--stratum-navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? '研究中...' : '发送'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>
    </div>
  )
}
