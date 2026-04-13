'use client'

import { ReactNode, useMemo } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRightIcon,
  BellIcon,
  ExitIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  QuestionMarkCircledIcon,
  HomeIcon
} from '@radix-ui/react-icons'
import { usePathname, useRouter } from 'next/navigation'
import { useWorkspaceDirectory, useWorkspaceEntity, useWorkspaceFlowStepStates } from '@/entities'
import { getWorkspaceFlowContext, getWorkspaceNavigationSections } from '@/lib/workspace-flow'
import { cn } from '@/shared/lib/utils'

type WorkspaceLayoutProps = {
  children: ReactNode
  params: { workspaceId: string }
}

function getStepBadge(status?: string) {
  if (status === 'complete') return 'Completed'
  if (status === 'active') return 'Active'
  if (status === 'blocked') return 'Blocked'
  return 'Pending'
}

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspace } = useWorkspaceEntity(params.workspaceId)
  const workspaceDirectory = useWorkspaceDirectory({ activeWorkspaceId: params.workspaceId })
  const { stepStates } = useWorkspaceFlowStepStates(params.workspaceId)
  const workspaceHomePath = `/workspace/${params.workspaceId}`
  const isWorkspaceHome = pathname === workspaceHomePath
  const flowContext = useMemo(
    () => getWorkspaceFlowContext(params.workspaceId, pathname),
    [params.workspaceId, pathname]
  )
  const { activeItem, items } = flowContext
  const navigationSections = useMemo(() => getWorkspaceNavigationSections(params.workspaceId), [params.workspaceId])
  const recommendedItem = items.find((item) => item.key === workspace.recommendedFlowKey) ?? activeItem
  const currentStage = stepStates.find((step) => step.stepKey === workspace.currentStageId)
  const primarySections = navigationSections.filter((section) => section.id !== 'collaboration')
  const detailSection = navigationSections.find((section) => section.id === 'collaboration')

  function handleWorkspaceChange(nextWorkspaceId: string) {
    if (nextWorkspaceId === params.workspaceId) return
    router.push(pathname.replace(`/workspace/${params.workspaceId}`, `/workspace/${nextWorkspaceId}`) as Route)
  }

  return (
    <div className="stratum-shell min-h-screen bg-[var(--stratum-surface)] text-[var(--stratum-ink)]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[var(--stratum-line)] bg-white/80 px-6 backdrop-blur-xl">
        <div className="flex items-center gap-10">
          <Link href="/dashboard" className="stratum-display text-[1.55rem] font-semibold text-[var(--stratum-navy)]">
            StratumAI
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-500">
            <Link
              href="/dashboard"
              className={cn(
                'pb-1 transition',
                pathname.startsWith('/workspace') || pathname === '/dashboard'
                  ? 'border-b-2 border-[var(--stratum-blue)] text-[var(--stratum-navy)]'
                  : 'hover:text-[var(--stratum-navy)]'
              )}
            >
              Dashboard
            </Link>
            <Link
              href={`/monitor?workspace=${encodeURIComponent(params.workspaceId)}` as Route}
              className={cn(
                'pb-1 transition',
                pathname.startsWith('/monitor')
                  ? 'border-b-2 border-[var(--stratum-blue)] text-[var(--stratum-navy)]'
                  : 'hover:text-[var(--stratum-navy)]'
              )}
            >
              Monitor
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative hidden items-center md:flex">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 h-4 w-4 text-slate-400" />
            <input
              readOnly
              value=""
              placeholder="Global search..."
              className="h-11 w-64 rounded-2xl border border-white/60 bg-[var(--stratum-surface-low)] pl-11 pr-4 text-sm text-slate-500 outline-none"
            />
          </label>
          <select
            value={params.workspaceId}
            onChange={(event) => handleWorkspaceChange(event.target.value)}
            className="h-11 rounded-2xl border border-white/60 bg-[var(--stratum-surface-low)] px-4 text-sm text-[var(--stratum-navy)] outline-none"
          >
            {workspaceDirectory.map((item) => (
              <option key={item.workspaceId} value={item.workspaceId}>
                {item.name}
              </option>
            ))}
          </select>
          <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[var(--stratum-navy)]">
            <BellIcon className="h-5 w-5" />
          </button>
          <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[var(--stratum-navy)]">
            <GearIcon className="h-5 w-5" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--stratum-navy)] text-white">
            <PersonIcon className="h-5 w-5" />
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-64px)] grid-cols-[180px_minmax(0,1fr)]">
        <aside className="flex min-h-full flex-col border-r border-[var(--stratum-line)] bg-[var(--stratum-panel)] px-3 py-4">
          <div className="px-3 pb-6">
            <p className="stratum-display text-[1.75rem] font-semibold text-[var(--stratum-navy)]">Strategy Engine</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-slate-400">AI Analysis v2.4</p>
            <div className="mt-5 rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Workspace</p>
              <p className="mt-2 text-sm font-semibold text-[var(--stratum-navy)]">{workspace.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                Current stage {workspace.currentStageId} · {getStepBadge(currentStage?.status)}
              </p>
            </div>
          </div>

          <nav className="space-y-5">
            <div className="space-y-2">
              <p className="px-3 text-[10px] uppercase tracking-[0.28em] text-slate-400">Workspace</p>
              <Link
                href={workspaceHomePath as Route}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                  isWorkspaceHome
                    ? 'bg-white text-[var(--stratum-navy)] shadow-[0_12px_28px_rgba(19,27,46,0.06)]'
                    : 'text-slate-500 hover:bg-white/70 hover:text-[var(--stratum-navy)]'
                )}
              >
                <HomeIcon className="h-4 w-4" />
                <div className="min-w-0">
                  <p className="truncate font-medium">Workspace Home</p>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Overview</p>
                </div>
              </Link>
            </div>

            {primarySections.map((section) => (
              <div key={section.id} className="space-y-2">
                <p className="px-3 text-[10px] uppercase tracking-[0.28em] text-slate-400">{section.label}</p>
                {section.items.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href as Route}
                    className={cn(
                      'block rounded-2xl px-4 py-3 transition',
                      item.key === activeItem.key
                        ? section.id === 'primary'
                          ? 'bg-[var(--stratum-navy)] text-white shadow-[0_18px_40px_rgba(19,27,46,0.18)]'
                          : 'bg-white text-[var(--stratum-navy)] shadow-[0_12px_28px_rgba(19,27,46,0.06)]'
                        : section.id === 'primary'
                          ? 'bg-[#dbeaf5] text-[var(--stratum-blue)] hover:bg-[#cfe5f4]'
                          : 'text-slate-500 hover:bg-white/70 hover:text-[var(--stratum-navy)]'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p
                        className={cn(
                          'mt-1 text-[10px] uppercase tracking-[0.18em]',
                          item.key === activeItem.key
                            ? section.id === 'primary'
                              ? 'text-white/65'
                              : 'text-slate-400'
                            : section.id === 'primary'
                              ? 'text-[var(--stratum-blue)]/70'
                              : 'text-slate-400'
                        )}
                      >
                        {item.shortLabel}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ))}

            {detailSection && detailSection.items.length > 0 && (
              <div className="space-y-2">
                <p className="px-3 text-[10px] uppercase tracking-[0.28em] text-slate-400">详情页</p>
                <div className="space-y-1 px-2">
                  {detailSection.items.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href as Route}
                      className={cn(
                        'flex items-center justify-between rounded-xl px-3 py-2 text-xs transition',
                        item.key === activeItem.key
                          ? 'bg-white/80 text-[var(--stratum-navy)]'
                          : 'text-slate-500 hover:bg-white/60 hover:text-[var(--stratum-navy)]'
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="uppercase tracking-[0.16em] text-slate-400">{item.shortLabel}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="mt-auto space-y-4 px-2">
            <div className="rounded-2xl bg-[#dbeaf5] p-4 text-[var(--stratum-blue)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em]">Next Step Guidance</p>
              <p className="mt-2 text-sm font-medium leading-6">
                {recommendedItem.label}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {recommendedItem.description}
              </p>
              <Link
                href={recommendedItem.href as Route}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[var(--stratum-blue)]"
              >
                Open Module
                <ArrowRightIcon />
              </Link>
            </div>

            <div className="space-y-2 px-2 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <QuestionMarkCircledIcon className="h-4 w-4" />
                <span>Help Center</span>
              </div>
              <Link
                href="/dashboard"
                className="flex items-center gap-3 transition hover:text-[var(--stratum-navy)]"
              >
                <ExitIcon className="h-4 w-4" />
                <span>Log Out</span>
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(137,206,255,0.12),transparent_22%),linear-gradient(180deg,#fbfcfe_0%,#f6f8fb_100%)]">
          <div className="px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
