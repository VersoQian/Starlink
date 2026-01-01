'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Scenario } from '../types'
import { useTheme, cn } from '@/lib/theme'

type ScenarioListProps = {
  scenarios: Scenario[]
  currentScenarioId?: string
}

export function ScenarioList({ scenarios, currentScenarioId }: ScenarioListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { theme } = useTheme()

  const filteredScenarios = scenarios.filter((scenario) =>
    scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    scenario.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <aside className={cn('w-[320px] border-r flex flex-col backdrop-blur', theme.colors.border.default, theme.colors.background.secondary)}>
      {/* Header */}
      <div className="p-6 pb-2">
        <h2 className={cn('text-xl font-bold mb-1', theme.colors.text.primary)}>场景</h2>
        <p className={cn('text-xs', theme.colors.text.muted)}>选择分类</p>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2.5',
          theme.colors.background.card,
          theme.colors.border.default,
          `focus-within:${theme.colors.border.hover}`
        )}>
          <svg className={cn('w-4 h-4 shrink-0', theme.colors.text.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="查找场景..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full bg-transparent text-sm transition focus:outline-none',
              theme.colors.text.secondary,
              'placeholder:text-slate-400'
            )}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 pb-4">
        <div className="flex flex-col gap-1">
          {['谈判', '市场营销', '社交礼仪', '演讲展示'].map((cat) => {
            const isActive = searchQuery.toLowerCase().includes(cat.toLowerCase())
            return (
              <button
                key={cat}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? cn('border text-cyan-500', theme.colors.interactive.active, theme.colors.border.hover)
                    : cn(theme.colors.text.tertiary, theme.colors.interactive.hover, `hover:${theme.colors.text.primary}`)
                )}
              >
                <CategoryIcon category={cat} active={isActive} />
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      <div className={cn('h-[1px] mx-6 mb-4', theme.colors.border.default.replace('border-', 'bg-'))} />

      {/* Scenario List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {filteredScenarios.map((scenario) => {
          const isCurrentScenario = currentScenarioId === scenario.id
          return (
            <Link
              key={scenario.id}
              href={`/practice/${scenario.id}`}
              className={cn(
                'block p-4 rounded-2xl border transition-all group',
                isCurrentScenario
                  ? cn('shadow-sm', theme.colors.brand.light, theme.colors.border.hover)
                  : cn(theme.colors.background.card, theme.colors.border.default, theme.colors.interactive.hover, 'hover:border-cyan-400/50')
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-1 w-8 h-8 rounded-lg flex items-center justify-center',
                  isCurrentScenario
                    ? cn('bg-cyan-500/10 text-cyan-500')
                    : cn(theme.colors.background.card, theme.colors.text.muted, 'group-hover:bg-opacity-80')
                )}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className={cn(
                    'font-semibold text-sm',
                    isCurrentScenario
                      ? 'text-cyan-500'
                      : cn(theme.colors.text.secondary, `group-hover:${theme.colors.text.primary}`)
                  )}>
                    {scenario.title}
                  </h3>
                  <p className={cn('mt-1 text-xs line-clamp-2 leading-relaxed', theme.colors.text.muted)}>
                    {scenario.description}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

function CategoryIcon({ category, active }: { category: string; active?: boolean }) {
  const { theme } = useTheme()
  const iconClass = cn(
    'w-5 h-5',
    active ? 'text-cyan-500' : theme.colors.text.muted
  )
  const icons: Record<string, JSX.Element> = {
    '谈判': <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
    '市场营销': <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
    '社交礼仪': <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
    '演讲展示': <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  }
  return icons[category] || icons['谈判']
}
