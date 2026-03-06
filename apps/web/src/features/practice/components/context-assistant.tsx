'use client'

import { useState } from 'react'
import type { FailureCase, Insight, Resource, Scenario } from '../types'
import type { ScoreBreakdown } from '../hooks'
import { ScoreCard } from './score-card'
import { getFailureCasesByScenario } from '../data/failure-cases'
import { useTheme, cn, bgToText, type Theme } from '@/lib/theme'

type ContextAssistantProps = {
  scenario?: Scenario
  insights: Insight[]
  resources: Resource[]
  score?: ScoreBreakdown
}

type Tab = 'insights' | 'failures'

export function ContextAssistant({ scenario, insights, resources, score }: ContextAssistantProps) {
  const [activeTab, setActiveTab] = useState<Tab>('insights')
  const [expanded, setExpanded] = useState(false)
  const { theme } = useTheme()

  // 获取当前场景的失败案例
  const failureCases = scenario ? getFailureCasesByScenario(scenario.id) : []

  return (
    <aside
      className={cn(
        'flex flex-col overflow-y-auto backdrop-blur transition-all',
        expanded ? 'w-[460px] border-2' : 'w-[360px] border',
        theme.colors.border.default,
        theme.colors.background.secondary
      )}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className={cn('text-xl font-bold', theme.colors.text.primary)}>上下文助手</h2>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border',
              expanded ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm' : cn(theme.colors.text.muted, theme.colors.interactive.hover, theme.colors.border.default)
            )}
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>

        {/* Score Card */}
        {score && score.total > 0 && (
          <ScoreCard score={score} />
        )}

        {/* Tab Switcher */}
        <div className={cn('flex gap-2 p-1.5 rounded-xl border', theme.colors.background.card, theme.colors.border.default)}>
          <button
            onClick={() => setActiveTab('insights')}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all',
              activeTab === 'insights'
                ? cn('bg-gradient-to-r text-white shadow-lg', theme.colors.brand.from, theme.colors.brand.to)
                : cn(theme.colors.text.muted, theme.colors.interactive.hover)
            )}
          >
            💡 建议
          </button>
          <button
            onClick={() => setActiveTab('failures')}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all',
              activeTab === 'failures'
                ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg'
                : cn(theme.colors.text.muted, theme.colors.interactive.hover)
            )}
          >
            ⚠️ 陷阱
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'insights' ? (
          <div className="space-y-4">
            {/* Insights */}
            {insights.length > 0 ? (
              insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))
            ) : (
              // Empty state for insights
              !resources.length && (
                <div className={cn('p-6 rounded-2xl border border-dashed text-center', theme.colors.background.card, theme.colors.border.default)}>
                  <p className={cn('text-sm', theme.colors.text.muted)}>开始对话以获取实时文化建议。</p>
                </div>
              )
            )}

            {/* Resources */}
            {resources.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className={cn('text-sm font-semibold uppercase tracking-wider pl-1', theme.colors.text.muted)}>资源</h3>
                {resources.map((resource, index) => (
                  <ResourceCard key={index} resource={resource} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Failure Cases */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className={cn('text-sm font-semibold uppercase tracking-wider pl-1', theme.colors.text.muted)}>常见陷阱</h3>
            </div>

            <div className="space-y-3">
              {failureCases.map((failureCase) => (
                <FailureCaseCard key={failureCase.id} failureCase={failureCase} />
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
  const { theme } = useTheme()
  const { icon, bg } = getInsightStyles(insight.title, theme)

  return (
    <div
      className={cn(
        'p-4 rounded-2xl border transition-all group shadow-sm hover:border-cyan-400/50 min-h-[108px]',
        theme.colors.background.card,
        theme.colors.border.default
      )}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className={cn('mt-0.5 p-1.5 rounded-lg', bg)}>
          {icon}
        </div>
        <h4 className={cn('text-sm font-semibold transition-colors', theme.colors.text.primary)}>{insight.title}</h4>
      </div>
      <p className={cn('text-sm leading-relaxed pl-[44px] line-clamp-2', theme.colors.text.secondary)}>{insight.detail}</p>
    </div>
  )
}

function getInsightStyles(title: string, theme: Theme) {
  // Cultural Etiquette
  if (title.includes('Cultural') || title.includes('Etiquette') || title.includes('文化')) {
    return {
      icon: <svg className={cn('w-4 h-4', bgToText(theme.colors.brand.solid))} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      bg: theme.colors.brand.light,
      color: bgToText(theme.colors.brand.solid),
      borderColor: `${theme.colors.border.hover}`
    }
  }
  // Strategic Advice
  if (title.includes('Strategic') || title.includes('Advice') || title.includes('策略')) {
    return {
      icon: <svg className="w-4 h-4 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
      bg: 'bg-sky-50',
      color: 'text-sky-600',
      borderColor: 'border-sky-200'
    }
  }
  // Actionable
  if (title.includes('Actionable') || title.includes('Suggestion') || title.includes('建议')) {
    return {
      icon: <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
      bg: 'bg-purple-50',
      color: 'text-purple-600',
      borderColor: 'border-purple-200'
    }
  }
  // Default
  return {
    icon: <svg className={cn('w-4 h-4', theme.colors.text.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    bg: theme.colors.background.card,
    color: theme.colors.text.secondary,
    borderColor: theme.colors.border.default
  }
}

function ResourceCard({ resource }: { resource: Resource }) {
  const { theme } = useTheme()

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('flex items-center gap-3 p-4 rounded-2xl border transition-all group shadow-sm hover:border-cyan-400/50', theme.colors.background.card, theme.colors.border.default)}
    >
      <div className={cn('p-2 rounded-lg', theme.colors.brand.light, bgToText(theme.colors.brand.solid))}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <div className="flex-1">
        <div className={cn('text-sm font-medium transition-colors group-hover:text-cyan-500', theme.colors.text.primary)}>{resource.title}</div>
        <div className={cn('text-xs mt-0.5', theme.colors.text.muted)}>外部链接</div>
      </div>
      <svg className={cn('w-4 h-4 transition-colors group-hover:text-cyan-500', theme.colors.text.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function FailureCaseCard({ failureCase }: { failureCase: FailureCase }) {
  const [expanded, setExpanded] = useState(false)

  const severityConfig = {
    high: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '高风险' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '中等' },
    low: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: '低风险' }
  }

  const config = severityConfig[failureCase.severity as keyof typeof severityConfig] || severityConfig.medium

  return (
    <div className={`p-4 rounded-2xl border ${config.border} ${config.bg} transition-all shadow-sm`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className={`text-sm font-semibold ${config.color} flex-1`}>
          {failureCase.title}
        </h4>
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${config.color} bg-white`}>
          {config.label}
        </span>
      </div>

      <div className="text-sm text-slate-700 mb-3 leading-relaxed">
        <strong>错误：</strong> {failureCase.mistake}
      </div>

      {expanded && (
        <div className="space-y-3 pt-3 border-t border-black/10">
          <div className="text-sm text-slate-700 leading-relaxed">
            <strong className="text-rose-600 block mb-1">后果：</strong> {failureCase.consequence}
          </div>
          <div className="text-sm text-slate-700 leading-relaxed">
            <strong className="text-emerald-600 block mb-1">正确做法：</strong> {failureCase.correction}
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className={`mt-2 text-xs font-medium ${config.color} hover:opacity-80 transition-opacity flex items-center gap-1`}
      >
        {expanded ? '收起' : '查看详情'}
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  )
}
