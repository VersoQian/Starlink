'use client'

import type { Message } from '../types'
import { useTheme, cn, bgToText } from '@/lib/theme'

type MessageBubbleProps = {
  message: Message
  isUser: boolean
}

export function MessageBubble({ message, isUser }: MessageBubbleProps) {
  const { theme } = useTheme()

  if (message.role === 'system') {
    return (
      <div className="flex justify-center mb-6">
        <div className={cn('max-w-[85%] border rounded-2xl px-5 py-3 text-center shadow-sm', theme.colors.background.card, theme.colors.border.default, theme.colors.text.secondary)}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-3 w-[85%] ml-auto mb-6">
        <div className="flex flex-col items-end">
          <div className={cn('bg-gradient-to-r text-white rounded-2xl rounded-tr-sm px-5 py-4 shadow-lg', theme.colors.brand.from, theme.colors.brand.to)}>
            <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
          <div className={cn('mt-2 text-xs', theme.colors.text.muted)}>
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
        <div className={cn('bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 shrink-0 bg-gradient-to-br', theme.colors.brand.from, theme.colors.brand.to)}></div>
      </div>
    )
  }

  return (
    <div className="flex justify-start items-start gap-3 w-[85%] mb-6">
      <div className={cn('flex items-center justify-center rounded-full size-8 shrink-0', theme.colors.brand.light)}>
        <svg className={cn('w-5 h-5', bgToText(theme.colors.brand.solid))} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <div className={cn('rounded-2xl rounded-tl-sm px-5 py-4 border shadow-sm', theme.colors.background.card, theme.colors.text.secondary, theme.colors.border.default)}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* 实时反馈标签 - 学习原型的设计 */}
        {message.feedback && (
          <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs text-green-600 w-fit border border-green-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{message.feedback}</span>
          </div>
        )}

        <div className={cn('text-xs', theme.colors.text.muted)}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  )
}
