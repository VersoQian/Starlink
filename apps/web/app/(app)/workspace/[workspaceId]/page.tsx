'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useMemo } from 'react'
import {
  ArrowRightIcon,
  BarChartIcon,
  ClockIcon,
  CubeIcon,
  LightningBoltIcon,
  RocketIcon
} from '@radix-ui/react-icons'
import { useWorkspaceAssets, useWorkspaceEntity, useWorkspaceFlowStepStates, useWorkspaceTaskRuns } from '@/entities'
import { getWorkspaceFlow, workspaceFlowStages } from '@/lib/workspace-flow'

type WorkspacePageProps = {
  params: { workspaceId: string }
}

const stageIcons = {
  intake: LightningBoltIcon,
  analysis: BarChartIcon,
  modeling: CubeIcon,
  delivery: RocketIcon
} as const

function statusText(status: string) {
  if (status === 'complete') return '已完成'
  if (status === 'active') return '进行中'
  if (status === 'blocked') return '阻塞'
  return '待开始'
}

function formatDate(value: string) {
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
        item: flowItems.find((item) => item.stageId === stage.id) ?? flowItems[0],
        state: stepStates.find((step) => step.stepKey === stage.id)
      })),
    [flowItems, stepStates]
  )
  const latestAssets = assets.slice(0, 3)
  const latestTasks = taskRuns.slice(0, 4)

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#F8F6FF] px-8 py-8 text-[#2E2350]">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[36px] border border-[#E6DFFF] bg-[radial-gradient(circle_at_top_left,_rgba(139,124,255,0.16),_transparent_34%),linear-gradient(180deg,_#FFFFFF,_#F7F4FF)] p-8 shadow-[0_30px_60px_-40px_rgba(110,91,255,0.28)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7C70B8]">Workspace Home</p>
              <h1 className="mt-3 font-['Outfit'] text-4xl font-semibold tracking-tight text-[#2E2350]">
                {workspace.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#6F6792]">
                {workspace.focus}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 font-semibold uppercase tracking-[0.22em] text-[#6B5FB0]">
                  {workspace.type}
                </span>
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 text-[#6B5FB0]">
                  Owner · {workspace.ownerName}
                </span>
                <span className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 text-[#6B5FB0]">
                  {workspace.members.length} 位成员
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={recommendedItem?.href as Route}
                className="rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF]"
              >
                继续当前工作
              </Link>
              <Link
                href={`/workspace/${params.workspaceId}/settings` as Route}
                className="rounded-full border border-[#D8D0FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF]"
              >
                编辑设置
              </Link>
              <Link
                href={`/monitor?workspace=${encodeURIComponent(params.workspaceId)}` as Route}
                className="rounded-full border border-[#D8D0FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF]"
              >
                查看监控
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[28px] border border-[#E6DFFF] bg-white/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">流程进度</p>
              <p className="mt-3 text-3xl font-semibold text-[#2E2350]">{workspace.progress}%</p>
              <p className="mt-2 text-sm text-[#6F6792]">
                已完成 {workspace.counts.completedSteps} / {workspace.counts.totalSteps} 个阶段
              </p>
            </div>
            <div className="rounded-[28px] border border-[#E6DFFF] bg-white/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">资产沉淀</p>
              <p className="mt-3 text-3xl font-semibold text-[#2E2350]">{workspace.counts.assets}</p>
              <p className="mt-2 text-sm text-[#6F6792]">已生成的知识、画布和研讨产物</p>
            </div>
            <div className="rounded-[28px] border border-[#E6DFFF] bg-white/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">任务运行</p>
              <p className="mt-3 text-3xl font-semibold text-[#2E2350]">{workspace.counts.tasks}</p>
              <p className="mt-2 text-sm text-[#6F6792]">
                成功 {summary.success} · 运行中 {summary.running + summary.queued}
              </p>
            </div>
            <div className="rounded-[28px] border border-[#E6DFFF] bg-white/90 p-5">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">最近更新</p>
              <p className="mt-3 text-xl font-semibold text-[#2E2350]">{formatDate(workspace.updatedAt)}</p>
              <p className="mt-2 text-sm text-[#6F6792]">{workspace.currentStageId}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">阶段导航</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#2E2350]">项目阶段</h2>
                </div>
                <div className="rounded-full border border-[#E6DFFF] bg-[#F5F1FF] px-4 py-2 text-sm text-[#6F6792]">
                  推荐入口: {recommendedItem?.label}
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {stageCards.map((stage) => {
                  const Icon = stageIcons[stage.id]
                  return (
                    <Link
                      key={stage.id}
                      href={(stage.item?.href ?? recommendedItem.href) as Route}
                      className="rounded-[28px] border border-[#E8E1FF] bg-[#FBFAFF] p-5 transition hover:border-[#B9A9FF] hover:bg-[#F4F0FF]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">{stage.accent}</p>
                          <h3 className="mt-2 text-xl font-semibold text-[#2E2350]">{stage.label}</h3>
                        </div>
                        <div className="rounded-2xl border border-[#E6DFFF] bg-white p-3">
                          <Icon className="h-5 w-5 text-[#7C6CFF]" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#6F6792]">{stage.description}</p>
                      <div className="mt-4 flex items-center justify-between text-xs text-[#7C73A0]">
                        <span>{statusText(stage.state?.status ?? 'empty')}</span>
                        <span>{stage.item?.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">模块入口</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#2E2350]">直接进入业务页面</h2>
                </div>
                <Link
                  href={`/workspace/${params.workspaceId}/canvas` as Route}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8D0FF] bg-[#F5F1FF] px-4 py-2 text-sm text-[#5E548E] transition hover:bg-[#EEE8FF]"
                >
                  打开画布
                  <ArrowRightIcon />
                </Link>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {flowItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href as Route}
                    className={`rounded-[24px] border p-4 transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] ${
                      item.key === workspace.recommendedFlowKey ? 'border-[#CFC3FF] bg-[#F3EEFF]' : 'border-[#ECE6FF] bg-[#FCFBFF]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#2E2350]">{item.label}</p>
                      <ArrowRightIcon className="text-[#8B7CFF]" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#6F6792]">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">推荐动作</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#2E2350]">{recommendedItem.label}</h2>
              <p className="mt-3 text-sm leading-6 text-[#6F6792]">{recommendedItem.description}</p>
              {workspace.blockers[0] && (
                <div className="mt-4 rounded-[24px] border border-[#F0D6E0] bg-[#FFF4F8] p-4 text-sm leading-6 text-[#7A4A63]">
                  {workspace.blockers[0]}
                </div>
              )}
              <Link
                href={recommendedItem.href as Route}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF]"
              >
                进入 {recommendedItem.shortLabel}
                <ArrowRightIcon />
              </Link>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8]">Workspace Metadata</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-[24px] border border-[#EEE8FF] bg-[#FBFAFF] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8D84B8]">Owner</p>
                  <p className="mt-2 text-sm font-semibold text-[#2E2350]">{workspace.ownerName}</p>
                </div>
                <div className="rounded-[24px] border border-[#EEE8FF] bg-[#FBFAFF] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8D84B8]">Workspace Type</p>
                  <p className="mt-2 text-sm font-semibold text-[#2E2350]">{workspace.type}</p>
                </div>
                <div className="rounded-[24px] border border-[#EEE8FF] bg-[#FBFAFF] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[#8D84B8]">Members</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workspace.members.map((member) => (
                      <span
                        key={member.id}
                        className="rounded-full border border-[#DDD2FF] bg-white px-3 py-1 text-xs text-[#5E548E]"
                      >
                        {member.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <div className="flex items-center gap-2">
                <ClockIcon className="text-[#8B7CFF]" />
                <h2 className="text-xl font-semibold text-[#2E2350]">最近资产</h2>
              </div>
              <div className="mt-4 space-y-3">
                {latestAssets.length === 0 ? (
                  <p className="text-sm text-[#6F6792]">还没有沉淀资产。</p>
                ) : (
                  latestAssets.map((asset) => (
                    <div key={asset.assetId} className="rounded-[24px] border border-[#EEE8FF] bg-[#FBFAFF] p-4">
                      <p className="text-sm font-semibold text-[#2E2350]">{asset.title}</p>
                      <p className="mt-1 text-xs text-[#6F6792]">
                        {asset.assetType} · {formatDate(asset.updatedAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)]">
              <div className="flex items-center gap-2">
                <ClockIcon className="text-[#8B7CFF]" />
                <h2 className="text-xl font-semibold text-[#2E2350]">最近任务</h2>
              </div>
              <div className="mt-4 space-y-3">
                {latestTasks.length === 0 ? (
                  <p className="text-sm text-[#6F6792]">还没有任务运行记录。</p>
                ) : (
                  latestTasks.map((task) => (
                    <div key={task.taskId} className="rounded-[24px] border border-[#EEE8FF] bg-[#FBFAFF] p-4">
                      <p className="text-sm font-semibold text-[#2E2350]">{task.taskType}</p>
                      <p className="mt-1 text-xs text-[#6F6792]">
                        {task.status} · {formatDate(task.endedAt ?? task.startedAt ?? workspace.updatedAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
