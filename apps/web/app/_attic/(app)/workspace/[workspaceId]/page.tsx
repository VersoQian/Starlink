'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo } from 'react'
import { ArrowRightIcon } from '@radix-ui/react-icons'
import { useWorkspaceAssets, useWorkspaceEntity, useWorkspaceFlowStepStates, useWorkspaceTaskRuns } from '@/entities'
import { getWorkspaceFlow, workspaceFlowStages } from '@/lib/workspace-flow'

type WorkspacePageProps = {
  params: { workspaceId: string }
}

function formatDate(value?: string | null) {
  if (!value) return 'Just now'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getStageStateLabel(status?: string) {
  if (status === 'complete') return 'Completed'
  if (status === 'active') return 'Active Phase'
  if (status === 'blocked') return 'Blocked'
  return 'Pending'
}

function getAssetTone(assetType: string) {
  if (assetType.includes('knowledge')) return 'PDF'
  if (assetType.includes('canvas')) return 'JSON'
  if (assetType.includes('research')) return 'REPORT'
  return 'ASSET'
}

function describeTask(taskType: string) {
  if (taskType.includes('knowledge')) return 'Knowledge ingest'
  if (taskType.includes('research')) return 'Research synthesis'
  if (taskType.includes('canvas')) return 'Canvas update'
  if (taskType.includes('seminar')) return 'Seminar runtime'
  return taskType
}

export default function WorkspaceHomePage({ params }: WorkspacePageProps) {
  const { workspace } = useWorkspaceEntity(params.workspaceId)
  const { stepStates } = useWorkspaceFlowStepStates(params.workspaceId)
  const { assets } = useWorkspaceAssets(params.workspaceId)
  const { taskRuns, summary } = useWorkspaceTaskRuns(params.workspaceId)
  const flowItems = useMemo(() => getWorkspaceFlow(params.workspaceId), [params.workspaceId])
  const recommendedItem = flowItems.find((item) => item.key === workspace.recommendedFlowKey) ?? flowItems[0]
  const stageCards = useMemo(
    () =>
      workspaceFlowStages.map((stage) => ({
        ...stage,
        state: stepStates.find((step) => step.stepKey === stage.id)
      })),
    [stepStates]
  )
  const recentAssets = assets.slice(0, 2)
  const pulseItems = taskRuns
    .slice(0, 4)
    .map((task) => ({
      title: describeTask(task.taskType),
      detail: task.error ?? `Status ${task.status} in current workspace`,
      time: formatDate(task.endedAt ?? task.startedAt)
    }))

  return (
    <div className="space-y-8 text-[var(--stratum-ink)]">
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_308px]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#eaf1f7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--stratum-blue)]">
                Project Active
              </span>
              <p className="text-sm text-slate-500">Internal Reference: {params.workspaceId.toUpperCase()}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
              <div>
                <h1 className="stratum-display max-w-4xl text-5xl font-semibold leading-[1.02] text-[var(--stratum-ink)]">
                  {workspace.name}
                </h1>
                <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-500">{workspace.focus}</p>
              </div>
              <div className="rounded-full bg-[#eef7ff] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--stratum-blue)]">
                {workspace.blockers.length === 0 ? 'All Engines Nominal' : 'Attention Required'}
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stageCards.map((stage) => (
              <article key={stage.id} className="space-y-3">
                <div className="h-1.5 rounded-full bg-black/[0.06]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--stratum-navy)]"
                    style={{
                      width:
                        stage.state?.status === 'complete'
                          ? '100%'
                          : stage.state?.status === 'active'
                            ? '62%'
                            : stage.state?.status === 'blocked'
                              ? '38%'
                              : '12%'
                    }}
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    {stage.accent} {stage.label}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{getStageStateLabel(stage.state?.status)}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_300px]">
            <article className="stratum-card overflow-hidden rounded-[30px] bg-[var(--stratum-glow)] p-10 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/70">AI Recommended Next Step</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-6">
                <div className="max-w-xl">
                  <h2 className="stratum-display text-4xl font-semibold leading-tight">
                    进入 {recommendedItem.label}
                  </h2>
                  <p className="mt-4 text-base leading-8 text-white/78">
                    {recommendedItem.description} 当前建议产出：{recommendedItem.deliverable}。
                  </p>
                </div>
                <Link
                  href={recommendedItem.href as Route}
                  className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-base font-semibold text-[var(--stratum-navy)] shadow-[0_16px_40px_rgba(19,27,46,0.18)] transition hover:translate-y-[-1px]"
                >
                  Begin {recommendedItem.shortLabel}
                  <ArrowRightIcon />
                </Link>
              </div>
            </article>

            <aside className="stratum-card rounded-[28px] p-6">
              <h2 className="stratum-display text-3xl font-semibold text-[var(--stratum-ink)]">Active Pulse</h2>
              <div className="mt-6 space-y-5">
                {(pulseItems.length > 0
                  ? pulseItems
                  : [
                      {
                        title: 'Workspace Initialized',
                        detail: 'Current workspace is ready for staged execution.',
                        time: formatDate(workspace.updatedAt)
                      }
                    ]
                ).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
                    <div className="flex justify-center">
                      <span className="mt-1.5 inline-flex h-2 w-2 rounded-full bg-[var(--stratum-blue)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--stratum-ink)]">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href={`/monitor?workspace=${encodeURIComponent(params.workspaceId)}` as Route}
                className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--stratum-surface-low)] px-4 py-3 text-sm font-medium text-slate-500 transition hover:text-[var(--stratum-navy)]"
              >
                Full Activity Log
              </Link>
            </aside>
          </div>

          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="stratum-display text-3xl font-semibold text-[var(--stratum-ink)]">Recent Workspace Assets</h2>
              <Link
                href={`/workspace/${params.workspaceId}/knowledge` as Route}
                className="text-sm font-semibold text-[var(--stratum-blue)]"
              >
                View Library
              </Link>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {(recentAssets.length > 0
                ? recentAssets
                : [
                    {
                      assetId: 'placeholder',
                      title: 'No assets yet',
                      assetType: 'knowledge-base',
                      sourceModule: 'workspace',
                      updatedAt: workspace.updatedAt
                    }
                  ]
              ).map((asset) => (
                <article key={asset.assetId} className="stratum-card rounded-[28px] border border-[rgba(137,206,255,0.32)] p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--stratum-surface-low)] text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {getAssetTone(asset.assetType)}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                      {asset.assetType.replace(/-/g, ' ')}
                    </p>
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold text-[var(--stratum-ink)]">{asset.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Source module {asset.sourceModule}. Updated {formatDate(asset.updatedAt)}.
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="xl:pt-[33rem]">
          <div className="rounded-[28px] bg-[var(--stratum-navy)] p-8 text-white shadow-[0_30px_60px_rgba(19,27,46,0.22)]">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/45">Velocity Status</p>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="stratum-display text-5xl font-semibold">
                  {taskRuns.length > 0 ? Math.max(100, Math.round((summary.success / Math.max(taskRuns.length, 1)) * 100)) : 100}%
                </p>
                <p className="mt-2 text-sm text-white/65">Projected output confidence</p>
              </div>
              <div className="h-16 w-20 rounded-2xl bg-[linear-gradient(180deg,rgba(137,206,255,0.32),rgba(137,206,255,0.06))]" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-white/42">Assets</p>
                <p className="mt-1 font-semibold">{workspace.counts.assets}</p>
              </div>
              <div>
                <p className="text-white/42">Tasks</p>
                <p className="mt-1 font-semibold">{workspace.counts.tasks}</p>
              </div>
              <div>
                <p className="text-white/42">Progress</p>
                <p className="mt-1 font-semibold">{workspace.progress}%</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
