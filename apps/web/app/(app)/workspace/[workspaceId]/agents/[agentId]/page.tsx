'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTheme, cn } from '@/lib/theme'
import { useWorkspaceGraph } from '@/features/workspace/hooks'
import { buildAgentWorkspaceSnapshot, type AgentContributionStage } from '@/features/workspace/lib/agent-runtime'

type AgentDetailPageProps = {
  params: { workspaceId: string; agentId: string }
}

const STAGE_LABELS: Record<AgentContributionStage, string> = {
  planning: '规划',
  execution: '执行',
  review: '质询',
  decision: '决策'
}

const STAGE_ORDER: AgentContributionStage[] = ['planning', 'execution', 'review', 'decision']

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { theme } = useTheme()
  const { data, isLoading, isError, refetch } = useWorkspaceGraph(params.workspaceId)

  const snapshot = useMemo(() => {
    if (!data) return null
    return buildAgentWorkspaceSnapshot(data)
  }, [data])

  const nodeTitleMap = useMemo(() => {
    const entries = (data?.nodes ?? []).map((node) => {
      const record = node.data as { title?: string } | undefined
      return [node.id, record?.title ?? node.id] as const
    })
    return new Map(entries)
  }, [data?.nodes])

  const decodedAgentId = decodeURIComponent(params.agentId)
  const agent = snapshot?.agents.find((item) => item.id === decodedAgentId) ?? null

  const evidenceByNodeId = useMemo(() => {
    const map = new Map<string, Array<{ edgeId: string; relation: string; linkedNodeId: string; linkedNodeTitle: string }>>()
    if (!data || !agent) return map

    for (const contribution of agent.contributions) {
      const related = data.edges
        .filter((edge) => edge.source === contribution.nodeId || edge.target === contribution.nodeId)
        .map((edge) => {
          const outbound = edge.source === contribution.nodeId
          const linkedNodeId = outbound ? edge.target : edge.source
          return {
            edgeId: edge.id,
            relation: edge.label ?? (outbound ? 'outbound' : 'inbound'),
            linkedNodeId,
            linkedNodeTitle: nodeTitleMap.get(linkedNodeId) ?? linkedNodeId
          }
        })
      map.set(contribution.nodeId, related)
    }

    return map
  }, [agent, data, nodeTitleMap])

  return (
    <div className={cn('min-h-full px-8 py-8', theme.colors.background.primary, theme.colors.text.primary)}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/workspace/${params.workspaceId}/agents`}
          className={cn('rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
        >
          返回 Agent 列表
        </Link>
        <Link
          href={`/workspace/${params.workspaceId}/comfy`}
          className={cn('rounded-lg border px-3 py-1.5 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
        >
          打开商业画布
        </Link>
      </div>

      {isLoading && (
        <div className={cn('rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
          正在加载 Agent 详情...
        </div>
      )}

      {isError && (
        <div className={cn('rounded-2xl border p-8 text-sm', theme.colors.border.default, theme.colors.background.card)}>
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

      {!isLoading && !isError && snapshot && !agent && (
        <div className={cn('rounded-2xl border p-6', theme.colors.border.default, theme.colors.background.card)}>
          <h2 className="text-lg font-semibold">未找到该 Agent</h2>
          <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>
            当前工作区没有 `{decodedAgentId}` 的执行记录，你可以从列表中选择可用 Agent。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {snapshot.agents.map((item) => (
              <Link
                key={item.id}
                href={`/workspace/${params.workspaceId}/agents/${encodeURIComponent(item.id)}`}
                className={cn('rounded-full border px-3 py-1 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!isLoading && !isError && agent && (
        <>
          <header
            className={cn('rounded-2xl border p-6', theme.colors.border.default, theme.colors.background.card)}
            style={{ boxShadow: `0 10px 30px -20px ${agent.accent}` }}
          >
            <h1 className="text-2xl font-semibold">{agent.name}</h1>
            <p className={cn('mt-2 text-sm', theme.colors.text.secondary)}>{agent.role}</p>
            <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>{agent.perspective}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                总产出 {agent.contributions.length}
              </span>
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                维度 {agent.domains.length > 0 ? agent.domains.join(' · ') : '未标注'}
              </span>
            </div>
          </header>

          <section className="mt-6 space-y-5">
            {STAGE_ORDER.map((stage) => {
              const stageItems = agent.contributions.filter((item) => item.stage === stage)
              return (
                <article key={stage} className={cn('rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{STAGE_LABELS[stage]}阶段</h2>
                    <span className={cn('rounded-full border px-3 py-1 text-xs', theme.colors.border.default)}>
                      {stageItems.length} 条
                    </span>
                  </div>

                  {stageItems.length === 0 ? (
                    <p className={cn('mt-3 text-sm', theme.colors.text.muted)}>该阶段暂无记录。</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {stageItems.map((item) => (
                        <div key={item.nodeId} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                          <p className="font-medium">{item.title}</p>
                          <p className={cn('mt-2 whitespace-pre-line text-sm', theme.colors.text.secondary)}>
                            {item.content || '无详细内容'}
                          </p>
                          <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
                            节点ID: {item.nodeId}
                            {item.domain ? ` · 维度: ${item.domain}` : ''}
                            {item.confidence ? ` · 置信度: ${item.confidence}` : ''}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Link
                              href={`/workspace/${params.workspaceId}?focusNodeId=${encodeURIComponent(item.nodeId)}`}
                              className={cn('rounded-lg border px-2.5 py-1 text-xs', theme.colors.border.default, theme.colors.interactive.hover)}
                            >
                              在画布定位
                            </Link>
                          </div>
                          <div className="mt-3">
                            <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>证据链</p>
                            {(evidenceByNodeId.get(item.nodeId) ?? []).length === 0 ? (
                              <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>暂无关联边。</p>
                            ) : (
                              <div className="mt-2 space-y-1">
                                {(evidenceByNodeId.get(item.nodeId) ?? []).slice(0, 5).map((evidence) => (
                                  <p key={evidence.edgeId} className={cn('text-xs', theme.colors.text.muted)}>
                                    [{evidence.relation}] {evidence.linkedNodeTitle}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </section>
        </>
      )}
    </div>
  )
}
