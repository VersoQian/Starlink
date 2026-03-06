'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTheme, cn } from '@/lib/theme'
import { useWorkspaceGraph } from '@/features/workspace/hooks'
import { buildAgentWorkspaceSnapshot } from '@/features/workspace/lib/agent-runtime'

type AgentsPageProps = {
  params: { workspaceId: string }
}

export default function AgentsPage({ params }: AgentsPageProps) {
  const { theme } = useTheme()
  const { data, isLoading, isError, refetch } = useWorkspaceGraph(params.workspaceId)

  const snapshot = useMemo(() => {
    if (!data) return null
    return buildAgentWorkspaceSnapshot(data)
  }, [data])

  return (
    <div className={cn('min-h-full px-8 py-8', theme.colors.background.primary, theme.colors.text.primary)}>
      <header className={cn('rounded-2xl border p-6', theme.colors.border.default, theme.colors.background.card)}>
        <h2 className="text-xl font-semibold">Agent 协作总览</h2>
        <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>
          与商业画布实时联动，展示每个 Agent 的规划思路、执行内容和阶段产出。
        </p>
        {snapshot && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
              <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>Active Agents</p>
              <p className="mt-1 text-2xl font-semibold">{snapshot.agents.length}</p>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
              <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>Canvas Nodes</p>
              <p className="mt-1 text-2xl font-semibold">{snapshot.nodeCount}</p>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
              <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>Canvas Edges</p>
              <p className="mt-1 text-2xl font-semibold">{snapshot.edgeCount}</p>
            </div>
          </div>
        )}
      </header>

      {isLoading && (
        <div className={cn('mt-6 rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          正在加载 Agent 运行数据...
        </div>
      )}

      {isError && (
        <div className={cn('mt-6 rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          <p>加载失败，无法读取画布数据。</p>
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

      {!isLoading && !isError && snapshot && snapshot.agents.length === 0 && (
        <div className={cn('mt-6 rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          当前画布尚无 Agent 产出。请在「多维画布」或「智绘·无限商业画布」先发起一轮 `startConversation`。
        </div>
      )}

      {!isLoading && !isError && snapshot && snapshot.agents.length > 0 && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {snapshot.agents.map((agent) => {
            const planningCount = agent.contributions.filter((item) => item.stage === 'planning').length
            const executionCount = agent.contributions.filter((item) => item.stage === 'execution').length
            const reviewCount = agent.contributions.filter((item) => item.stage === 'review').length
            const decisionCount = agent.contributions.filter((item) => item.stage === 'decision').length
            const latest = agent.contributions.slice(-2)

            return (
              <article
                key={agent.id}
                className={cn('rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}
                style={{ boxShadow: `0 10px 30px -20px ${agent.accent}` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{agent.name}</h3>
                    <p className={cn('text-sm', theme.colors.text.secondary)}>{agent.role}</p>
                    <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>{agent.perspective}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: agent.accent }}
                  >
                    {agent.contributions.length} 条产出
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className={cn('rounded-lg border px-3 py-2', theme.colors.border.default)}>规划: {planningCount}</div>
                  <div className={cn('rounded-lg border px-3 py-2', theme.colors.border.default)}>执行: {executionCount}</div>
                  <div className={cn('rounded-lg border px-3 py-2', theme.colors.border.default)}>质询: {reviewCount}</div>
                  <div className={cn('rounded-lg border px-3 py-2', theme.colors.border.default)}>决策: {decisionCount}</div>
                </div>

                <p className={cn('mt-4 text-xs', theme.colors.text.muted)}>
                  关注领域: {agent.domains.length > 0 ? agent.domains.join(' · ') : '未标注'}
                </p>

                <div className="mt-4 space-y-2">
                  {latest.map((item) => (
                    <div key={item.nodeId} className={cn('rounded-lg border p-3 text-xs', theme.colors.border.default)}>
                      <p className="font-medium">{item.title}</p>
                      <p className={cn('mt-1 line-clamp-2', theme.colors.text.secondary)}>
                        {item.content || '无详细描述'}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <Link
                    href={`/workspace/${params.workspaceId}/agents/${encodeURIComponent(agent.id)}`}
                    className={cn('inline-flex rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
                  >
                    查看 Agent 思考详情
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

