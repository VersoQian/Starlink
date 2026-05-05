'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTheme, cn } from '@/lib/theme'
import { useConversationRuntime, useWorkspaceGraph } from '@/features/workspace/hooks'
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

const STAGE_DESCRIPTIONS: Record<AgentContributionStage, string> = {
  planning: '负责拆解任务、设定路径和组织后续分析。',
  execution: '围绕所属专业视角形成分析内容和业务判断。',
  review: '识别证据缺口、逻辑冲突和需要回查的部分。',
  decision: '整合分散结论，形成收敛判断或阶段决策。'
}

const STAGE_ORDER: AgentContributionStage[] = ['planning', 'execution', 'review', 'decision']

export default function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { theme } = useTheme()
  const { data, isLoading, isError, refetch } = useWorkspaceGraph(params.workspaceId)
  const runtime = useConversationRuntime(params.workspaceId)

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

  const connectedNodeTotal = useMemo(() => {
    if (!agent) return 0
    return agent.contributions.reduce((sum, item) => sum + item.linkedEdgeCount, 0)
  }, [agent])

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

  const runtimeTimeline = useMemo(() => {
    if (!agent) return []

    return runtime.events
      .filter((event) => {
        if (runtime.latestConversationId && event.conversationId !== runtime.latestConversationId) {
          return false
        }

        if (event.type === 'phase.changed') return true
        if (event.type === 'seminar.turn.completed') {
          return event.payload.agentId === agent.id
        }
        if (event.type === 'seminar.decision.made') {
          return agent.id === 'Orchestrator' || agent.stageCounts.decision > 0
        }
        return false
      })
      .map((event) => {
        if (event.type === 'phase.changed') {
          return {
            key: `${event.type}-${event.payload.occurredAt}`,
            kind: 'phase',
            title: `阶段切换到 ${STAGE_LABELS[event.payload.phase]}`,
            description: event.payload.reason ?? '阶段已更新',
            timestamp: event.payload.occurredAt
          }
        }

        if (event.type === 'seminar.turn.completed') {
          return {
            key: `${event.type}-${event.payload.nodeId}`,
            kind: 'turn',
            title: event.payload.title,
            description: event.payload.summary || `${event.payload.agentName} 完成了一次阶段产出`,
            timestamp: event.payload.occurredAt
          }
        }

        return {
          key: `${event.type}-${event.payload.occurredAt}`,
          kind: 'decision',
          title: '形成阶段决策',
          description: event.payload.decision,
          timestamp: event.payload.occurredAt
        }
      })
  }, [agent, runtime.events, runtime.latestConversationId])

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
            <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
              {runtime.latestPhase ? `当前阶段 ${runtime.latestPhase}` : '当前暂无实时运行阶段'}
              {runtime.latestConversationId ? ` · conversation ${runtime.latestConversationId}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                总产出 {agent.contributions.length}
              </span>
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                主域 {agent.primaryDomain ?? '未标注'}
              </span>
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                协作连接 {agent.relationCount}
              </span>
              <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                来源 {agent.sources.length}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
                <p className={cn('text-[11px] uppercase tracking-widest', theme.colors.text.muted)}>Stages</p>
                <p className="mt-1 text-sm">
                  规 {agent.stageCounts.planning} · 执 {agent.stageCounts.execution} · 质 {agent.stageCounts.review} · 决 {agent.stageCounts.decision}
                </p>
              </div>
              <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
                <p className={cn('text-[11px] uppercase tracking-widest', theme.colors.text.muted)}>Confidence</p>
                <p className="mt-1 text-sm">
                  高 {agent.confidenceCounts.high ?? 0} · 中 {agent.confidenceCounts.medium ?? 0} · 低 {agent.confidenceCounts.low ?? 0}
                </p>
              </div>
              <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
                <p className={cn('text-[11px] uppercase tracking-widest', theme.colors.text.muted)}>Knowledge</p>
                <p className="mt-1 text-sm">
                  {agent.sources.length > 0 ? `${agent.sources.length} 个来源` : '暂无来源'}
                  {agent.tags.length > 0 ? ` · ${agent.tags.length} 个标签` : ''}
                </p>
              </div>
              <div className={cn('rounded-xl border px-4 py-3', theme.colors.border.default, theme.colors.background.secondary)}>
                <p className={cn('text-[11px] uppercase tracking-widest', theme.colors.text.muted)}>Linked Context</p>
                <p className="mt-1 text-sm">
                  {connectedNodeTotal > 0 ? `${connectedNodeTotal} 条关联边` : '暂无关联边'}
                </p>
              </div>
            </div>
          </header>

          <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <article className={cn('rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
              <h2 className="text-lg font-semibold">职责与边界</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                  <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>主要职责</p>
                  <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>{agent.role}</p>
                </div>
                <div className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                  <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>分析视角</p>
                  <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>{agent.perspective}</p>
                </div>
                <div className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                  <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>关注维度</p>
                  <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>
                    {agent.domains.length > 0 ? agent.domains.join(' · ') : '暂无明确维度'}
                  </p>
                </div>
                <div className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                  <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>知识线索</p>
                  <p className={cn('mt-2 text-sm', theme.colors.text.muted)}>
                    {agent.tags.length > 0 ? agent.tags.slice(0, 6).join(' · ') : '暂无标签'}
                    {agent.sources.length > 0 ? `；来源 ${agent.sources.slice(0, 2).join(' · ')}` : ''}
                  </p>
                </div>
              </div>
            </article>

            <article className={cn('rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
              <h2 className="text-lg font-semibold">协作关系</h2>
              {agent.relatedAgents.length === 0 ? (
                <p className={cn('mt-3 text-sm', theme.colors.text.muted)}>当前没有识别到明确的跨 Agent 协作链路。</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {agent.relatedAgents.map((related) => (
                    <div key={related.agentId} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{related.agentName}</p>
                          <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>
                            {snapshot?.agents.find((item) => item.id === related.agentId)?.role ?? '协同角色'}
                          </p>
                        </div>
                        <span className={cn('rounded-full border px-2.5 py-1 text-xs', theme.colors.border.default)}>
                          {related.interactionCount} 条连接
                        </span>
                      </div>
                      <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
                        {related.labels.length > 0 ? related.labels.join(' · ') : '暂无关系标签'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className={cn('mt-6 rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">运行时间线</h2>
                <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>
                  结合实时对话事件，查看该 Agent 在当前会话中的阶段推进与产出顺序。
                </p>
              </div>
              <span className={cn('rounded-full border px-3 py-1 text-xs', theme.colors.border.default)}>
                {runtimeTimeline.length} 条事件
              </span>
            </div>

            {runtimeTimeline.length === 0 ? (
              <p className={cn('mt-3 text-sm', theme.colors.text.muted)}>
                当前没有捕获到该 Agent 的实时事件，页面将继续以画布沉淀结果为主。
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {runtimeTimeline.map((item) => (
                  <div key={item.key} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>{item.description}</p>
                      </div>
                      <span className={cn('rounded-full border px-2.5 py-1 text-xs', theme.colors.border.default)}>
                        {item.kind}
                      </span>
                    </div>
                    <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>{item.timestamp}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-5">
            {STAGE_ORDER.map((stage) => {
              const stageItems = agent.contributions.filter((item) => item.stage === stage)
              return (
                <article key={stage} className={cn('rounded-2xl border p-5', theme.colors.border.default, theme.colors.background.card)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{STAGE_LABELS[stage]}阶段</h2>
                      <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>{STAGE_DESCRIPTIONS[stage]}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                        {stageItems.length} 条产出
                      </span>
                      <span className={cn('rounded-full border px-3 py-1', theme.colors.border.default)}>
                        {stageItems.reduce((sum, item) => sum + item.linkedEdgeCount, 0)} 条关联
                      </span>
                    </div>
                  </div>

                  {stageItems.length === 0 ? (
                    <p className={cn('mt-3 text-sm', theme.colors.text.muted)}>该阶段暂无记录。</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {stageItems.map((item) => (
                        <div key={item.nodeId} className={cn('rounded-xl border p-4', theme.colors.border.default)}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>
                                节点ID: {item.nodeId}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              {item.domain && (
                                <span className={cn('rounded-full border px-2 py-0.5', theme.colors.border.default)}>
                                  {item.domain}
                                </span>
                              )}
                              {item.confidence && (
                                <span className={cn('rounded-full border px-2 py-0.5', theme.colors.border.default)}>
                                  {item.confidence}
                                </span>
                              )}
                              {item.source && (
                                <span className={cn('rounded-full border px-2 py-0.5', theme.colors.border.default)}>
                                  {item.source}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className={cn('mt-2 whitespace-pre-line text-sm', theme.colors.text.secondary)}>
                            {item.content || '无详细内容'}
                          </p>
                          <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
                            {item.macraType ? `节点类型: ${item.macraType}` : '节点类型未标注'}
                            {item.linkedEdgeCount > 0 ? ` · 关联边: ${item.linkedEdgeCount}` : ' · 暂无关联边'}
                          </p>
                          {item.tags.length > 0 && (
                            <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>
                              标签: {item.tags.join(' · ')}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Link
                              href={`/workspace/${params.workspaceId}/canvas?focusNodeId=${encodeURIComponent(item.nodeId)}`}
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
