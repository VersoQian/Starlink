'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo } from 'react'
import { ArrowRightIcon } from '@radix-ui/react-icons'
import { buildAgentWorkspaceSnapshot, buildSeminarSnapshot } from '@/features/workspace/lib/agent-runtime'
import { useConversationRuntime, useWorkspaceGraph } from '@/features/workspace/hooks'
import { ToolHeroCard, ToolPanel } from '@/shared/components/tool-page-shell'

type ExpertsPageProps = {
  params: { workspaceId: string }
}

const phaseLabels = {
  planning: '规划',
  execution: '执行',
  review: '质询',
  decision: '决策'
} as const

export default function ExpertsPage({ params }: ExpertsPageProps) {
  const { data, isLoading, isError, refetch } = useWorkspaceGraph(params.workspaceId)
  const runtime = useConversationRuntime(params.workspaceId)

  const snapshot = useMemo(() => {
    if (!data) return null
    const agentSnapshot = buildAgentWorkspaceSnapshot(data)
    return {
      agentSnapshot,
      seminarSnapshot: buildSeminarSnapshot(agentSnapshot)
    }
  }, [data])

  const seminarTurns = runtime.seminarTurns
  const phaseCounts = useMemo(
    () => ({
      planning:
        seminarTurns.filter((item) => item.payload.phase === 'planning').length ||
        (snapshot?.seminarSnapshot.planning.length ?? 0),
      execution:
        seminarTurns.filter((item) => item.payload.phase === 'execution').length ||
        (snapshot?.seminarSnapshot.execution.length ?? 0),
      review:
        seminarTurns.filter((item) => item.payload.phase === 'review').length ||
        (snapshot?.seminarSnapshot.review.length ?? 0),
      decision:
        seminarTurns.filter((item) => item.payload.phase === 'decision').length ||
        (snapshot?.seminarSnapshot.decision.length ?? 0)
    }),
    [seminarTurns, snapshot?.seminarSnapshot]
  )

  const leadExperts = snapshot?.agentSnapshot.agents.slice(0, 4) ?? []
  const debateItems = snapshot?.seminarSnapshot.review.slice(0, 4) ?? []
  const openingStatements = snapshot?.seminarSnapshot.openingStatements.slice(0, 3) ?? []
  const finalRecommendation = runtime.latestDecision ?? snapshot?.seminarSnapshot.finalRecommendation ?? null
  const latestPhase = runtime.latestPhase ?? 'waiting'

  return (
    <div className="space-y-8 text-[var(--stratum-ink)]">
      <ToolHeroCard
        theme="ember"
        eyebrow="@experts"
        title="Experts Council"
        description="把多角色专家观点、Agent 运行线索和 Seminar 收敛结论合并到一个统一入口。这里是专家协作的工具卡页，不再让 Agent 与 Seminar 各自占据一级主心智。"
        actions={
          <>
            <Link
              href={`/workspace/${params.workspaceId}/canvas` as Route}
              className="rounded-full bg-[var(--stratum-navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              返回智慧画布
            </Link>
            <Link
              href={`/workspace/${params.workspaceId}/agents` as Route}
              className="rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              查看 Agent 详情
            </Link>
            <Link
              href={`/workspace/${params.workspaceId}/seminar` as Route}
              className="rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              查看 Seminar 详情
            </Link>
          </>
        }
        stats={[
          {
            label: 'Experts',
            value: `${snapshot?.agentSnapshot.agents.length ?? 0}`,
            detail: '当前在项目里留下分析痕迹的专家角色数'
          },
          {
            label: 'Debates',
            value: `${snapshot?.seminarSnapshot.review.length ?? 0}`,
            detail: '当前可追踪的分歧和交叉质询条目'
          },
          {
            label: 'Latest Phase',
            value: latestPhase,
            detail: runtime.latestConversationId ? `会话 ${runtime.latestConversationId}` : '尚未进入活跃会话'
          },
          {
            label: 'Council Links',
            value: `${snapshot?.agentSnapshot.linkedAgentPairs ?? 0}`,
            detail: '专家之间形成的协作连接'
          }
        ]}
      />

      {isLoading ? (
        <ToolPanel eyebrow="Council Status" title="正在装载专家协作快照">
          <div className="rounded-[24px] bg-[var(--stratum-surface-low)] px-5 py-5 text-sm leading-6 text-slate-500">
            正在读取画布图谱和协作运行时数据...
          </div>
        </ToolPanel>
      ) : null}

      {isError ? (
        <ToolPanel eyebrow="Council Status" title="专家协作数据加载失败">
          <div className="rounded-[24px] bg-rose-50 px-5 py-5 text-sm leading-6 text-rose-700">
            无法读取工作区图谱。{' '}
            <button
              type="button"
              onClick={() => {
                void refetch()
              }}
              className="font-semibold underline underline-offset-4"
            >
              重试
            </button>
          </div>
        </ToolPanel>
      ) : null}

      {!isLoading && !isError && (
        <>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <ToolPanel eyebrow="Lead Experts" title="当前专家席位">
              {leadExperts.length === 0 ? (
                <div className="rounded-[24px] bg-[var(--stratum-surface-low)] px-5 py-5 text-sm leading-6 text-slate-500">
                  目前还没有专家产出。先在智慧画布里发起一轮生成、对话或批判，这里就会出现协作卡片。
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {leadExperts.map((agent) => (
                    <article
                      key={agent.id}
                      className="rounded-[26px] border border-[var(--stratum-line)] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--stratum-ink)]">{agent.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{agent.role}</p>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white"
                          style={{ backgroundColor: agent.accent }}
                        >
                          {agent.contributions.length} items
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{agent.perspective}</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
                        <div className="rounded-2xl bg-[var(--stratum-surface-low)] px-3 py-3">
                          主域 {agent.primaryDomain ?? '未标注'}
                        </div>
                        <div className="rounded-2xl bg-[var(--stratum-surface-low)] px-3 py-3">
                          协作 {agent.relatedAgents.length}
                        </div>
                      </div>
                      <p className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-400">
                        规 {agent.stageCounts.planning} · 执 {agent.stageCounts.execution} · 质 {agent.stageCounts.review} · 决 {agent.stageCounts.decision}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </ToolPanel>

            <div className="space-y-6">
              <ToolPanel eyebrow="Council Phases" title="Seminar 四阶段">
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(phaseCounts).map(([phase, count]) => (
                    <div key={phase} className="rounded-[24px] bg-[var(--stratum-surface-low)] px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
                        {phaseLabels[phase as keyof typeof phaseLabels]}
                      </p>
                      <p className="mt-2 text-3xl font-semibold text-[var(--stratum-ink)]">{count}</p>
                    </div>
                  ))}
                </div>
              </ToolPanel>

              <ToolPanel eyebrow="Final Signal" title="当前收敛建议">
                <div className="rounded-[24px] bg-[var(--stratum-surface-low)] px-5 py-5">
                  <p className="text-sm leading-7 text-slate-600">
                    {finalRecommendation ?? '目前还没有形成最终建议。继续让专家协作、补充证据或回到画布推进建模。'}
                  </p>
                </div>
              </ToolPanel>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <ToolPanel eyebrow="Opening Views" title="开场陈述">
              <div className="space-y-3">
                {openingStatements.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--stratum-line)] px-4 py-4 text-sm text-slate-500">
                    尚未形成开场陈述。
                  </div>
                ) : (
                  openingStatements.map((item) => (
                    <article key={`${item.agentId}-${item.summary}`} className="rounded-[22px] bg-[var(--stratum-surface-low)] px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--stratum-ink)]">{item.agentName}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.summary}</p>
                    </article>
                  ))
                )}
              </div>
            </ToolPanel>

            <ToolPanel eyebrow="Debate Queue" title="当前争议点">
              {debateItems.length === 0 ? (
                <div className="rounded-[24px] bg-[var(--stratum-surface-low)] px-5 py-5 text-sm leading-6 text-slate-500">
                  当前没有明显争议点。你可以回到画布做一轮新的推演，或直接打开专家详情页查看细节。
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {debateItems.map((item) => (
                    <article key={item.nodeId} className="rounded-[24px] border border-[var(--stratum-line)] bg-white p-5">
                      <p className="text-sm font-semibold text-[var(--stratum-ink)]">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.content || '暂无详细说明'}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {item.domain ? `维度 ${item.domain}` : '等待维度标注'}
                        {item.confidence ? ` · 置信度 ${item.confidence}` : ''}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </ToolPanel>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            <ToolPanel eyebrow="Detail Views" title="继续深入">
              <p className="text-sm leading-7 text-slate-500">
                如果需要看单个 Agent 的阶段产出、关系图或来源标注，可以进入更细的详情页。
              </p>
              <Link
                href={`/workspace/${params.workspaceId}/agents` as Route}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--stratum-blue)]"
              >
                打开 Agent 详情
                <ArrowRightIcon />
              </Link>
            </ToolPanel>

            <ToolPanel eyebrow="Seminar Detail" title="查看完整研讨轨迹">
              <p className="text-sm leading-7 text-slate-500">
                需要回看完整规划、执行、质询和决策路径时，再进入 Seminar 的细节页。
              </p>
              <Link
                href={`/workspace/${params.workspaceId}/seminar` as Route}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--stratum-blue)]"
              >
                打开 Seminar 详情
                <ArrowRightIcon />
              </Link>
            </ToolPanel>

            <ToolPanel eyebrow="Back To Canvas" title="把专家结论回收到画布">
              <p className="text-sm leading-7 text-slate-500">
                专家协作的价值不是停留在面板里，而是把分歧和建议转回智慧画布，继续形成可执行方案。
              </p>
              <Link
                href={`/workspace/${params.workspaceId}/canvas` as Route}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--stratum-blue)]"
              >
                回到智慧画布
                <ArrowRightIcon />
              </Link>
            </ToolPanel>
          </section>
        </>
      )}
    </div>
  )
}
