'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Route } from 'next'
import {
  ArrowRightIcon,
  BarChartIcon,
  CubeIcon,
  GlobeIcon,
  HomeIcon,
  LightningBoltIcon,
  PersonIcon,
  MixerHorizontalIcon,
  RocketIcon
} from '@radix-ui/react-icons'
import { useWorkspaceDirectory, useWorkspaceEntity, useWorkspaceFlowStepStates } from '@/entities'
import { ThemeToggle } from '@/components/theme-toggle'
import { getWorkspaceFlow, workspaceFlowStages } from '@/lib/workspace-flow'
import type { WorkspaceDirectoryEntry } from '@/entities/workspace/api'

const stageEntryMap = {
  intake: 'knowledge',
  analysis: 'deep-research',
  modeling: 'canvas',
  delivery: 'seminar'
} as const

const stageIcons = {
  intake: HomeIcon,
  analysis: BarChartIcon,
  modeling: CubeIcon,
  delivery: RocketIcon
} as const

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

function resolveStatusTone(status: string) {
  if (status === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100'
  if (status === 'active') return 'border-[#CFC3FF] bg-[#F3EEFF] text-[#5C48D9] dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-100'
  if (status === 'blocked') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100'
  return 'border-[#ECE4FF] bg-white text-[#6F6792] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
}

function resolveWorkspaceTone(status: string) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
  if (status === 'error') return 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200'
  return 'bg-[#F3EEFF] text-[#5E548E] dark:bg-slate-500/15 dark:text-slate-200'
}

