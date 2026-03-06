'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTheme, cn } from '@/lib/theme'
import { useWorkspaceGraph } from '@/features/workspace/hooks'
import { useConversationRuntime } from '@/features/workspace/hooks/use-conversation-runtime'
import { buildAgentWorkspaceSnapshot, buildSeminarSnapshot } from '@/features/workspace/lib/agent-runtime'

type SeminarPageProps = {
  params: { workspaceId: string }
}

const PHASES = [
  { key: 'planning', label: '规划阶段' },
  { key: 'execution', label: '执行阶段' },
  { key: 'review', label: '交叉质询' },
  { key: 'decision', label: '决策收敛' }
] as const

export default function SeminarPage({ params }: SeminarPageProps) {
  const { theme } = useTheme()
  const { data, isLoading, isError, refetch } = useWorkspaceGraph(params.workspaceId)
  const runtime = useConversationRuntime(params.workspaceId)

  const snapshot = useMemo(() => {
    if (!data) return null
    const agentSnapshot = buildAgentWorkspaceSnapshot(data)
    const seminar = buildSeminarSnapshot(agentSnapshot)
    return { agentSnapshot, seminar }
  }, [data])

  const hasRuntimeTurns = runtime.seminarTurns.length > 0
  const phaseCount = {
    planning: hasRuntimeTurns
      ? runtime.seminarTurns.filter((item) => item.payload.phase === 'planning').length
      : (snapshot?.seminar.planning.length ?? 0),
    execution: hasRuntimeTurns
      ? runtime.seminarTurns.filter((item) => item.payload.phase === 'execution').length
      : (snapshot?.seminar.execution.length ?? 0),
    review: hasRuntimeTurns
      ? runtime.seminarTurns.filter((item) => item.payload.phase === 'review').length
      : (snapshot?.seminar.review.length ?? 0),
    decision: hasRuntimeTurns
      ? runtime.seminarTurns.filter((item) => item.payload.phase === 'decision').length
      : (snapshot?.seminar.decision.length ?? 0)
  }

  const openingStatements = useMemo(() => {
    const runtimeExecution = runtime.seminarTurns.filter((item) => item.payload.phase === 'execution')
    if (runtimeExecution.length > 0) {
      const byAgent = new Map<string, { agentId: string; agentName: string; summary: string }>()
      for (const turn of runtimeExecution) {
        if (!byAgent.has(turn.payload.agentId)) {
          byAgent.set(turn.payload.agentId, {
            agentId: turn.payload.agentId,
            agentName: turn.payload.agentName,
            summary: turn.payload.summary || turn.payload.title
          })
        }
      }
      return [...byAgent.values()]
    }
    return snapshot?.seminar.openingStatements ?? []
  }, [runtime.seminarTurns, snapshot?.seminar.openingStatements])

  const reviewItems = useMemo(() => {
    const runtimeReview = runtime.seminarTurns.filter((item) => item.payload.phase === 'review')
    if (runtimeReview.length > 0) {
      return runtimeReview.map((item) => ({
        nodeId: item.payload.nodeId,
        title: item.payload.title,
        content: item.payload.summary,
        confidence: undefined as string | undefined,
        domain: undefined as string | undefined
      }))
    }
    return snapshot?.seminar.review ?? []
  }, [runtime.seminarTurns, snapshot?.seminar.review])

  const finalRecommendation = runtime.latestDecision ?? snapshot?.seminar.finalRecommendation ?? '暂无结论'
  const runtimePhaseText = runtime.latestPhase ? `当前阶段：${runtime.latestPhase}` : '当前阶段：waiting'

  return (
    <div className={cn('min-h-full px-8 py-8', theme.colors.background.primary, theme.colors.text.primary)}>
      <header className={cn('rounded-2xl border p-6', theme.colors.border.default, theme.colors.background.card)}>
        <h2 className="text-xl font-semibold">多智能体研讨会</h2>
        <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>
          基于当前商业画布自动聚合，按“规划-执行-质询-决策”四阶段模拟公司经营研讨。
        </p>
        <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
          {runtimePhaseText}
          {runtime.latestConversationId ? ` · conversation ${runtime.latestConversationId}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/workspace/${params.workspaceId}/agents`}
            className={cn('rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
          >
            查看 Agent 页面
          </Link>
          <Link
            href={`/workspace/${params.workspaceId}/comfy`}
            className={cn('rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
          >
            回到商业画布
          </Link>
        </div>
      </header>

      {isLoading && (
        <div className={cn('mt-6 rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          正在加载研讨会数据...
        </div>
      )}

      {isError && (
        <div className={cn('mt-6 rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          <p>加载失败。</p>
          <button
            type="button"
            onClick={() => {
              void refetch()
            }}
            className={cn('mt-3 rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
          >
            重试
          </button>
        </div>
      )}

      {!isLoading && !isError && snapshot && (
        <>
          <section className="mt-6 grid gap-3 md:grid-cols-4">
            {PHASES.map((phase) => {
              const count = phaseCount[phase.key]
              const active = count > 0
              return (
                <div
                  key={phase.key}
                  className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.card)}
                >
                  <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>{phase.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{count}</p>
                  <p className={cn('text-xs', active ? 'text-emerald-500' : theme.colors.text.muted)}>
                    {active ? '已激活' : '等待数据'}
                  </p>
                </div>
              )
            })}
          </section>

          <section className={cn('mt-6 rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
            <h3 className="text-lg font-semibold">开场陈述</h3>
            {openingStatements.length === 0 ? (
              <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>暂无开场陈述。</p>
            ) : (
              <div className="mt-3 space-y-3">
                {openingStatements.map((item) => (
                  <div key={`${item.agentId}-${item.summary.slice(0, 20)}`} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                    <p className="text-sm font-medium">{item.agentName}</p>
                    <p className={cn('mt-1 whitespace-pre-line text-sm', theme.colors.text.secondary)}>{item.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={cn('mt-6 rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
            <h3 className="text-lg font-semibold">交叉质询要点</h3>
            {reviewItems.length === 0 ? (
              <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>当前没有冲突项，建议补充更多执行细节再发起下一轮。</p>
            ) : (
              <div className="mt-3 space-y-3">
                {reviewItems.map((item) => (
                  <div key={item.nodeId} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className={cn('mt-1 text-sm', theme.colors.text.secondary)}>{item.content || '无详细描述'}</p>
                    <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
                      {item.domain ? `维度: ${item.domain}` : '未标注维度'}
                      {item.confidence ? ` · 置信度: ${item.confidence}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={cn('mt-6 rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
            <h3 className="text-lg font-semibold">公司模拟结论</h3>
            <p className={cn('mt-3 whitespace-pre-line text-sm', theme.colors.text.secondary)}>
              {finalRecommendation}
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {snapshot.seminar.execution.slice(0, 3).map((item, index) => (
                <div key={item.nodeId} className={cn('rounded-xl border p-3', theme.colors.border.default)}>
                  <p className="text-xs font-semibold">行动 {index + 1}</p>
                  <p className={cn('mt-1 text-sm', theme.colors.text.secondary)}>{item.title}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
