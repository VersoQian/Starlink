'use client'

import { useRef, useEffect } from 'react'
import type { Message } from '../types'
import { MessageBubble } from './message-bubble'
import { useTheme, cn } from '@/lib/theme'

type ChatInterfaceProps = {
  messages: Message[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  loading: boolean
  quickReplies?: string[]
  onQuickReply: (reply: string) => void
  onClearSession?: () => void
}

export function ChatInterface({
  messages,
  input,
  onInputChange,
  onSend,
  loading,
  quickReplies = [],
  onQuickReply,
  onClearSession
}: ChatInterfaceProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className={cn('flex-1 flex flex-col relative', theme.colors.background.primary)}>
      {/* Header with Scenario Title and Restart Button */}
      <div className={cn('shrink-0 flex items-center justify-between border-b px-6 py-4 backdrop-blur-sm', theme.colors.border.default, theme.colors.background.secondary)}>
        <h2 className={cn('text-lg font-semibold', theme.colors.text.primary)}>商业谈判模拟</h2>
        {onClearSession && messages.length > 1 && (
          <button
            onClick={onClearSession}
            className={cn('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors', theme.colors.text.tertiary, theme.colors.interactive.hover, theme.colors.border.default)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            重新开始
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6" ref={chatContainerRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className={cn('w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', theme.colors.brand.from, theme.colors.brand.to)}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className={cn('text-lg font-medium mb-2', theme.colors.text.primary)}>开始模拟</h3>
              <p className={cn('text-sm', theme.colors.text.muted)}>输入开场白开始对话。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isUser={message.role === 'user'}
              />
            ))}
            <div ref={chatContainerRef} />
          </div>
        )}
      </div>

      {/* Input Area & Quick Replies */}
      <div className={cn('border-t p-4', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的回复..."
              disabled={loading}
              rows={2}
              className={cn(
                'form-textarea w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border px-4 py-3 text-sm font-normal leading-normal transition-colors disabled:opacity-50',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500/30',
                'placeholder:text-slate-400',
                theme.colors.text.primary,
                theme.colors.background.card,
                theme.colors.border.default,
                `focus:${theme.colors.border.hover}`
              )}
            ></textarea>
            <button
              onClick={onSend}
              disabled={loading || !input.trim()}
              className={cn(
                'flex h-12 min-w-[104px] shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                'bg-[#135bec] hover:bg-[#0f4ac4] shadow-[0_14px_36px_-14px_rgba(19,91,236,0.55)]'
              )}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>发送</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Replies Below Input - 学习原型的设计 */}
          {quickReplies.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => onQuickReply(reply)}
                  disabled={loading}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    theme.colors.border.default,
                    theme.colors.text.tertiary,
                    theme.colors.interactive.hover,
                    'hover:border-cyan-400'
                  )}
                >
                  &quot;{reply}&quot;
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