function WorkspaceRailItem({
  workspace,
  selected,
  onSelect
}: {
  workspace: WorkspaceDirectoryEntry
  selected: boolean
  onSelect: (workspaceId: string) => void
}) {
  const progress = workspace.snapshot?.progress ?? 0
  const stage = workspace.snapshot?.currentStageId ?? 'intake'
  const tone = resolveWorkspaceTone(workspace.status)

  return (
    <button
      type="button"
      onClick={() => onSelect(workspace.workspaceId)}
      className={`w-full rounded-[28px] border p-5 text-left transition ${
        selected
          ? 'border-[#B9A9FF] bg-[#F4F0FF] shadow-[0_22px_50px_-38px_rgba(110,91,255,0.35)] dark:border-cyan-400/50 dark:bg-cyan-400/[0.08] dark:shadow-[0_0_0_1px_rgba(34,211,238,0.15)]'
          : 'border-[#E8E1FF] bg-white hover:border-[#D0C4FF] hover:bg-[#FBFAFF] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20 dark:hover:bg-white/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">{workspace.workspaceId}</p>
          <h3 className="mt-2 text-base font-semibold text-[#2E2350] dark:text-white">{workspace.name}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone}`}>
          {workspace.status === 'active' ? '进行中' : workspace.status === 'error' ? '异常' : '草稿'}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#6F6792] dark:text-slate-300/75">{workspace.focus}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-[#DDD2FF] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6B5FB0] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          {workspace.type}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#DDD2FF] bg-white px-2.5 py-1 text-[10px] font-medium text-[#6B5FB0] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
          <PersonIcon className="h-3 w-3" />
          {workspace.ownerName}
        </span>
      </div>

      <div className="mt-4 h-2 rounded-full bg-[#EFE8FF] dark:bg-white/5">
        <div
          className="h-full rounded-full bg-[#8B7CFF] transition-all dark:bg-cyan-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[#7C73A0] dark:text-slate-400">
        <span>{workspace.contributors} 人协作</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-[#9A93BF] dark:text-slate-500">
        <span>{stage}</span>
        <span>{formatDate(workspace.updatedAt)}</span>
      </div>
    </button>
  )
}

export default function DashboardPage() {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('proj-001')
  const workspaceDirectory = useWorkspaceDirectory({ activeWorkspaceId: selectedWorkspaceId })
  const selectedWorkspaceMeta = useMemo(
    () => workspaceDirectory.find((item) => item.workspaceId === selectedWorkspaceId) ?? workspaceDirectory[0],
    [selectedWorkspaceId, workspaceDirectory]
  )
  const resolvedWorkspaceId = selectedWorkspaceMeta?.workspaceId ?? selectedWorkspaceId
  const { workspace } = useWorkspaceEntity(resolvedWorkspaceId, { name: selectedWorkspaceMeta?.name })
  const { stepStates } = useWorkspaceFlowStepStates(resolvedWorkspaceId)
  const flowItems = useMemo(() => getWorkspaceFlow(resolvedWorkspaceId), [resolvedWorkspaceId])
  const flowByStage = useMemo(
    () =>
      workspaceFlowStages.map((stage) => ({
        ...stage,
        items: flowItems.filter((item) => item.stageId === stage.id),
        state: stepStates.find((step) => step.stepKey === stage.id)
      })),
    [flowItems, stepStates]
  )
  const recommendedItem = flowItems.find((item) => item.key === workspace.recommendedFlowKey) ?? flowItems[0]
  const systemLinks = [
    {
      title: '页面监控台',
      href: `/monitor?workspace=${encodeURIComponent(resolvedWorkspaceId)}`,
      description: '检查系统状态、阶段完成度和页面风险。',
      icon: MixerHorizontalIcon
    },
    {
      title: '社区中心',
      href: '/community',
      description: '查看案例、反馈与共享内容。',
      icon: GlobeIcon
    },
    {
      title: '跨文化练习',
      href: '/practice',
      description: '进入练习场景，准备正式沟通。',
      icon: LightningBoltIcon
    }
  ]

  return (
    <main className="min-h-screen bg-[#F8F6FF] text-[#2E2350] dark:bg-[#08111f] dark:text-white">
      <div className="relative overflow-hidden border-b border-[#E7E0FF] bg-[radial-gradient(circle_at_top_left,_rgba(139,124,255,0.16),_transparent_34%),radial-gradient(circle_at_82%_18%,_rgba(255,255,255,0.94),_transparent_22%),linear-gradient(180deg,_#FCFBFF,_#F5F1FF)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.14),_transparent_24%),linear-gradient(180deg,_rgba(8,17,31,0.94),_rgba(8,17,31,1))]">
        <div className="mx-auto max-w-[1540px] px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-[#7C70B8] dark:text-cyan-300/70">Navigation Hub</p>
              <h1 className="mt-3 font-['Outfit'] text-4xl font-semibold tracking-tight text-[#2E2350] dark:text-white">
                主界面只负责一件事: 跳转到正确页面
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6F6792] dark:text-slate-300/80">
                先选工作区，再选阶段或模块。这个界面不再承载全部内容，只作为整个系统的页面入口。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="sr-only" htmlFor="dashboard-workspace-switcher">切换工作区</label>
              <select
                id="dashboard-workspace-switcher"
                value={resolvedWorkspaceId}
                onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                className="h-10 rounded-full border border-[#DDD2FF] bg-white px-4 text-sm font-medium text-[#4A3F74] shadow-[0_16px_40px_-30px_rgba(110,91,255,0.35)] outline-none transition focus:border-[#8B7CFF] dark:border-white/10 dark:bg-white/10 dark:text-slate-100"
              >
                {workspaceDirectory.map((item) => (
                  <option key={item.workspaceId} value={item.workspaceId}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ThemeToggle />
              <Link
                href={workspace.recommendedHref as Route}
                className="rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
              >
                继续当前工作
              </Link>
              <Link
                href={`/workspace/${resolvedWorkspaceId}` as Route}
                className="rounded-full border border-[#DDD2FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10"
              >
                打开工作区
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[30px] border border-[#E6DFFF] bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur dark:border-white/10 dark:bg-black/20 dark:shadow-none">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">当前工作区</p>
              <p className="mt-3 text-2xl font-semibold">{selectedWorkspaceMeta?.name ?? resolvedWorkspaceId}</p>
              <p className="mt-2 text-sm text-[#6F6792] dark:text-slate-400">{selectedWorkspaceMeta?.focus ?? '等待工作区元数据接入'}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[#DDD2FF] bg-[#F7F3FF] px-3 py-1 font-semibold text-[#6B5FB0] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {selectedWorkspaceMeta?.type ?? 'workspace'}
                </span>
                <span className="rounded-full border border-[#DDD2FF] bg-[#F7F3FF] px-3 py-1 text-[#6B5FB0] dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  Owner · {selectedWorkspaceMeta?.ownerName ?? 'Workspace Owner'}
                </span>
              </div>
            </div>
            <div className="rounded-[30px] border border-[#E6DFFF] bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur dark:border-white/10 dark:bg-black/20 dark:shadow-none">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">推荐入口</p>
              <p className="mt-3 text-2xl font-semibold">{recommendedItem?.label ?? '知识库'}</p>
              <p className="mt-2 text-sm text-[#6F6792] dark:text-slate-400">当前系统判断最应该恢复的页面。</p>
            </div>
            <div className="rounded-[30px] border border-[#E6DFFF] bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur dark:border-white/10 dark:bg-black/20 dark:shadow-none">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">流程完成度</p>
              <p className="mt-3 text-2xl font-semibold">{workspace.progress}%</p>
              <p className="mt-2 text-sm text-[#6F6792] dark:text-slate-400">
                已完成 {workspace.counts.completedSteps} / {workspace.counts.totalSteps} 个阶段。
              </p>
            </div>
            <div className="rounded-[30px] border border-[#E6DFFF] bg-white/90 p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur dark:border-white/10 dark:bg-black/20 dark:shadow-none">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">系统状态</p>
              <p className="mt-3 text-2xl font-semibold">{workspace.status === 'active' ? '在线' : workspace.status}</p>
              <p className="mt-2 text-sm text-[#6F6792] dark:text-slate-400">
                资产 {workspace.counts.assets} · 任务 {workspace.counts.tasks}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1540px] gap-6 px-6 py-8 lg:grid-cols-[320px_minmax(0,1fr)_320px] lg:px-10">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#2E2350] dark:text-white">工作区</h2>
            <span className="text-xs uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">Workspace</span>
          </div>
          {workspaceDirectory.map((project) => (
            <WorkspaceRailItem
              key={project.workspaceId}
              workspace={project}
              selected={project.workspaceId === resolvedWorkspaceId}
              onSelect={setSelectedWorkspaceId}
            />
          ))}
        </section>

        <section className="space-y-6">
          <div className="rounded-[34px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">阶段导航</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2E2350] dark:text-white">先选阶段，再进入对应页面</h2>
              </div>
              <Link
                href={workspace.recommendedHref as Route}
                className="inline-flex items-center gap-2 rounded-full border border-[#D6CCFF] bg-[#F3EEFF] px-4 py-2 text-sm font-semibold text-[#5C48D9] transition hover:bg-[#ECE5FF] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100 dark:hover:bg-cyan-300/15"
              >
                继续到 {recommendedItem?.shortLabel ?? '知识'}
                <ArrowRightIcon />
              </Link>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {flowByStage.map((stage) => {
                const entryKey = stageEntryMap[stage.id]
                const entryItem = stage.items.find((item) => item.key === entryKey) ?? stage.items[0]
                const Icon = stageIcons[stage.id]

                return (
                  <Link
                    key={stage.id}
                    href={(entryItem?.href ?? workspace.recommendedHref) as Route}
                    className={`rounded-[28px] border p-5 transition hover:-translate-y-0.5 ${resolveStatusTone(stage.state?.status ?? 'empty')}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-400">{stage.accent}</p>
                        <h3 className="mt-3 text-xl font-semibold text-[#2E2350] dark:text-white">{stage.label}</h3>
                      </div>
                      <div className="rounded-2xl border border-[#E6DFFF] bg-white p-3 dark:border-white/10 dark:bg-black/20">
                        <Icon className="h-5 w-5 text-[#8B7CFF] dark:text-cyan-100" />
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[#6F6792] dark:text-slate-300/80">{stage.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {stage.items.map((item) => (
                        <span key={item.key} className="rounded-full border border-[#E6DFFF] px-3 py-1 text-[11px] text-[#675D93] dark:border-white/10 dark:text-slate-200/80">
                          {item.shortLabel}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between text-xs text-[#7C73A0] dark:text-slate-300/70">
                      <span>{stage.state?.status === 'complete' ? '已完成' : stage.state?.status === 'active' ? '进行中' : stage.state?.status === 'blocked' ? '阻塞' : '待进入'}</span>
                      <span>{entryItem?.label ?? '进入阶段'}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="rounded-[34px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">模块入口</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2E2350] dark:text-white">所有页面都可以从这里直接进入</h2>
              </div>
              <Link
                href={`/workspace/${resolvedWorkspaceId}` as Route}
                className="rounded-full border border-[#DDD2FF] bg-[#F5F1FF] px-4 py-2 text-sm text-[#5E548E] transition hover:bg-[#EEE8FF] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10"
              >
                进入画布主页
              </Link>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {flowItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href as Route}
                  className={`rounded-[24px] border p-4 transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/[0.05] ${
                    item.key === workspace.recommendedFlowKey
                      ? 'border-[#CFC3FF] bg-[#F3EEFF] dark:border-cyan-300/40 dark:bg-cyan-300/[0.07]'
                      : 'border-[#ECE6FF] bg-[#FCFBFF] dark:border-white/10 dark:bg-black/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#2E2350] dark:text-white">{item.label}</p>
                    <ArrowRightIcon className="text-[#8B7CFF] dark:text-cyan-200" />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#6F6792] dark:text-slate-400">{item.description}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-[#8D84B8] dark:text-slate-500">{item.stageId}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-500">当前建议</p>
            <h2 className="mt-2 text-xl font-semibold text-[#2E2350] dark:text-white">不要把内容都堆在主界面</h2>
            <p className="mt-3 text-sm leading-6 text-[#6F6792] dark:text-slate-300/80">
              主界面只负责跳转。真正的内容编辑、分析和讨论，应该发生在各自的业务页面里。
            </p>
            {workspace.blockers[0] && (
              <div className="mt-4 rounded-2xl border border-[#F0D6E0] bg-[#FFF4F8] p-4 text-sm leading-6 text-[#7A4A63] dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
                {workspace.blockers[0]}
              </div>
            )}
          </section>

          <section className="rounded-[30px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
            <div className="flex items-center gap-2">
              <RocketIcon className="text-[#8B7CFF] dark:text-cyan-200" />
              <h2 className="text-xl font-semibold text-[#2E2350] dark:text-white">系统入口</h2>
            </div>
            <div className="mt-4 space-y-3">
              {systemLinks.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.title}
                    href={item.href as Route}
                    className="block rounded-[22px] border border-[#ECE6FF] bg-[#FCFBFF] p-4 transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] dark:border-white/10 dark:bg-black/10 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/[0.05]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl border border-[#E6DFFF] bg-white p-2.5 dark:border-white/10 dark:bg-white/5">
                        <Icon className="h-4 w-4 text-[#8B7CFF] dark:text-cyan-200" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#2E2350] dark:text-white">{item.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-[#6F6792] dark:text-slate-400">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
