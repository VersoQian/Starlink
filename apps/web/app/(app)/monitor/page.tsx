'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRightIcon, ExclamationTriangleIcon, EyeOpenIcon, LayersIcon, UpdateIcon } from '@radix-ui/react-icons'
import { ThemeToggle } from '@/components/theme-toggle'
import { getMonitoredPages } from '@/lib/system-pages'
import { useWorkspaceDirectory } from '@/entities'
import { useMonitorSnapshot } from '@/features/monitor/hooks/use-monitor-snapshot'

const severityStyles = {
  high: 'border-[#F0D6E0] bg-[#FFF4F8] text-[#7A4A63] dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
  medium: 'border-[#F6E5C8] bg-[#FFF8EC] text-[#7A5A1D] dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-50',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50'
} as const

const tierStyles = {
  system: 'border-[#D6CCFF] bg-[#F3EEFF] text-[#5C48D9] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100',
  workspace: 'border-[#CFE0FF] bg-[#EEF5FF] text-[#3158A3] dark:border-blue-300/30 dark:bg-blue-300/10 dark:text-blue-100',
  support: 'border-[#E8D4FF] bg-[#F8F0FF] text-[#7A48B4] dark:border-fuchsia-300/30 dark:bg-fuchsia-300/10 dark:text-fuchsia-100'
} as const

const sourceStyles = {
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50',
  loading: 'border-[#D6CCFF] bg-[#F3EEFF] text-[#5C48D9] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100',
  error: 'border-[#F0D6E0] bg-[#FFF4F8] text-[#7A4A63] dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100',
  idle: 'border-[#ECE6FF] bg-[#FCFBFF] text-[#6F6792] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200'
} as const

const healthStyles = {
  complete: 'bg-emerald-400',
  active: 'bg-cyan-300',
  empty: 'bg-slate-500',
  blocked: 'bg-rose-400'
} as const

export default function MonitorPage() {
  return (
    <Suspense fallback={<MonitorShell loading />}>
      <MonitorPageContent />
    </Suspense>
  )
}

function MonitorPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceId = searchParams.get('workspace')?.trim() || 'demo'
  const workspaceDirectory = useWorkspaceDirectory({ activeWorkspaceId: workspaceId })
  const pages = useMemo(() => getMonitoredPages(workspaceId), [workspaceId])
  const snapshot = useMonitorSnapshot(workspaceId)

  return (
    <MonitorShell
      workspaceId={workspaceId}
      onWorkspaceChange={(nextWorkspace) => {
        router.replace(`/monitor?workspace=${encodeURIComponent(nextWorkspace)}` as Route)
      }}
      workspaceDirectory={workspaceDirectory}
      pages={pages}
      snapshot={snapshot}
    />
  )
}

