'use client'

import { ReactNode, useMemo } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeftIcon, ArrowRightIcon } from '@radix-ui/react-icons'
import { usePathname, useRouter } from 'next/navigation'
import { useWorkspaceDirectory, useWorkspaceEntity, useWorkspaceFlowStepStates } from '@/entities'
import { useTheme, cn, bgToText } from '@/lib/theme'
import { ThemeToggle } from '@/components/theme-toggle'
import { getWorkspaceFlowContext } from '@/lib/workspace-flow'

type WorkspaceLayoutProps = {
  children: ReactNode
  params: { workspaceId: string }
}

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const { workspace } = useWorkspaceEntity(params.workspaceId)
  const workspaceDirectory = useWorkspaceDirectory({ activeWorkspaceId: params.workspaceId })
  const { stepStates } = useWorkspaceFlowStepStates(params.workspaceId)
  const workspaceHomePath = `/workspace/${params.workspaceId}`
  const isWorkspaceHome = pathname === workspaceHomePath
  const workspaceSettingsPath = `/workspace/${params.workspaceId}/settings`
  const isSettingsPage = pathname === workspaceSettingsPath
  const flowContext = useMemo(
    () => getWorkspaceFlowContext(params.workspaceId, pathname),
    [params.workspaceId, pathname]
  )
  const { items, stages, activeItem, activeStage, previousItem, nextItem } = flowContext
  const recommendedItem = items.find((item) => item.key === workspace.recommendedFlowKey) ?? nextItem ?? activeItem
  const resolvedActiveStage = stages.find((stage) => stage.id === workspace.currentStageId) ?? activeStage

  function handleWorkspaceChange(nextWorkspaceId: string) {
    if (nextWorkspaceId === params.workspaceId) return
    const nextPath = pathname.replace(`/workspace/${params.workspaceId}`, `/workspace/${nextWorkspaceId}`)
    router.push(nextPath as Route)
  }

  function getStepState(stepId: string) {
    return stepStates.find((step) => step.stepKey === stepId)
  }

  function getStepBadge(stepId: string) {
    const step = getStepState(stepId)
    if (!step) return '未开始'
    if (step.status === 'complete') return '已完成'
    if (step.status === 'active') return '进行中'
    if (step.status === 'blocked') return '阻塞'
    return '待开始'
  }

  return (
    <div className={cn('grid min-h-screen grid-cols-[300px_1fr]', theme.colors.background.primary, theme.colors.text.primary)}>
      <aside className={cn('flex h-full flex-col border-r p-6 backdrop-blur', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-xs font-medium uppercase tracking-widest', theme.colors.text.muted)}>Workspace</p>
            <h2 className={cn('text-lg font-semibold', theme.colors.text.primary)}>{workspace.name}</h2>
            <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>{params.workspaceId}</p>
            <p className={cn('mt-2 text-xs leading-5', theme.colors.text.muted)}>{workspace.focus}</p>
          </div>
          <button
            className={cn('rounded-full border p-2 hover:bg-opacity-80', theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)}
            aria-label="更多"
          >
            ⋮
          </button>
        </div>

        <nav className="mt-6 space-y-5">
          <div className="rounded-2xl border border-dashed border-[#DCCFFF] bg-[#F7F3FF] p-4">
            <Link
              href={workspaceHomePath as Route}
              className={cn(
                'block rounded-2xl px-4 py-3 text-sm font-semibold transition',
                isWorkspaceHome
                  ? 'border border-[#B6A7FF] bg-white text-[#5A49D6]'
                  : 'text-[#4A3F74] hover:bg-white'
              )}
            >
              项目主页
            </Link>
            <p className="mt-2 px-1 text-xs leading-5 text-[#7A72A3]">
              这里看项目概况、最近资产和推荐入口，不做具体编辑。
            </p>
            <Link
              href={workspaceSettingsPath as Route}
              className={cn(
                'mt-3 block rounded-2xl px-4 py-3 text-sm font-semibold transition',
                isSettingsPage
                  ? 'border border-[#B6A7FF] bg-white text-[#5A49D6]'
                  : 'text-[#4A3F74] hover:bg-white'
              )}
            >
              工作区设置
            </Link>
            <p className="mt-2 px-1 text-xs leading-5 text-[#7A72A3]">
              管理名称、定位、Owner 与成员结构。
            </p>
          </div>
          {stages.map((stage) => (
            <div key={stage.id}>
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className={cn('text-[10px] font-semibold uppercase tracking-[0.28em]', theme.colors.text.muted)}>
                    {stage.accent}
                  </p>
                  <p className={cn('text-xs font-medium', theme.colors.text.secondary)}>{stage.label}</p>
                </div>
                {stage.id === resolvedActiveStage.id && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      theme.colors.brand.light,
                      bgToText(theme.colors.brand.solid)
                    )}
                  >
                    当前阶段
                  </span>
                )}
              </div>
              <p className={cn('mb-2 px-1 text-[11px]', theme.colors.text.muted)}>
                {getStepBadge(stage.id)}
              </p>
              <div className="space-y-2">
                {stage.items.map((item) => {
                  const isActive = !isWorkspaceHome && item.key === activeItem.key
                  return (
                    <Link
                      key={item.key}
                      href={item.href as Route}
                      className={cn(
                        'block rounded-2xl border px-4 py-3 transition',
                        isActive
                          ? cn('border-cyan-400/60 shadow-sm', theme.colors.brand.light)
                          : cn('border-transparent', theme.colors.interactive.hover)
                      )}
                    >
                      <div className={cn('text-sm font-semibold', isActive ? 'text-cyan-500' : theme.colors.text.primary)}>
                        {item.label}
                      </div>
                      <p className={cn('mt-1 text-xs leading-5', isActive ? theme.colors.text.secondary : theme.colors.text.muted)}>
                        {item.description}
                      </p>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-4">
          <div className={cn('rounded-2xl border p-4', theme.colors.border.default, theme.colors.background.card)}>
            <p className={cn('text-xs font-semibold uppercase tracking-[0.24em]', theme.colors.text.muted)}>Flow Guide</p>
            <h3 className="mt-2 text-sm font-semibold">
              {isWorkspaceHome ? '项目主页' : isSettingsPage ? '工作区设置' : activeItem.label}
            </h3>
            <p className={cn('mt-2 text-xs leading-5', theme.colors.text.secondary)}>
              {isWorkspaceHome
                ? '浏览项目状态、最近资产和推荐操作。'
                : isSettingsPage
                  ? '编辑工作区元数据和协作成员。'
                  : activeItem.deliverable}
            </p>
            <div className={cn('mt-3 text-[11px] leading-5', theme.colors.text.secondary)}>
              {workspace.type} · Owner {workspace.ownerName}
            </div>
            <div className={cn('mt-3 text-[11px] leading-5', theme.colors.text.muted)}>
              进度 {workspace.progress}% · 资产 {workspace.counts.assets} · 任务 {workspace.counts.tasks}
            </div>
            {workspace.blockers[0] && (
              <p className="mt-2 text-xs leading-5 text-amber-300/80">{workspace.blockers[0]}</p>
            )}
            {recommendedItem && (
              <Link
                href={recommendedItem.href as Route}
                className={cn(
                  'mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  theme.colors.border.default,
                  theme.colors.interactive.hover
                )}
              >
                推荐下一步
                <span>{recommendedItem.shortLabel}</span>
                <ArrowRightIcon />
              </Link>
            )}
          </div>

          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>成员</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {workspace.members.map((member, index) => (
                <span
                  key={member.id}
                  className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs', theme.colors.border.default, theme.colors.text.secondary)}
                >
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ['#38bdf8', '#8B7CFF', '#f97316', '#10b981'][index % 4] }}
                  />
                  {member.name}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/dashboard"
            className={cn('inline-flex items-center gap-2 text-xs transition', theme.colors.text.muted, 'hover:text-slate-400')}
          >
            ← 返回工作台
          </Link>
          <Link
            href={`/monitor?workspace=${encodeURIComponent(params.workspaceId)}`}
            className={cn('inline-flex items-center gap-2 text-xs transition', theme.colors.text.muted, 'hover:text-slate-400')}
          >
            查看页面监控台 →
          </Link>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className={cn('flex items-center justify-between border-b px-8 py-5 backdrop-blur', theme.colors.border.default, theme.colors.background.secondary)}>
          <div className="max-w-3xl">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.28em]', theme.colors.text.muted)}>
              {resolvedActiveStage.accent} · {resolvedActiveStage.label}
            </p>
            <h1 className={cn('mt-2 text-2xl font-semibold', theme.colors.text.primary)}>
              {isWorkspaceHome ? `${workspace.name} · 项目主页` : isSettingsPage ? `${workspace.name} · 工作区设置` : activeItem.label}
            </h1>
            <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>
              {isWorkspaceHome
                ? '查看当前项目的阶段状态、最近产出和模块入口。'
                : isSettingsPage
                  ? '编辑名称、定位、Owner 和成员，统一整个工作区的元数据。'
                  : activeItem.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="workspace-switcher">切换工作区</label>
            <select
              id="workspace-switcher"
              value={params.workspaceId}
              onChange={(event) => handleWorkspaceChange(event.target.value)}
              className={cn(
                'h-10 rounded-full border px-4 text-sm font-medium outline-none transition',
                theme.colors.border.default,
                theme.colors.background.card,
                theme.colors.text.primary
              )}
            >
              {workspaceDirectory.map((item) => (
                <option key={item.workspaceId} value={item.workspaceId}>
                  {item.name}
                </option>
              ))}
            </select>
            <ThemeToggle />
            {!isWorkspaceHome && !isSettingsPage && previousItem && (
              <Link
                href={previousItem.href as Route}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors',
                  theme.colors.border.default,
                  theme.colors.text.secondary,
                  theme.colors.interactive.hover
                )}
              >
                <ArrowLeftIcon />
                {previousItem.shortLabel}
              </Link>
            )}
            {!isSettingsPage && nextItem && (
              <Link
                href={recommendedItem.href as Route}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors',
                  theme.colors.border.default,
                  theme.colors.text.secondary,
                  theme.colors.interactive.hover
                )}
              >
                {recommendedItem.shortLabel}
                <ArrowRightIcon />
              </Link>
            )}
            <button
              className={cn(
                'rounded-lg border px-4 py-2 text-sm transition-colors',
                theme.colors.border.default,
                theme.colors.text.secondary,
                theme.colors.interactive.hover
              )}
            >
              分享
            </button>
            <button
              className={cn(
                'rounded-lg bg-gradient-to-r px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all',
                theme.colors.brand.from,
                theme.colors.brand.to
              )}
            >
              发布
            </button>
          </div>
        </header>

        <div className={cn('grid gap-3 border-b px-8 py-4 md:grid-cols-2 xl:grid-cols-4', theme.colors.border.default, theme.colors.background.primary)}>
          {stages.map((stage) => {
            const isActive = stage.id === resolvedActiveStage.id
            return (
              <div
                key={stage.id}
                className={cn(
                  'rounded-2xl border p-4 transition',
                  isActive
                    ? cn('shadow-sm', theme.colors.border.hover, theme.colors.background.card)
                    : cn(theme.colors.border.default, theme.colors.background.card)
                )}
              >
                <div className="flex items-center justify-between">
                  <p className={cn('text-[11px] font-semibold uppercase tracking-[0.24em]', theme.colors.text.muted)}>
                    {stage.accent}
                  </p>
                  {(isActive || getStepState(stage.id)) && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        getStepState(stage.id)?.status === 'blocked'
                          ? 'bg-rose-500/15 text-rose-200'
                          : getStepState(stage.id)?.status === 'complete'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : theme.colors.brand.light,
                        getStepState(stage.id)?.status === 'blocked' || getStepState(stage.id)?.status === 'complete'
                          ? ''
                          : bgToText(theme.colors.brand.solid)
                      )}
                    >
                      {getStepBadge(stage.id)}
                    </span>
                  )}
                </div>
                <h2 className="mt-2 text-sm font-semibold">{stage.label}</h2>
                <p className={cn('mt-1 text-xs leading-5', theme.colors.text.secondary)}>{stage.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stage.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href as Route}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                        item.key === activeItem.key
                          ? cn('border-cyan-400/60 text-cyan-500', theme.colors.brand.light)
                          : cn(theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)
                      )}
                    >
                      {item.shortLabel}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {children}
      </div>
    </div>
  )
}