function MonitorShell({
  loading = false,
  workspaceId = 'demo',
  onWorkspaceChange,
  workspaceDirectory = [],
  pages,
  snapshot
}: {
  loading?: boolean
  workspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
  workspaceDirectory?: Array<{ workspaceId: string; name: string }>
  pages?: ReturnType<typeof getMonitoredPages>
  snapshot?: ReturnType<typeof useMonitorSnapshot>
}) {
  const resolvedPages = pages ?? []
  const resolvedSnapshot = snapshot
  const workspaceHref = `/workspace/${encodeURIComponent(workspaceId)}`
  const monitorHref = `/monitor?workspace=${encodeURIComponent(workspaceId)}`

  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F6FF] text-[#2E2350] dark:bg-[#07111f] dark:text-white">
      <div className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(139,124,255,0.18),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(255,255,255,0.96),_transparent_22%),linear-gradient(180deg,_#FCFBFF,_#F5F1FF)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(87,216,255,0.18),_transparent_28%),radial-gradient(circle_at_82%_18%,_rgba(253,186,116,0.18),_transparent_20%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_65%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(160,138,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(160,138,255,0.08)_1px,transparent_1px)] [background-size:22px_22px] dark:opacity-30 dark:[background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-10 md:px-8">
          <header className="grid gap-8 rounded-[32px] border border-[#E6DFFF] bg-white/90 p-8 shadow-[0_30px_60px_-40px_rgba(110,91,255,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none lg:grid-cols-[1.45fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D6CCFF] bg-[#F3EEFF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-[#5C48D9] dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
                <EyeOpenIcon />
                Content Monitor
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-[#2E2350] dark:text-white md:text-5xl">
                页面监控台
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#6F6792] dark:text-slate-300/82">
                监控页现在直接读取知识库、画布图谱、时间线和研讨运行时，不再只展示静态说明。你看到的阶段完成度和风险，都会随着当前工作区的真实状态变化。
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <label className="sr-only" htmlFor="monitor-workspace-switcher">切换监控工作区</label>
                <select
                  id="monitor-workspace-switcher"
                  value={workspaceId}
                  onChange={(event) => onWorkspaceChange?.(event.target.value)}
                  className="h-10 rounded-full border border-[#DDD2FF] bg-white px-4 text-sm font-medium text-[#4A3F74] shadow-[0_16px_40px_-30px_rgba(110,91,255,0.35)] outline-none transition focus:border-[#8B7CFF] dark:border-white/10 dark:bg-[#09182c]/90 dark:text-white"
                  disabled={loading}
                >
                  {workspaceDirectory.map((item) => (
                    <option key={item.workspaceId} value={item.workspaceId}>
                      {item.name}
                    </option>
                  ))}
                  {!workspaceDirectory.some((item) => item.workspaceId === workspaceId) && (
                    <option value={workspaceId}>{workspaceId}</option>
                  )}
                </select>
                <ThemeToggle />
              </div>

              <p className="mt-3 text-xs text-[#7C73A0] dark:text-slate-400">
                当前工作区：<span className="font-semibold text-[#4A3F74] dark:text-slate-200">{workspaceId}</span>
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={'/dashboard' as Route}
                  className="inline-flex items-center gap-2 rounded-full border border-[#DDD2FF] bg-white px-5 py-2.5 text-sm text-[#5E548E] transition hover:bg-[#F3EFFF] dark:border-white/15 dark:bg-transparent dark:text-slate-100 dark:hover:bg-white/10"
                >
                  回到系统总控台
                </Link>
                <Link
                  href={workspaceHref as Route}
                  className="inline-flex items-center gap-2 rounded-full bg-[#8B7CFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6E5BFF] dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200"
                >
                  打开当前工作区
                  <ArrowRightIcon />
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="监控页面总数" value={`${resolvedPages.length}`} detail="系统页、工作区页、补充页已统一注册" />
              <MetricCard label="活跃节点" value={`${resolvedSnapshot?.graphNodes.length ?? 0}`} detail={`${resolvedSnapshot?.graphEdges.length ?? 0} 条连线，${resolvedSnapshot?.evidenceNodes.length ?? 0} 个资料节点`} />
              <MetricCard label="Agent / 决策" value={`${resolvedSnapshot?.agentSnapshot?.agents.length ?? 0} / ${resolvedSnapshot?.counts.decisions ?? 0}`} detail="根据当前图谱和研讨状态实时计算" />
              <MetricCard label="风险项" value={`${resolvedSnapshot?.risks.length ?? 0}`} detail="由数据源状态与工作区内容实时推导" />
            </div>
          </header>

          <section className="mt-8 grid gap-4 xl:grid-cols-4">
            {(resolvedSnapshot?.stages ?? []).map((stage) => (
              <article key={stage.id} className="rounded-[28px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-400">{stage.accent}</p>
                  <span className="rounded-full border border-[#E6DFFF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#5E548E] dark:border-white/10 dark:text-slate-200">
                    {stage.health}
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold text-[#2E2350] dark:text-white">{stage.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[#6F6792] dark:text-slate-300/75">{stage.detail}</p>
                <div className="mt-4 h-2 rounded-full bg-[#EFE8FF] dark:bg-white/10">
                  <div
                    className={`h-2 rounded-full transition-all ${healthStyles[stage.health]}`}
                    style={{ width: `${stage.progress}%` }}
                  />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-3xl font-semibold text-[#2E2350] dark:text-white">{stage.progress}%</span>
                  <span className="text-xs text-[#7C73A0] dark:text-slate-400">{stage.description}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {stage.metrics.map((metric) => (
                    <span key={metric} className="rounded-full border border-[#E6DFFF] px-2.5 py-1 text-xs text-[#675D93] dark:border-white/10 dark:text-slate-200/88">
                      {metric}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
            <div className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8D84B8] dark:text-slate-400">Page Matrix</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#2E2350] dark:text-white">页面职责矩阵</h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E6DFFF] px-3 py-1.5 text-xs text-[#6F6792] dark:border-white/10 dark:text-slate-300">
                  <LayersIcon />
                  system + workspace + support
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {resolvedPages.map((page) => (
                  <article key={page.id} className="rounded-[28px] border border-[#ECE6FF] bg-[#FCFBFF] p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-[#09182c]/85 dark:shadow-[0_24px_80px_-48px_rgba(56,189,248,0.6)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${tierStyles[page.tier]}`}>
                          {page.tier}
                        </div>
                        <h3 className="mt-3 text-lg font-semibold text-[#2E2350] dark:text-white">{page.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#6F6792] dark:text-slate-300/78">{page.summary}</p>
                      </div>
                      <Link
                        href={resolvePageHref(page.href, workspaceId) as Route}
                        className="inline-flex items-center gap-2 rounded-full border border-[#E6DFFF] px-3 py-1.5 text-xs text-[#5E548E] transition hover:border-[#B9A9FF] hover:bg-[#F6F2FF] dark:border-white/10 dark:text-slate-200 dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/10"
                      >
                        打开页面
                        <ArrowRightIcon />
                      </Link>
                    </div>

                    <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_1fr_1.15fr]">
                      <InfoBlock title="路由" items={[page.routePattern]} />
                      <InfoBlock title="输入" items={page.inputs} />
                      <InfoBlock
                        title="输出 / 下一步"
                        items={[
                          ...page.outputs,
                          `Next: ${page.nextIds.length > 0 ? page.nextIds.join(' / ') : 'none'}`
                        ]}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-[#D6CCFF] bg-[#F3EEFF] p-3 text-[#5C48D9] dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100">
                    <UpdateIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8D84B8] dark:text-slate-400">Live Sources</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#2E2350] dark:text-white">实时数据源</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {(resolvedSnapshot?.dataSources ?? []).map((source) => (
                    <article key={source.label} className={`rounded-2xl border p-4 ${sourceStyles[source.status]}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">{source.label}</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">{source.status}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-current/90">{source.detail}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8D84B8] dark:text-slate-400">Flow Canon</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2E2350] dark:text-white">推荐主链路</h2>
                <div className="mt-5 space-y-3">
                  {[
                    'Dashboard -> Knowledge / Translate',
                    'Knowledge / Translate -> Deep Research / Insights',
                    'Deep Research / Insights -> Canvas',
                    'Canvas -> Comfy / Agents -> Seminar',
                    'Seminar -> Cultural Tools -> Community'
                  ].map((item, index) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#ECE6FF] bg-[#FCFBFF] p-4 dark:border-white/10 dark:bg-[#0b1d35]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8B7CFF] text-xs font-semibold text-white dark:bg-cyan-300 dark:text-slate-950">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-[#5E548E] dark:text-slate-200">{item}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-[#F0D6E0] bg-[#FFF4F8] p-3 text-[#7A4A63] dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8D84B8] dark:text-slate-400">Open Risks</p>
                    <h2 className="mt-1 text-2xl font-semibold text-[#2E2350] dark:text-white">实时风险</h2>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {(resolvedSnapshot?.risks ?? []).map((risk) => (
                    <article key={risk.title} className={`rounded-2xl border p-4 ${severityStyles[risk.severity]}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">{risk.title}</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em]">
                          {risk.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-current/90">{risk.detail}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>

          <section className="mt-8 rounded-[32px] border border-[#E6DFFF] bg-white p-6 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#8D84B8] dark:text-slate-400">Live Snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#2E2350] dark:text-white">当前工作区数据摘要</h2>
              </div>
              <Link
                href={monitorHref as Route}
                className="rounded-full border border-[#DDD2FF] bg-[#F5F1FF] px-4 py-2 text-xs text-[#5E548E] transition hover:bg-[#EEE8FF] dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10"
              >
                刷新当前监控链接
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InfoPanel title="知识库" value={resolvedSnapshot?.latestKnowledgeBase?.name ?? '暂无'} detail={`成功任务 ${resolvedSnapshot?.taskSummary.success ?? 0} / 总任务 ${resolvedSnapshot?.taskSummary.total ?? 0}`} />
              <InfoPanel title="画布" value={`${resolvedSnapshot?.graphNodes.length ?? 0} nodes`} detail={`${resolvedSnapshot?.graphEdges.length ?? 0} edges / ${resolvedSnapshot?.evidenceNodes.length ?? 0} evidence`} />
              <InfoPanel title="时间线" value={`${resolvedSnapshot?.timelineIterations.length ?? 0} iterations`} detail="用于判断研究阶段是否有真实沉淀" />
              <InfoPanel title="研讨" value={`${resolvedSnapshot?.counts.decisions ?? 0} decisions`} detail={`runtime ${resolvedSnapshot?.runtime.latestPhase ?? 'waiting'}`} />
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function resolvePageHref(href: string, workspaceId: string) {
  if (href === '/monitor') {
    return `/monitor?workspace=${encodeURIComponent(workspaceId)}`
  }
  return href
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-[#09182c]/90 dark:shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-400">{label}</p>
      <p className="mt-4 text-4xl font-semibold text-[#2E2350] dark:text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6F6792] dark:text-slate-300/75">{detail}</p>
    </div>
  )
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#E6DFFF] bg-[#FBFAFF] p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-400">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full border border-[#E6DFFF] px-2.5 py-1 text-xs text-[#675D93] dark:border-white/10 dark:text-slate-200/88">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function InfoPanel({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-[#E6DFFF] bg-white p-5 shadow-[0_24px_50px_-38px_rgba(110,91,255,0.2)] dark:border-white/10 dark:bg-[#09182c]/90 dark:shadow-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8D84B8] dark:text-slate-400">{title}</p>
      <p className="mt-3 text-2xl font-semibold text-[#2E2350] dark:text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6F6792] dark:text-slate-300/75">{detail}</p>
    </div>
  )
}
