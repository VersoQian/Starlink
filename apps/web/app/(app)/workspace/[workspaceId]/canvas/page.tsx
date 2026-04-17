'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  BrainCircuit,
  Camera,
  Check,
  Eye,
  EyeOff,
  GripHorizontal,
  Hand,
  Layers3,
  LoaderCircle,
  MessageCircle,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  ScanSearch,
  Send,
  Share2,
  Sparkles,
  Wand2,
  X
} from 'lucide-react'
import { useComfyStore } from '@/features/comfy/store'
import { useKnowledgeBaseStatus, useKnowledgeBases } from '@/features/knowledge/hooks'
import { KbSelector } from '@/features/knowledge/components'
import { useConversationRuntime, useWorkspaceGraph } from '@/features/workspace/hooks'
import { buildAgentWorkspaceSnapshot, buildSeminarSnapshot } from '@/features/workspace/lib/agent-runtime'
import {
  buildResearchPreviewStorageKey,
  buildTranslationPreviewStorageKey,
  type ResearchPreviewSnapshot,
  type TranslationPreviewSnapshot
} from '@/shared/lib/tool-preview-storage'
import { cn } from '@/shared/lib/utils'
import type { KnowledgeTask } from '@/types/knowledge'

type WorkspaceCanvasPageProps = {
  params: { workspaceId: string }
}

type ModuleCardKey = 'workspace' | 'knowledge' | 'research' | 'translate' | 'experts' | 'live-board'

type PreviewAction = {
  id: string
  label: string
  tone?: 'primary' | 'secondary'
  runningLabel?: string
  successLabel?: string
  errorLabel?: string
  disabled?: boolean
  onClick: () => void | Promise<void>
}

type CardPosition = {
  x: number
  y: number
}

type CardPositionMap = Record<ModuleCardKey, CardPosition>
type CardVisibilityMap = Record<ModuleCardKey, boolean>
type PreviewActionState = 'idle' | 'running' | 'success' | 'error'
type DrawerTone = 'sky' | 'emerald' | 'amber' | 'rose' | 'slate'

type DrawerMetric = {
  label: string
  value: string
  tone?: DrawerTone
}

type DrawerEntry = {
  id: string
  title: string
  eyebrow?: string
  description?: string
  meta?: string
  tone?: DrawerTone
}

type DrawerSection =
  | {
      type: 'metrics'
      title: string
      description?: string
      items: DrawerMetric[]
    }
  | {
      type: 'cards'
      title: string
      description?: string
      items: DrawerEntry[]
      emptyMessage?: string
    }
  | {
      type: 'spotlight'
      title: string
      description?: string
      content: string
      meta?: string
      tone?: DrawerTone
    }

type DrawerPanel = {
  eyebrow: string
  title: string
  summary: string
  href: Route
  actions: PreviewAction[]
  thumbnailPreview?: string[]
  sections: DrawerSection[]
}

type ModuleCardProps = {
  id: ModuleCardKey
  accentClass: string
  badge: string
  title: string
  description: string
  href: Route
  statLabel: string
  statValue: string
  preview?: string[]
  desktopClassName: string
  desktopStyle?: CardPosition
  desktopWidth: number
  isActive?: boolean
  isDragging?: boolean
  onExpand: (id: ModuleCardKey) => void
  onDragStart: (id: ModuleCardKey, event: ReactPointerEvent<HTMLButtonElement>) => void
}

const DEFAULT_CARD_POSITIONS: CardPositionMap = {
  workspace: { x: 80, y: 110 },
  knowledge: { x: 480, y: 96 },
  research: { x: 848, y: 80 },
  translate: { x: 320, y: 432 },
  experts: { x: 980, y: 288 },
  'live-board': { x: 780, y: 496 }
}
const DEFAULT_CARD_ORDER: ModuleCardKey[] = ['workspace', 'knowledge', 'research', 'translate', 'experts', 'live-board']
const DEFAULT_CARD_VISIBILITY: CardVisibilityMap = {
  workspace: true,
  knowledge: true,
  research: true,
  translate: true,
  experts: true,
  'live-board': true
}
const CARD_SNAP_GRID = 20
const KNOWLEDGE_TASK_STATUS_LABELS: Record<KnowledgeTask['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  succeeded: '已完成',
  failed: '失败'
}
const KNOWLEDGE_TASK_TYPE_LABELS: Record<KnowledgeTask['type'], string> = {
  seed: '文本种子',
  file: '文件导入',
  url: '网页抓取'
}
const DRAWER_TONE_CLASS_MAP: Record<
  DrawerTone,
  {
    border: string
    bg: string
    value: string
    eyebrow: string
  }
> = {
  sky: {
    border: 'border-sky-300/20',
    bg: 'bg-sky-400/10',
    value: 'text-sky-100',
    eyebrow: 'text-sky-200'
  },
  emerald: {
    border: 'border-emerald-300/20',
    bg: 'bg-emerald-400/10',
    value: 'text-emerald-100',
    eyebrow: 'text-emerald-200'
  },
  amber: {
    border: 'border-amber-300/20',
    bg: 'bg-amber-400/10',
    value: 'text-amber-100',
    eyebrow: 'text-amber-200'
  },
  rose: {
    border: 'border-rose-300/20',
    bg: 'bg-rose-400/10',
    value: 'text-rose-100',
    eyebrow: 'text-rose-200'
  },
  slate: {
    border: 'border-white/10',
    bg: 'bg-white/5',
    value: 'text-slate-100',
    eyebrow: 'text-slate-300'
  }
}

function buildCanvasLayoutStorageKey(workspaceId: string) {
  return `workspace:${workspaceId}:canvas-module-layout`
}

function buildCanvasLayerStorageKey(workspaceId: string) {
  return `workspace:${workspaceId}:canvas-module-layers`
}

function WorkspaceModuleCard({
  id,
  accentClass,
  badge,
  title,
  description,
  href,
  statLabel,
  statValue,
  preview = [],
  desktopClassName,
  desktopStyle,
  desktopWidth,
  isActive = false,
  isDragging = false,
  onExpand,
  onDragStart
}: ModuleCardProps) {
  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.88)_0%,rgba(8,11,20,0.94)_100%)] p-5 shadow-[0_26px_70px_rgba(0,0,0,0.26)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_32px_90px_rgba(0,0,0,0.34)]',
        isActive && 'border-sky-300/40 shadow-[0_32px_90px_rgba(14,165,233,0.16)]',
        isDragging && 'z-30 cursor-grabbing shadow-[0_38px_110px_rgba(14,165,233,0.24)]',
        desktopClassName
      )}
      style={desktopStyle ? { left: desktopStyle.x, top: desktopStyle.y } : undefined}
    >
      <div className={cn('pointer-events-none absolute inset-x-5 top-0 h-px opacity-80', accentClass)} />
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onExpand(id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onExpand(id)
            }
          }}
          className="block w-full cursor-pointer text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">
                {badge}
              </span>
              <h2 className="mt-4 text-xl font-semibold text-white">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                {statValue}
              </span>
              <button
                type="button"
                onPointerDown={(event) => onDragStart(id, event)}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                className="hidden h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white xl:flex"
                title={`Drag ${title}`}
              >
                <GripHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>

          <ModuleCardThumbnail id={id} title={title} preview={preview} />

          <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{statLabel}</p>
            <div className="mt-3 space-y-2">
              {preview.length > 0 ? (
                preview.map((item) => (
                  <p key={item} className="line-clamp-2 text-sm text-slate-200">
                    {item}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">进入后查看详细工作内容</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          <button type="button" onClick={() => onExpand(id)} className="transition hover:text-white">
            {isActive ? 'Expanded' : 'Expand preview'}
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden xl:block text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {desktopWidth}px
            </span>
            <Link href={href} className="transition duration-300 group-hover:translate-x-1 hover:text-white">
              Open page
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function formatRuntimeEvent(event: ReturnType<typeof useConversationRuntime>['events'][number]) {
  switch (event.type) {
    case 'phase.changed':
      return `进入 ${event.payload.phase} 阶段`
    case 'seminar.turn.completed':
      return `${event.payload.agentName} 完成 ${event.payload.phase} 轮发言`
    case 'seminar.decision.requested':
      return 'Seminar 请求人工决策'
    case 'seminar.decision.made':
      return 'Seminar 结论已确认'
    default:
      return '新协作事件'
  }
}

function formatPanelDate(value?: string | null) {
  if (!value) return '暂无时间'
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

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getPayloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getKnowledgeTaskTitle(task: KnowledgeTask): string {
  if (task.type === 'file') {
    const path = getPayloadString(task.payload, 'path')
    if (!path) return `文件任务 ${task.id.slice(-6)}`
    const normalized = path.replace(/\\/g, '/')
    return normalized.split('/').pop() ?? `文件任务 ${task.id.slice(-6)}`
  }

  if (task.type === 'url') {
    const url = getPayloadString(task.payload, 'url')
    if (!url) return `网页任务 ${task.id.slice(-6)}`
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const length = getPayloadNumber(task.payload, 'length')
  return length ? `文本片段（${length} 字）` : `文本任务 ${task.id.slice(-6)}`
}

function getKnowledgeTaskSummary(task: KnowledgeTask): string {
  if (task.type === 'file') {
    const path = getPayloadString(task.payload, 'path')
    return path ? `源文件：${path}` : '文件已入列，等待切片和索引。'
  }

  if (task.type === 'url') {
    const url = getPayloadString(task.payload, 'url')
    return url ? `来源链接：${url}` : '网页抓取任务已创建。'
  }

  const length = getPayloadNumber(task.payload, 'length')
  return length ? `文本长度：${length} 字` : '文本种子已提交，等待语义切片。'
}

function ModuleCardThumbnail({
  id,
  title,
  preview
}: {
  id: ModuleCardKey
  title: string
  preview: string[]
}) {
  const primary = preview[0] ?? title
  const secondary = preview[1] ?? 'Preview ready'

  if (id === 'live-board') {
    return (
      <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#0a0d15_0%,#0d1220_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="h-2 w-2 rounded-full bg-amber-300" />
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500">canvas</span>
        </div>
        <div
          className="relative h-28 px-4 py-4"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)',
            backgroundSize: '14px 14px'
          }}
        >
          <div className="absolute left-4 top-5 rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-[10px] text-fuchsia-200">
            {primary}
          </div>
          <div className="absolute right-5 top-8 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] text-cyan-200">
            signal
          </div>
          <div className="absolute bottom-5 left-10 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[10px] text-amber-100">
            {secondary}
          </div>
          <div className="absolute left-[7.2rem] top-[2.3rem] h-px w-16 bg-gradient-to-r from-fuchsia-300/0 via-fuchsia-300 to-fuchsia-300/0" />
          <div className="absolute right-[7.5rem] top-[3.4rem] h-px w-16 bg-gradient-to-r from-cyan-300/0 via-cyan-300 to-cyan-300/0" />
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-[#f7f9fc] shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          <span className="h-2 w-2 rounded-full bg-amber-300" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <span className="text-[9px] uppercase tracking-[0.18em] text-slate-400">{id}</span>
      </div>
      <div className="grid grid-cols-[56px_minmax(0,1fr)]">
        <div className="border-r border-slate-200 bg-slate-50 px-2 py-3">
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-slate-200" />
            <div className="h-2 w-8 rounded-full bg-slate-200" />
            <div className="h-2 w-10 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
            <div className="h-2.5 w-20 rounded-full bg-slate-200" />
            <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100" />
            <div className="mt-2 h-2.5 w-4/5 rounded-full bg-slate-100" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white px-2 py-2 shadow-sm">
              <p className="line-clamp-2 text-[9px] font-medium leading-4 text-slate-500">{primary}</p>
            </div>
            <div className="rounded-lg bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] px-2 py-2 shadow-sm">
              <p className="line-clamp-2 text-[9px] font-medium leading-4 text-sky-700">{secondary}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewActionButton({
  action,
  state,
  onTrigger
}: {
  action: PreviewAction
  state: PreviewActionState
  onTrigger: (action: PreviewAction) => void
}) {
  const isRunning = state === 'running'
  const isSuccess = state === 'success'
  const isError = state === 'error'
  const label = isRunning
    ? action.runningLabel ?? '执行中'
    : isSuccess
      ? action.successLabel ?? '已完成'
      : isError
        ? action.errorLabel ?? '重试'
        : action.label

  return (
    <button
      type="button"
      onClick={() => onTrigger(action)}
      disabled={action.disabled || isRunning}
      className={cn(
        'flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        action.tone === 'primary'
          ? 'border-sky-300/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(226,232,240,0.92)_100%)] text-slate-950 shadow-[0_16px_34px_rgba(255,255,255,0.08)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(255,255,255,0.14)]'
          : 'border-white/10 bg-white/5 text-slate-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8',
        isRunning &&
          (action.tone === 'primary'
            ? 'border-sky-300/40 bg-[linear-gradient(135deg,rgba(224,242,254,0.98)_0%,rgba(186,230,253,0.92)_100%)]'
            : 'border-sky-300/30 bg-sky-400/10 text-sky-50'),
        isSuccess &&
          (action.tone === 'primary'
            ? 'border-emerald-300/40 bg-[linear-gradient(135deg,rgba(236,253,245,0.98)_0%,rgba(209,250,229,0.94)_100%)] text-emerald-950'
            : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-50'),
        isError &&
          (action.tone === 'primary'
            ? 'border-amber-300/40 bg-[linear-gradient(135deg,rgba(255,251,235,0.98)_0%,rgba(254,243,199,0.94)_100%)] text-amber-950'
            : 'border-amber-300/30 bg-amber-400/10 text-amber-50')
      )}
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        <span
          className={cn(
            'mt-1 block text-[10px] uppercase tracking-[0.18em]',
            action.tone === 'primary' ? 'text-slate-500' : 'text-slate-500',
            isRunning && (action.tone === 'primary' ? 'text-sky-700/70' : 'text-sky-200/70'),
            isSuccess && (action.tone === 'primary' ? 'text-emerald-700/80' : 'text-emerald-200/80'),
            isError && (action.tone === 'primary' ? 'text-amber-700/80' : 'text-amber-200/80')
          )}
        >
          {isRunning ? 'in progress' : isSuccess ? 'completed' : isError ? 'needs retry' : action.tone === 'primary' ? 'direct run' : 'queue action'}
        </span>
      </span>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          action.tone === 'primary' ? 'bg-slate-950/8' : 'bg-white/5',
          isRunning && (action.tone === 'primary' ? 'bg-sky-950/10' : 'bg-sky-950/20'),
          isSuccess && (action.tone === 'primary' ? 'bg-emerald-950/10' : 'bg-emerald-950/20'),
          isError && (action.tone === 'primary' ? 'bg-amber-950/10' : 'bg-amber-950/20')
        )}
      >
        {isRunning ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : isSuccess ? (
          <Check className="h-4 w-4" />
        ) : isError ? (
          <AlertTriangle className="h-4 w-4" />
        ) : action.tone === 'primary' ? (
          <Play className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </span>
    </button>
  )
}

function DrawerSectionBlock({ section }: { section: DrawerSection }) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{section.title}</p>
          {section.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-400">{section.description}</p>
          ) : null}
        </div>
        {section.type === 'metrics' ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-600">
            {section.items.length} items
          </span>
        ) : null}
      </div>

      {section.type === 'metrics' ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {section.items.map((item) => {
            const tone = DRAWER_TONE_CLASS_MAP[item.tone ?? 'slate']
            return (
              <div
                key={`${section.title}-${item.label}`}
                className={cn('rounded-[22px] border px-4 py-4', tone.border, tone.bg)}
              >
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                <p className={cn('mt-3 text-2xl font-semibold', tone.value)}>{item.value}</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {section.type === 'cards' ? (
        <div className="mt-3 space-y-3">
          {section.items.length > 0 ? (
            section.items.map((item) => {
              const tone = DRAWER_TONE_CLASS_MAP[item.tone ?? 'slate']
              return (
                <div
                  key={item.id}
                  className={cn('rounded-[22px] border bg-black/20 px-4 py-4', tone.border)}
                >
                  {item.eyebrow ? (
                    <p className={cn('text-[10px] uppercase tracking-[0.18em]', tone.eyebrow)}>{item.eyebrow}</p>
                  ) : null}
                  <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                  ) : null}
                  {item.meta ? (
                    <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.meta}</p>
                  ) : null}
                </div>
              )
            })
          ) : (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-500">
              {section.emptyMessage ?? '暂无数据'}
            </div>
          )}
        </div>
      ) : null}

      {section.type === 'spotlight' ? (
        <div
          className={cn(
            'mt-3 rounded-[24px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-4',
            DRAWER_TONE_CLASS_MAP[section.tone ?? 'slate'].border
          )}
        >
          <p className="text-sm leading-7 text-slate-100">{section.content}</p>
          {section.meta ? (
            <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">{section.meta}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function WorkDrawerPanel({
  panel,
  cardId,
  actionStates,
  onTriggerAction,
  onClose,
  status,
  variant
}: {
  panel: DrawerPanel
  cardId: ModuleCardKey
  actionStates: Record<string, PreviewActionState>
  onTriggerAction: (action: PreviewAction) => void
  onClose: () => void
  status: { tone: 'running' | 'success' | 'error'; label: string } | null
  variant: 'desktop' | 'mobile'
}) {
  const isDesktop = variant === 'desktop'

  return (
    <div
      className={cn(
        isDesktop
          ? 'absolute inset-y-6 right-6 z-20 hidden w-[428px] overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98)_0%,rgba(8,11,20,0.98)_100%)] shadow-[0_36px_120px_rgba(0,0,0,0.5)] backdrop-blur xl:flex xl:flex-col'
          : 'rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.96)_0%,rgba(8,11,20,0.96)_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.32)]'
      )}
    >
      <div className={cn(isDesktop ? 'border-b border-white/10 px-6 py-5' : '')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{panel.eyebrow}</p>
            <h3 className="mt-3 text-2xl font-semibold leading-tight text-white">{panel.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            <Layers3 className="h-3.5 w-3.5" />
            Work drawer
          </span>
          {status ? (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                status.tone === 'running' && 'border-sky-300/25 bg-sky-400/10 text-sky-100',
                status.tone === 'success' && 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
                status.tone === 'error' && 'border-amber-300/25 bg-amber-400/10 text-amber-100'
              )}
            >
              {status.tone === 'running' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : status.tone === 'success' ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {status.label}
            </span>
          ) : null}
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-400">{panel.summary}</p>
      </div>

      <div className={cn(isDesktop ? 'min-h-0 flex-1 overflow-y-auto px-6 py-5' : 'mt-5')}>
        <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Live snapshot</p>
              <p className="mt-2 text-sm font-semibold text-white">当前模块的即时缩略视图</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-300">
              realtime
            </span>
          </div>
          <ModuleCardThumbnail
            id={cardId}
            title={panel.title}
            preview={panel.thumbnailPreview ?? []}
          />
        </div>

        {panel.sections.map((section) => (
          <DrawerSectionBlock key={`${panel.title}-${section.title}`} section={section} />
        ))}

        {panel.actions.length > 0 ? (
          <section className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Immediate actions</p>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-600">execute or queue</span>
            </div>
            <div className="mt-3 grid gap-3">
              {panel.actions.map((action) => (
                <PreviewActionButton
                  key={action.id}
                  action={action}
                  state={actionStates[action.id] ?? 'idle'}
                  onTrigger={onTriggerAction}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className={cn(isDesktop ? 'border-t border-white/10 px-6 py-4' : 'mt-5')}>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
          >
            收起抽屉
          </button>
          <Link
            href={panel.href}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Open page
            <Sparkles className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function WorkspaceCanvasPage({ params }: WorkspaceCanvasPageProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const previewActionTimersRef = useRef<Record<string, number>>({})
  const nodes = useComfyStore((state) => state.nodes)
  const edges = useComfyStore((state) => state.edges)
  const setWorkspaceId = useComfyStore((state) => state.setWorkspaceId)
  const callLangGraph = useComfyStore((state) => state.callLangGraph)
  const isOrchestratorProcessing = useComfyStore((state) => state.isOrchestratorProcessing)
  const callCritic = useComfyStore((state) => state.callCritic)
  const isCriticProcessing = useComfyStore((state) => state.isCriticProcessing)
  const knowledgeEvidence = useComfyStore((state) => state.knowledgeEvidence)
  const appendChatMessage = useComfyStore((state) => state.appendChatMessage)
  const approveDecision = useComfyStore((state) => state.approveDecision)

  const [promptInput, setPromptInput] = useState('')
  const [hitlInput, setHitlInput] = useState('')
  const [selectedKbId, setSelectedKbId] = useState<string | undefined>(undefined)
  const [expandedCard, setExpandedCard] = useState<ModuleCardKey | null>('knowledge')
  const [researchPreview, setResearchPreview] = useState<ResearchPreviewSnapshot | null>(null)
  const [translationPreview, setTranslationPreview] = useState<TranslationPreviewSnapshot | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [previewActionStates, setPreviewActionStates] = useState<Record<string, PreviewActionState>>({})
  const [cardPositions, setCardPositions] = useState<CardPositionMap>(DEFAULT_CARD_POSITIONS)
  const [cardOrder, setCardOrder] = useState<ModuleCardKey[]>(DEFAULT_CARD_ORDER)
  const [cardVisibility, setCardVisibility] = useState<CardVisibilityMap>(DEFAULT_CARD_VISIBILITY)
  const [draggingCard, setDraggingCard] = useState<{
    id: ModuleCardKey
    offsetX: number
    offsetY: number
    width: number
  } | null>(null)
  const runtime = useConversationRuntime(params.workspaceId)
  const { data: graphData } = useWorkspaceGraph(params.workspaceId)
  const { data: knowledgeBases = [] } = useKnowledgeBases(params.workspaceId)
  const activeKnowledgeBaseId = knowledgeBases[0]?.id ?? ''
  const { data: activeKnowledgeStatus } = useKnowledgeBaseStatus(params.workspaceId, activeKnowledgeBaseId)

  useEffect(() => {
    setWorkspaceId(params.workspaceId)
  }, [params.workspaceId, setWorkspaceId])

  useEffect(() => {
    const researchRaw = localStorage.getItem(buildResearchPreviewStorageKey(params.workspaceId))
    const translationRaw = localStorage.getItem(buildTranslationPreviewStorageKey(params.workspaceId))
    const layoutRaw = localStorage.getItem(buildCanvasLayoutStorageKey(params.workspaceId))
    const layerRaw = localStorage.getItem(buildCanvasLayerStorageKey(params.workspaceId))

    if (researchRaw) {
      try {
        setResearchPreview(JSON.parse(researchRaw) as ResearchPreviewSnapshot)
      } catch {
        localStorage.removeItem(buildResearchPreviewStorageKey(params.workspaceId))
      }
    } else {
      setResearchPreview(null)
    }

    if (translationRaw) {
      try {
        setTranslationPreview(JSON.parse(translationRaw) as TranslationPreviewSnapshot)
      } catch {
        localStorage.removeItem(buildTranslationPreviewStorageKey(params.workspaceId))
      }
    } else {
      setTranslationPreview(null)
    }

    if (layoutRaw) {
      try {
        const parsed = JSON.parse(layoutRaw) as Partial<CardPositionMap>
        setCardPositions({
          ...DEFAULT_CARD_POSITIONS,
          ...parsed
        })
      } catch {
        localStorage.removeItem(buildCanvasLayoutStorageKey(params.workspaceId))
        setCardPositions(DEFAULT_CARD_POSITIONS)
      }
    } else {
      setCardPositions(DEFAULT_CARD_POSITIONS)
    }

    if (layerRaw) {
      try {
        const parsed = JSON.parse(layerRaw) as {
          order?: ModuleCardKey[]
          visibility?: Partial<CardVisibilityMap>
        }

        if (Array.isArray(parsed.order) && parsed.order.length > 0) {
          const normalized = [
            ...parsed.order.filter((key): key is ModuleCardKey => DEFAULT_CARD_ORDER.includes(key as ModuleCardKey)),
            ...DEFAULT_CARD_ORDER.filter((key) => !parsed.order?.includes(key))
          ]
          setCardOrder(normalized)
        } else {
          setCardOrder(DEFAULT_CARD_ORDER)
        }

        setCardVisibility({
          ...DEFAULT_CARD_VISIBILITY,
          ...(parsed.visibility ?? {})
        })
      } catch {
        localStorage.removeItem(buildCanvasLayerStorageKey(params.workspaceId))
        setCardOrder(DEFAULT_CARD_ORDER)
        setCardVisibility(DEFAULT_CARD_VISIBILITY)
      }
    } else {
      setCardOrder(DEFAULT_CARD_ORDER)
      setCardVisibility(DEFAULT_CARD_VISIBILITY)
    }
  }, [params.workspaceId])

  useEffect(() => {
    localStorage.setItem(buildCanvasLayoutStorageKey(params.workspaceId), JSON.stringify(cardPositions))
  }, [cardPositions, params.workspaceId])

  useEffect(() => {
    localStorage.setItem(
      buildCanvasLayerStorageKey(params.workspaceId),
      JSON.stringify({
        order: cardOrder,
        visibility: cardVisibility
      })
    )
  }, [cardOrder, cardVisibility, params.workspaceId])

  useEffect(() => {
    if (!actionNotice) return
    const timer = window.setTimeout(() => setActionNotice(null), 2600)
    return () => window.clearTimeout(timer)
  }, [actionNotice])

  useEffect(() => {
    const timers = previewActionTimersRef.current
    return () => {
      Object.values(timers).forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!draggingCard) return

    const handlePointerMove = (event: PointerEvent) => {
      const boardRect = boardRef.current?.getBoundingClientRect()
      if (!boardRect) return

      const nextX = event.clientX - boardRect.left - draggingCard.offsetX
      const nextY = event.clientY - boardRect.top - draggingCard.offsetY
      const maxX = Math.max(24, boardRect.width - draggingCard.width - 24)
      const maxY = Math.max(24, boardRect.height - 240)

      setCardPositions((current) => ({
        ...current,
        [draggingCard.id]: {
          x: Math.min(Math.max(24, nextX), maxX),
          y: Math.min(Math.max(24, nextY), maxY)
        }
      }))
    }

    const handlePointerUp = () => {
      const boardRect = boardRef.current?.getBoundingClientRect()
      setCardPositions((current) => {
        const card = current[draggingCard.id]
        const maxX = boardRect ? Math.max(24, boardRect.width - draggingCard.width - 24) : card.x
        const maxY = boardRect ? Math.max(24, boardRect.height - 240) : card.y
        return {
          ...current,
          [draggingCard.id]: {
            x: Math.min(Math.max(24, Math.round(card.x / CARD_SNAP_GRID) * CARD_SNAP_GRID), maxX),
            y: Math.min(Math.max(24, Math.round(card.y / CARD_SNAP_GRID) * CARD_SNAP_GRID), maxY)
          }
        }
      })
      setDraggingCard(null)
      setActionNotice('卡片已吸附到网格。')
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [draggingCard])

  const collaborationSnapshot = useMemo(() => {
    if (!graphData) return null
    const agentSnapshot = buildAgentWorkspaceSnapshot(graphData)
    const seminarSnapshot = buildSeminarSnapshot(agentSnapshot)
    return { agentSnapshot, seminarSnapshot }
  }, [graphData])

  const pendingDecisionRequest = useMemo(() => {
    const requests = runtime.events.filter(
      (event): event is Extract<typeof event, { type: 'seminar.decision.requested' }> =>
        event.type === 'seminar.decision.requested'
    )
    const decisions = runtime.events.filter((event) => event.type === 'seminar.decision.made')
    if (requests.length > decisions.length) {
      return requests[requests.length - 1]
    }
    return null
  }, [runtime.events])

  const recentLogItems = useMemo(
    () =>
      runtime.events
        .slice(-4)
        .reverse()
        .map((event) => ({
          id: `${event.type}-${event.conversationId}`,
          label: formatRuntimeEvent(event)
        })),
    [runtime.events]
  )

  const finalRecommendation = runtime.latestDecision ?? collaborationSnapshot?.seminarSnapshot.finalRecommendation ?? null
  const phaseCount = {
    planning:
      runtime.seminarTurns.filter((item) => item.payload.phase === 'planning').length ||
      (collaborationSnapshot?.seminarSnapshot.planning.length ?? 0),
    execution:
      runtime.seminarTurns.filter((item) => item.payload.phase === 'execution').length ||
      (collaborationSnapshot?.seminarSnapshot.execution.length ?? 0),
    review:
      runtime.seminarTurns.filter((item) => item.payload.phase === 'review').length ||
      (collaborationSnapshot?.seminarSnapshot.review.length ?? 0),
    decision:
      runtime.seminarTurns.filter((item) => item.payload.phase === 'decision').length ||
      (collaborationSnapshot?.seminarSnapshot.decision.length ?? 0)
  }

  const evidencePreview = useMemo(
    () =>
      knowledgeEvidence
        .slice(0, 2)
        .map((item) => item.title ?? item.docId ?? item.snippet ?? '等待知识条目'),
    [knowledgeEvidence]
  )

  const knowledgeTasks = useMemo(() => activeKnowledgeStatus?.tasks ?? [], [activeKnowledgeStatus?.tasks])
  const latestKnowledgeTask = knowledgeTasks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  const processingTaskCount = knowledgeTasks.filter((task) => task.status === 'processing').length
  const completedKnowledgeTaskCount = knowledgeTasks.filter((task) => task.status === 'succeeded').length
  const knowledgePreviewLines = useMemo(
    () => [
      activeKnowledgeStatus?.knowledgeBase?.name
        ? `当前底座：${activeKnowledgeStatus.knowledgeBase.name}`
        : knowledgeBases.length > 0
          ? `${knowledgeBases.length} 个知识库已接入`
          : '还没有建立知识库底座',
      latestKnowledgeTask
        ? `最近任务：${latestKnowledgeTask.type} · ${latestKnowledgeTask.status}`
        : evidencePreview[0] ?? '等待新的知识条目'
    ],
    [activeKnowledgeStatus?.knowledgeBase?.name, evidencePreview, knowledgeBases.length, latestKnowledgeTask]
  )

  const researchPreviewLines = useMemo(
    () =>
      researchPreview
        ? [
            researchPreview.question || '最近一次研究问题已记录',
            researchPreview.summary
          ]
        : [finalRecommendation ?? '等待新的研究结论', '适合做问题重构与多源分析'],
    [finalRecommendation, researchPreview]
  )

  const translationPreviewLines = useMemo(
    () =>
      translationPreview
        ? [translationPreview.source, translationPreview.target]
        : ['把研究结论转成目标市场语言', '支持翻译、语气切换和简繁转换'],
    [translationPreview]
  )

  const expertsPreviewLines = useMemo(
    () => [
      `${phaseCount.review} 条质询`,
      finalRecommendation ?? `${phaseCount.decision} 条决策推进`
    ],
    [finalRecommendation, phaseCount.decision, phaseCount.review]
  )
  const recentKnowledgeTasks = useMemo(
    () => knowledgeTasks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [knowledgeTasks]
  )
  const knowledgeEvidenceCards = useMemo(
    () =>
      knowledgeEvidence.slice(0, 3).map((item, index) => ({
        id: item.id ?? `${item.docId ?? 'evidence'}-${index}`,
        eyebrow: item.source || item.docId || '知识证据',
        title: item.title ?? item.docId ?? `Evidence ${index + 1}`,
        description: item.snippet ?? item.content ?? '当前证据尚未生成摘要。',
        meta: item.score ? `相关度 ${item.score.toFixed(2)}` : undefined,
        tone: 'sky' as const
      })),
    [knowledgeEvidence]
  )
  const expertRosterCards = useMemo(
    () =>
      (collaborationSnapshot?.agentSnapshot.agents ?? []).slice(0, 4).map((agent) => ({
        id: agent.id,
        eyebrow: agent.role,
        title: agent.name,
        description: agent.perspective,
        meta: `${agent.contributions.length} contributions · ${agent.relatedAgents.length} linked`,
        tone: 'rose' as const
      })),
    [collaborationSnapshot?.agentSnapshot.agents]
  )
  const expertReviewCards = useMemo(
    () =>
      runtime.seminarTurns
        .filter((turn) => turn.payload.phase === 'review')
        .slice(-3)
        .reverse()
        .map((turn, index) => ({
          id: `${turn.conversationId}-${turn.payload.nodeId}-${index}`,
          eyebrow: turn.payload.agentName,
          title: turn.payload.title,
          description: turn.payload.summary,
          meta: formatPanelDate(turn.payload.occurredAt),
          tone: 'amber' as const
        })),
    [runtime.seminarTurns]
  )
  const researchSignalCards = useMemo(() => {
    if (researchPreview) {
      return [
        {
          id: 'research-question',
          eyebrow: 'latest question',
          title: researchPreview.question || '最近一次研究问题',
          description: researchPreview.summary,
          meta: `更新于 ${formatPanelDate(researchPreview.updatedAt)}`,
          tone: 'amber' as const
        }
      ]
    }

    return runtime.seminarTurns
      .filter((turn) => turn.payload.phase === 'execution')
      .slice(-2)
      .reverse()
      .map((turn, index) => ({
        id: `${turn.conversationId}-${turn.payload.nodeId}-${index}`,
        eyebrow: turn.payload.agentName,
        title: turn.payload.title,
        description: turn.payload.summary,
        meta: formatPanelDate(turn.payload.occurredAt),
        tone: 'amber' as const
      }))
  }, [researchPreview, runtime.seminarTurns])

  const focusComposer = useCallback(() => {
    window.setTimeout(() => {
      const element = document.getElementById('canvas-command-input')
      if (element instanceof HTMLTextAreaElement) {
        element.focus()
      }
    }, 40)
  }, [])

  const queueCanvasPrompt = useCallback(
    (nextPrompt: string, notice: string) => {
      setPromptInput(nextPrompt)
      setActionNotice(notice)
      focusComposer()
    },
    [focusComposer]
  )

  const handleCopyToClipboard = useCallback(async (value: string, notice: string) => {
    if (!value.trim()) return
    try {
      await navigator.clipboard.writeText(value)
      setActionNotice(notice)
    } catch {
      setActionNotice('复制失败，请检查浏览器权限。')
    }
  }, [])

  const setPreviewActionTransientState = useCallback((id: string, state: Extract<PreviewActionState, 'success' | 'error'>) => {
    if (previewActionTimersRef.current[id]) {
      window.clearTimeout(previewActionTimersRef.current[id])
    }

    setPreviewActionStates((current) => ({
      ...current,
      [id]: state
    }))

    previewActionTimersRef.current[id] = window.setTimeout(() => {
      setPreviewActionStates((current) => ({
        ...current,
        [id]: 'idle'
      }))
      delete previewActionTimersRef.current[id]
    }, 2200)
  }, [])

  const handlePreviewAction = useCallback(async (action: PreviewAction) => {
    if (action.disabled) return

    if (previewActionTimersRef.current[action.id]) {
      window.clearTimeout(previewActionTimersRef.current[action.id])
      delete previewActionTimersRef.current[action.id]
    }

    setPreviewActionStates((current) => ({
      ...current,
      [action.id]: 'running'
    }))

    try {
      await action.onClick()
      setPreviewActionTransientState(action.id, 'success')
    } catch (error) {
      console.error('预览动作执行失败:', error)
      setPreviewActionTransientState(action.id, 'error')
    }
  }, [setPreviewActionTransientState])

  const executeCanvasPrompt = useCallback(
    async ({
      prompt,
      successMessage,
      startedNotice,
      completedNotice
    }: {
      prompt: string
      successMessage: string
      startedNotice: string
      completedNotice: string
    }) => {
      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) return

      if (isOrchestratorProcessing) {
        setActionNotice('当前引擎正在运行，请稍后再试。')
        return
      }

      setPromptInput(trimmedPrompt)
      setActionNotice(startedNotice)
      appendChatMessage({ role: 'user', content: trimmedPrompt })

      try {
        await callLangGraph(trimmedPrompt, nodes.length === 0 ? 'seed' : 'general', selectedKbId)
        appendChatMessage({
          role: 'assistant',
          content: successMessage
        })
        setPromptInput('')
        setActionNotice(completedNotice)
      } catch (error) {
        console.error('模块地图即时执行失败:', error)
        appendChatMessage({
          role: 'assistant',
          content: '执行失败，请稍后再试。'
        })
        setActionNotice('执行失败，请稍后再试。')
      }
    },
    [appendChatMessage, callLangGraph, isOrchestratorProcessing, nodes.length, selectedKbId]
  )

  const handleRunCritic = useCallback(async () => {
    try {
      await callCritic()
      appendChatMessage({
        role: 'assistant',
        content: '冲突扫描完成，建议优先查看 @experts 和智绘商业画布的最新变化。'
      })
      setActionNotice('已在当前工作台运行冲突检测。')
    } catch (error) {
      console.error('冲突检测失败:', error)
    }
  }, [appendChatMessage, callCritic])

  const handleCardDragStart = useCallback(
    (id: ModuleCardKey, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (window.innerWidth < 1280) return

      const cardElement = (event.currentTarget.closest('article') ?? null) as HTMLElement | null
      if (!cardElement || !boardRef.current) return

      const cardRect = cardElement.getBoundingClientRect()
      setDraggingCard({
        id,
        offsetX: event.clientX - cardRect.left,
        offsetY: event.clientY - cardRect.top,
        width: cardRect.width
      })
      setCardOrder((current) => [...current.filter((key) => key !== id), id])
      setActionNotice('拖拽模块卡可重新整理你的工作区地图。')
      event.preventDefault()
      event.stopPropagation()
    },
    []
  )

  const handleResetLayout = useCallback(() => {
    setCardPositions(DEFAULT_CARD_POSITIONS)
    setCardOrder(DEFAULT_CARD_ORDER)
    setCardVisibility(DEFAULT_CARD_VISIBILITY)
    localStorage.removeItem(buildCanvasLayoutStorageKey(params.workspaceId))
    localStorage.removeItem(buildCanvasLayerStorageKey(params.workspaceId))
    setActionNotice('模块布局已恢复到默认位置。')
  }, [params.workspaceId])

  const handleFocusCard = useCallback((id: ModuleCardKey) => {
    setExpandedCard(id)
    setCardOrder((current) => [...current.filter((key) => key !== id), id])
    setCardVisibility((current) => ({
      ...current,
      [id]: true
    }))
  }, [])

  const handleToggleVisibility = useCallback((id: ModuleCardKey) => {
    setCardVisibility((current) => {
      const nextVisible = !current[id]
      if (!nextVisible && expandedCard === id) {
        setExpandedCard(null)
      }
      return {
        ...current,
        [id]: nextVisible
      }
    })
  }, [expandedCard])

  const handleMoveLayer = useCallback((id: ModuleCardKey, direction: 'up' | 'down') => {
    setCardOrder((current) => {
      const index = current.indexOf(id)
      if (index === -1) return current
      const targetIndex = direction === 'up' ? Math.min(current.length - 1, index + 1) : Math.max(0, index - 1)
      if (targetIndex === index) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }, [])

  const expandedPanelContent = useMemo(() => {
    const panels: Record<ModuleCardKey, DrawerPanel> = {
      workspace: {
        eyebrow: 'Workspace pulse',
        title: '项目总览预览',
        summary: '这里聚合了当前工作区的推进状态，适合快速判断下一步要回到哪个工具或哪条主线。',
        href: `/workspace/${params.workspaceId}` as Route,
        thumbnailPreview: [
          `当前阶段：${runtime.latestPhase ?? 'idle'}`,
          finalRecommendation ?? '等待新的策略推进'
        ],
        sections: [
          {
            type: 'metrics',
            title: 'Workspace metrics',
            description: '当前工作区的即时运行状态。',
            items: [
              { label: 'phase', value: runtime.latestPhase ?? 'idle', tone: 'sky' },
              { label: 'nodes', value: `${nodes.length}`, tone: 'emerald' },
              { label: 'edges', value: `${edges.length}`, tone: 'amber' },
              { label: 'events', value: `${recentLogItems.length}`, tone: 'rose' }
            ]
          },
          {
            type: 'cards',
            title: 'Recent signals',
            description: '工作区最近发生的协作事件。',
            items: recentLogItems.map((item) => ({
              id: item.id,
              eyebrow: 'workspace event',
              title: item.label,
              tone: 'slate' as const
            })),
            emptyMessage: '还没有新的工作区事件。'
          },
          {
            type: 'spotlight',
            title: 'Current recommendation',
            description: '当前主工作台里最新的收敛判断。',
            content: finalRecommendation ?? '当前还没有最终建议。',
            meta: `画布节点 ${nodes.length} · 连接 ${edges.length}`,
            tone: 'sky'
          }
        ],
        actions: [
          {
            id: 'workspace-run-next',
            label: '立即生成下一步',
            tone: 'primary',
            runningLabel: '生成中',
            successLabel: '已完成',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: '基于当前工作区状态，给我一条最合适的下一步推进建议，并指出应该优先调用哪个工具。',
                startedNotice: '正在直接生成下一步建议...',
                completedNotice: '下一步建议已直接执行完成。',
                successMessage: '我已经根据当前工作区状态生成了下一步建议。'
              })
          },
          {
            id: 'workspace-queue-next',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                '基于当前工作区状态，给我一条最合适的下一步推进建议，并指出应该优先调用哪个工具。',
                '已把下一步建议请求放入底部输入框。'
              )
          }
        ]
      },
      knowledge: {
        eyebrow: '@knowledge preview',
        title: activeKnowledgeStatus?.knowledgeBase?.name ?? '知识底座实时预览',
        summary: '展示当前知识库底座、最新任务和正在处理的资料流入情况。',
        href: `/workspace/${params.workspaceId}/knowledge` as Route,
        thumbnailPreview: knowledgePreviewLines,
        sections: [
          {
            type: 'metrics',
            title: 'Ingestion status',
            description: '知识底座与任务流的实时统计。',
            items: [
              { label: 'knowledge bases', value: `${knowledgeBases.length}`, tone: 'sky' },
              { label: 'processing', value: `${processingTaskCount}`, tone: 'amber' },
              { label: 'completed', value: `${completedKnowledgeTaskCount}`, tone: 'emerald' },
              { label: 'evidence', value: `${knowledgeEvidence.length}`, tone: 'rose' }
            ]
          },
          {
            type: 'cards',
            title: 'Recent tasks',
            description: '最近进入知识底座的真实任务。',
            items: recentKnowledgeTasks.map((task) => ({
              id: task.id,
              eyebrow: `${KNOWLEDGE_TASK_TYPE_LABELS[task.type]} · ${KNOWLEDGE_TASK_STATUS_LABELS[task.status]}`,
              title: getKnowledgeTaskTitle(task),
              description: getKnowledgeTaskSummary(task),
              meta: `更新于 ${formatPanelDate(task.updatedAt)}`,
              tone: task.status === 'failed' ? 'rose' : task.status === 'processing' ? 'amber' : 'sky'
            })),
            emptyMessage: '当前底座还没有入库任务。'
          },
          {
            type: 'cards',
            title: 'Evidence feed',
            description: '已经被带入智慧画布的知识证据。',
            items: knowledgeEvidenceCards,
            emptyMessage: '还没有进入画布的证据节点。'
          },
          {
            type: 'spotlight',
            title: 'Base state',
            description: '当前知识底座的运行说明。',
            content: activeKnowledgeStatus?.knowledgeBase?.name
              ? `知识底座 ${activeKnowledgeStatus.knowledgeBase.name} 当前处于 ${activeKnowledgeStatus.knowledgeBase.status} 状态。`
              : '当前还没有建立可用的知识底座。',
            meta: latestKnowledgeTask
              ? `最近任务 ${KNOWLEDGE_TASK_TYPE_LABELS[latestKnowledgeTask.type]} · ${KNOWLEDGE_TASK_STATUS_LABELS[latestKnowledgeTask.status]}`
              : '等待新的知识输入',
            tone: 'sky'
          }
        ],
        actions: [
          {
            id: 'knowledge-run-ingest',
            label: '立即整理证据',
            tone: 'primary',
            runningLabel: '整理中',
            successLabel: '已整理',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: `基于当前知识库状态和最近资料，整理三条最值得进入智慧画布的证据节点。参考信息：${knowledgePreviewLines.join('；')}`,
                startedNotice: '正在直接整理知识证据...',
                completedNotice: '知识证据已直接整理进工作流。',
                successMessage: '我已经基于当前知识库状态整理了新的证据节点。'
              })
          },
          {
            id: 'knowledge-queue-ingest',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                `基于当前知识库状态和最近资料，整理三条最值得进入智慧画布的证据节点。参考信息：${knowledgePreviewLines.join('；')}`,
                '已把证据整理请求放入底部输入框。'
              )
          }
        ]
      },
      research: {
        eyebrow: '@research preview',
        title: '最近研究结果',
        summary: '优先展示最新的问题、摘要和来源数量，方便你在不离开画布时判断是否需要继续深挖。',
        href: `/workspace/${params.workspaceId}/deep-research` as Route,
        thumbnailPreview: researchPreviewLines,
        sections: [
          {
            type: 'metrics',
            title: 'Research telemetry',
            description: '当前研究快照的真实指标。',
            items: [
              { label: 'sources', value: `${researchPreview?.sourceCount ?? 0}`, tone: 'amber' },
              { label: 'updated', value: researchPreview ? formatPanelDate(researchPreview.updatedAt) : '暂无', tone: 'sky' },
              { label: 'execution turns', value: `${phaseCount.execution}`, tone: 'emerald' },
              { label: 'evidence linked', value: `${knowledgeEvidence.length}`, tone: 'rose' }
            ]
          },
          {
            type: 'cards',
            title: 'Latest research memory',
            description: '最近一次研究快照或执行阶段产出。',
            items: researchSignalCards,
            emptyMessage: '还没有保存的研究结果。'
          },
          {
            type: 'cards',
            title: 'Linked evidence',
            description: '当前研究判断背后的证据片段。',
            items: knowledgeEvidenceCards.slice(0, 2),
            emptyMessage: '还没有关联到研究的证据。'
          },
          {
            type: 'spotlight',
            title: 'Research summary',
            description: '当前研究结论的主摘要。',
            content: researchPreview?.summary || finalRecommendation || '等待新的研究摘要。',
            meta: researchPreview?.question
              ? `问题：${researchPreview.question}`
              : '还没有明确的研究问题',
            tone: 'amber'
          }
        ],
        actions: [
          {
            id: 'research-run-apply',
            label: '立即应用研究',
            tone: 'primary',
            runningLabel: '应用中',
            successLabel: '已回流',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: `把最近研究结论转成智慧画布中的关键节点、假设和行动路径。研究摘要：${researchPreview?.summary || finalRecommendation || '暂无摘要'}`,
                startedNotice: '正在直接应用研究结果...',
                completedNotice: '研究结果已直接回流到画布。',
                successMessage: '我已经把最近研究结果转成画布中的关键节点和行动路径。'
              })
          },
          {
            id: 'research-queue-apply',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                `把最近研究结论转成智慧画布中的关键节点、假设和行动路径。研究摘要：${researchPreview?.summary || finalRecommendation || '暂无摘要'}`,
                '已把研究应用请求放入底部输入框。'
              )
          }
        ]
      },
      translate: {
        eyebrow: '@translate preview',
        title: '最近语义转换',
        summary: '适合快速回看最近一次语言转换的输入、输出和转换模式。',
        href: `/workspace/${params.workspaceId}/translate` as Route,
        thumbnailPreview: translationPreviewLines,
        sections: [
          {
            type: 'metrics',
            title: 'Translation state',
            description: '最近一次转换的即时状态。',
            items: [
              { label: 'mode', value: translationPreview?.mode ?? 'semantic', tone: 'emerald' },
              { label: 'source chars', value: `${translationPreview?.source.length ?? 0}`, tone: 'sky' },
              { label: 'target chars', value: `${translationPreview?.target.length ?? 0}`, tone: 'amber' },
              { label: 'updated', value: translationPreview ? formatPanelDate(translationPreview.updatedAt) : '暂无', tone: 'rose' }
            ]
          },
          {
            type: 'cards',
            title: 'Translation relay',
            description: '最近一次输入与输出。',
            items: [
              {
                id: 'translate-source',
                eyebrow: 'source',
                title: translationPreview?.source || '暂无最近输入',
                tone: 'slate'
              },
              {
                id: 'translate-target',
                eyebrow: 'target',
                title: translationPreview?.target || '暂无最近输出',
                tone: 'emerald'
              }
            ]
          },
          {
            type: 'spotlight',
            title: 'Externalized output',
            description: '适合直接复制出去的最新表达。',
            content: translationPreview?.target || '当前还没有可对外使用的转换结果。',
            meta: translationPreview ? `模式 ${translationPreview.mode}` : '等待新的语义转换',
            tone: 'emerald'
          }
        ],
        actions: [
          {
            id: 'translate-copy-output',
            label: '复制最近输出',
            successLabel: '已复制',
            onClick: () =>
              void handleCopyToClipboard(
                translationPreview?.target || '',
                '已复制最近一次翻译结果。'
              )
          },
          {
            id: 'translate-run-externalize',
            label: '立即转成对外表达',
            tone: 'primary',
            runningLabel: '生成中',
            successLabel: '已生成',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: `基于以下翻译结果，生成一版更适合对外沟通和汇报的表达：${translationPreview?.target || translationPreview?.source || '暂无可用翻译结果'}`,
                startedNotice: '正在直接生成对外表达版本...',
                completedNotice: '对外表达版本已直接生成。',
                successMessage: '我已经基于最近翻译结果生成了更适合对外沟通的表达。'
              })
          },
          {
            id: 'translate-queue-externalize',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                `基于以下翻译结果，生成一版更适合对外沟通和汇报的表达：${translationPreview?.target || translationPreview?.source || '暂无可用翻译结果'}`,
                '已把对外表达请求放入底部输入框。'
              )
          }
        ]
      },
      experts: {
        eyebrow: '@experts preview',
        title: '专家协作摘要',
        summary: '把最新的分歧、专家席位和收敛结论先在画布中展开，确认后再进入详情页。',
        href: `/workspace/${params.workspaceId}/experts` as Route,
        thumbnailPreview: expertsPreviewLines,
        sections: [
          {
            type: 'metrics',
            title: 'Council telemetry',
            description: '专家协作层的实际活跃度。',
            items: [
              { label: 'active experts', value: `${collaborationSnapshot?.agentSnapshot.agents.length ?? 0}`, tone: 'rose' },
              { label: 'linked pairs', value: `${collaborationSnapshot?.agentSnapshot.linkedAgentPairs ?? 0}`, tone: 'sky' },
              { label: 'review nodes', value: `${phaseCount.review}`, tone: 'amber' },
              { label: 'decision state', value: pendingDecisionRequest ? 'pending' : finalRecommendation ? 'ready' : 'open', tone: 'emerald' }
            ]
          },
          {
            type: 'cards',
            title: 'Expert roster',
            description: '当前最活跃的专家席位。',
            items: expertRosterCards,
            emptyMessage: '还没有活跃的专家节点。'
          },
          {
            type: 'cards',
            title: 'Latest review turns',
            description: '最近发生的真实质询片段。',
            items: expertReviewCards,
            emptyMessage: '当前还没有新的 review 轮次。'
          },
          {
            type: 'spotlight',
            title: 'Current decision',
            description: '当前专家层给出的主结论或待确认意见。',
            content: pendingDecisionRequest?.payload.decision || finalRecommendation || '当前还没有最终结论。',
            meta: pendingDecisionRequest
              ? `待确认 · ${formatPanelDate(pendingDecisionRequest.payload.occurredAt)}`
              : finalRecommendation
                ? '已收敛'
                : '开放中',
            tone: 'rose'
          }
        ],
        actions: [
          {
            id: 'experts-run-critic',
            label: '运行冲突检测',
            runningLabel: '检测中',
            successLabel: '已完成',
            disabled: isCriticProcessing,
            onClick: () => {
              void handleRunCritic()
            }
          },
          {
            id: 'experts-run-integrate',
            label: '立即整合专家意见',
            tone: 'primary',
            runningLabel: '整合中',
            successLabel: '已整合',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: `结合当前专家协作结果，更新智慧画布的主结构和下一步行动。结论参考：${finalRecommendation ?? '暂无最终结论'}。`,
                startedNotice: '正在直接整合专家意见...',
                completedNotice: '专家意见已直接整合到工作台。',
                successMessage: '我已经基于当前专家协作结果更新了智慧画布结构。'
              })
          },
          {
            id: 'experts-queue-integrate',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                `结合当前专家协作结果，更新智慧画布的主结构和下一步行动。结论参考：${finalRecommendation ?? '暂无最终结论'}。`,
                '已把专家整合请求放入底部输入框。'
              )
          }
        ]
      },
      'live-board': {
        eyebrow: 'Live board preview',
        title: '智绘商业画布入口',
        summary: '这里承接更细粒度的节点拖拽和结构编辑，是主工作台向深度编辑态的延伸。',
        href: `/workspace/${params.workspaceId}/comfy` as Route,
        thumbnailPreview: [
          `节点：${nodes.length}，边：${edges.length}`,
          '适合进入细粒度节点编排与结构修整'
        ],
        sections: [
          {
            type: 'metrics',
            title: 'Board topology',
            description: '进入智绘商业画布前的即时结构概览。',
            items: [
              { label: 'nodes', value: `${nodes.length}`, tone: 'rose' },
              { label: 'edges', value: `${edges.length}`, tone: 'sky' },
              { label: 'evidence refs', value: `${knowledgeEvidence.length}`, tone: 'amber' },
              { label: 'seminar turns', value: `${runtime.seminarTurns.length}`, tone: 'rose' }
            ]
          },
          {
            type: 'cards',
            title: 'Board inputs',
            description: '当前可直接带入细粒度画布编辑的证据。',
            items: knowledgeEvidenceCards.slice(0, 2),
            emptyMessage: '还没有可带入细粒度画布的证据。'
          },
          {
            type: 'spotlight',
            title: 'Editing mode',
            description: '进入 live board 后的工作模式。',
            content: '适合继续拖拽节点、修改结构连接，并把当前策略拆成更细的商业画布模块。',
            meta: `当前主画布 ${nodes.length} 节点 / ${edges.length} 连线`,
            tone: 'sky'
          }
        ],
        actions: [
          {
            id: 'live-board-run-refine',
            label: '立即细化节点',
            tone: 'primary',
            runningLabel: '细化中',
            successLabel: '已细化',
            disabled: isOrchestratorProcessing,
            onClick: () =>
              executeCanvasPrompt({
                prompt: '把当前策略结构进一步细化成可编辑的商业画布节点，重点补足价值主张、关键活动和风险控制。',
                startedNotice: '正在直接细化商业画布节点...',
                completedNotice: '节点细化已直接执行完成。',
                successMessage: '我已经把当前策略结构细化成更适合进入智绘商业画布的节点。'
              })
          },
          {
            id: 'live-board-queue-refine',
            label: '填充到输入框',
            successLabel: '已填充',
            onClick: () =>
              queueCanvasPrompt(
                '把当前策略结构进一步细化成可编辑的商业画布节点，重点补足价值主张、关键活动和风险控制。',
                '已把节点细化请求放入底部输入框。'
              )
          }
        ]
      }
    }

    return expandedCard ? panels[expandedCard] : null
  }, [
    activeKnowledgeStatus?.knowledgeBase?.name,
    activeKnowledgeStatus?.knowledgeBase?.status,
    collaborationSnapshot?.agentSnapshot.agents,
    collaborationSnapshot?.agentSnapshot.linkedAgentPairs,
    completedKnowledgeTaskCount,
    edges.length,
    expertReviewCards,
    expertRosterCards,
    expertsPreviewLines,
    expandedCard,
    finalRecommendation,
    knowledgeBases.length,
    knowledgeEvidenceCards,
    knowledgeEvidence.length,
    knowledgePreviewLines,
    latestKnowledgeTask,
    nodes.length,
    params.workspaceId,
    pendingDecisionRequest,
    phaseCount.execution,
    phaseCount.review,
    processingTaskCount,
    executeCanvasPrompt,
    queueCanvasPrompt,
    researchPreview,
    researchPreviewLines,
    researchSignalCards,
    recentKnowledgeTasks,
    recentLogItems,
    runtime.seminarTurns.length,
    runtime.latestPhase,
    handleCopyToClipboard,
    handleRunCritic,
    isCriticProcessing,
    isOrchestratorProcessing,
    translationPreview,
    translationPreviewLines
  ])

  const expandedDrawerStatus = useMemo(() => {
    if (!expandedPanelContent) return null

    const runningAction = expandedPanelContent.actions.find((action) => previewActionStates[action.id] === 'running')
    if (runningAction) {
      return {
        tone: 'running' as const,
        label: runningAction.runningLabel ?? '执行中'
      }
    }

    const successAction = expandedPanelContent.actions.find((action) => previewActionStates[action.id] === 'success')
    if (successAction) {
      return {
        tone: 'success' as const,
        label: successAction.successLabel ?? '已完成'
      }
    }

    const errorAction = expandedPanelContent.actions.find((action) => previewActionStates[action.id] === 'error')
    if (errorAction) {
      return {
        tone: 'error' as const,
        label: errorAction.errorLabel ?? '重试'
      }
    }

    return null
  }, [expandedPanelContent, previewActionStates])

  const moduleCards = useMemo(
    () => [
      {
        id: 'workspace' as const,
        badge: 'workspace',
        title: 'Workspace Home',
        description: '项目总览、恢复入口和当前阶段状态。',
        href: `/workspace/${params.workspaceId}` as Route,
        statLabel: 'Current phase',
        statValue: runtime.latestPhase ?? 'idle',
        preview: [
          `${nodes.length} 个画布节点`,
          finalRecommendation ? '已有阶段性结论' : '等待新的策略推进'
        ],
        accentClass: 'bg-gradient-to-r from-sky-400/0 via-sky-300 to-sky-400/0',
        desktopClassName: 'xl:absolute xl:w-[320px]',
        desktopWidth: 320
      },
      {
        id: 'knowledge' as const,
        badge: '@knowledge',
        title: 'Knowledge Base',
        description: '导入、摘录、归档和供给证据，作为画布的资料底座。',
        href: `/workspace/${params.workspaceId}/knowledge` as Route,
        statLabel: 'Live ingestion',
        statValue: `${processingTaskCount}/${knowledgeTasks.length || knowledgeEvidence.length}`,
        preview: knowledgePreviewLines,
        accentClass: 'bg-gradient-to-r from-cyan-400/0 via-cyan-300 to-cyan-400/0',
        desktopClassName: 'xl:absolute xl:w-[340px]',
        desktopWidth: 340
      },
      {
        id: 'research' as const,
        badge: '@research',
        title: 'Deep Research',
        description: '对资料做问题拆解、趋势研究和风险提炼，再把结果回流到画布。',
        href: `/workspace/${params.workspaceId}/deep-research` as Route,
        statLabel: 'Recent research',
        statValue: `${researchPreview?.sourceCount ?? phaseCount.execution + phaseCount.review}`,
        preview: researchPreviewLines,
        accentClass: 'bg-gradient-to-r from-amber-400/0 via-amber-300 to-amber-400/0',
        desktopClassName: 'xl:absolute xl:w-[340px]',
        desktopWidth: 340
      },
      {
        id: 'translate' as const,
        badge: '@translate',
        title: 'Translation Relay',
        description: '在不同语言和语境之间转换结论，让内容更适合跨文化表达。',
        href: `/workspace/${params.workspaceId}/translate` as Route,
        statLabel: 'Recent transform',
        statValue: translationPreview?.mode ?? 'semantic',
        preview: translationPreviewLines,
        accentClass: 'bg-gradient-to-r from-emerald-400/0 via-emerald-300 to-emerald-400/0',
        desktopClassName: 'xl:absolute xl:w-[330px]',
        desktopWidth: 330
      },
      {
        id: 'experts' as const,
        badge: '@experts',
        title: 'Experts Council',
        description: '汇总 Agent 和 Seminar 的多角色观点、争议点和收敛建议。',
        href: `/workspace/${params.workspaceId}/experts` as Route,
        statLabel: 'Active experts',
        statValue: `${collaborationSnapshot?.agentSnapshot.agents.length ?? 0}`,
        preview: expertsPreviewLines,
        accentClass: 'bg-gradient-to-r from-rose-400/0 via-rose-300 to-rose-400/0',
        desktopClassName: 'xl:absolute xl:w-[340px]',
        desktopWidth: 340
      },
      {
        id: 'live-board' as const,
        badge: 'live-board',
        title: '智绘商业画布',
        description: '如果需要进入更细的节点拖拽和运行态编辑，这里是细节操作入口。',
        href: `/workspace/${params.workspaceId}/comfy` as Route,
        statLabel: 'Live topology',
        statValue: `${edges.length}`,
        preview: [
          '进入细粒度节点编排',
          '适合进一步拖拽、链接和结构编辑'
        ],
        accentClass: 'bg-gradient-to-r from-fuchsia-400/0 via-fuchsia-300 to-fuchsia-400/0',
        desktopClassName: 'xl:absolute xl:w-[330px]',
        desktopWidth: 330
      }
    ],
    [
      collaborationSnapshot?.agentSnapshot.agents.length,
      edges.length,
      finalRecommendation,
      knowledgeEvidence.length,
      knowledgePreviewLines,
      knowledgeTasks.length,
      nodes.length,
      params.workspaceId,
      phaseCount.execution,
      phaseCount.review,
      processingTaskCount,
      researchPreview,
      researchPreviewLines,
      runtime.latestPhase
      ,
      translationPreview,
      translationPreviewLines,
      expertsPreviewLines
    ]
  )

  const orderedModuleCards = useMemo(() => {
    const map = new Map(moduleCards.map((card) => [card.id, card]))
    return cardOrder
      .map((id) => map.get(id))
      .filter((card): card is (typeof moduleCards)[number] => Boolean(card))
  }, [cardOrder, moduleCards])

  const visibleModuleCards = useMemo(
    () => orderedModuleCards.filter((card) => cardVisibility[card.id]),
    [cardVisibility, orderedModuleCards]
  )

  const handlePromptSubmit = useCallback(async () => {
    const prompt = promptInput.trim()
    if (!prompt || isOrchestratorProcessing) return

    appendChatMessage({ role: 'user', content: prompt })

    try {
      await callLangGraph(prompt, nodes.length === 0 ? 'seed' : 'general', selectedKbId)
      appendChatMessage({
        role: 'assistant',
        content:
          nodes.length === 0
            ? '已经为你生成第一版模块和策略结构，接下来可以继续补充工具卡片或推进专家协作。'
            : '我已经根据你的输入更新了当前工作区地图和策略结构。'
      })
      setPromptInput('')
    } catch (error) {
      console.error('模块地图生成失败:', error)
      appendChatMessage({
        role: 'assistant',
        content: '生成失败，请稍后再试。'
      })
    }
  }, [appendChatMessage, callLangGraph, isOrchestratorProcessing, nodes.length, promptInput, selectedKbId])

  return (
    <div className="-mx-8 -my-8 min-h-[calc(100vh-64px)] overflow-hidden bg-[#07090f] text-white">
      <div className="relative min-h-[calc(100vh-64px)] bg-[radial-gradient(circle_at_top,rgba(51,75,118,0.34),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(31,41,55,0.42),transparent_26%),linear-gradient(180deg,#090b12_0%,#0b0f18_100%)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)',
            backgroundSize: '20px 20px'
          }}
        />

        <div className="relative z-10 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10">
              <Layers3 className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Workspace map</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">智慧画布模块地图</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              <Play className="h-4 w-4" />
              运行
            </button>
            <button
              type="button"
              onClick={handleResetLayout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              重置布局
            </button>
            <Link
              href={`/workspace/${params.workspaceId}/cultural-tools` as Route}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Wand2 className="h-4 w-4" />
              导出
            </Link>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
              <Share2 className="h-4 w-4" />
              分享
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 text-sm font-semibold text-white">
              J
            </div>
          </div>
        </div>

        <div className="relative z-10 px-8 pb-44 pt-2">
          <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,24,0.74)_0%,rgba(8,10,18,0.5)_100%)] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-[11px] uppercase tracking-[0.32em] text-sky-300/70">Core Carrier</p>
                <h2 className="mt-4 text-5xl font-semibold leading-[0.95] text-white">Canvas 作为载体，把工具组织成可见的工作空间</h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-400">
                  这不是传统侧边导航，而是工作区地图。`@knowledge`、`@research`、`@translate`、`@experts` 都作为空间中的可调用能力存在，最终统一回到中央策略结构。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: 'Nodes', value: `${nodes.length}` },
                  { label: 'Edges', value: `${edges.length}` },
                  { label: 'Experts', value: `${collaborationSnapshot?.agentSnapshot.agents.length ?? 0}` },
                  { label: 'Evidence', value: `${knowledgeEvidence.length}` }
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            ref={boardRef}
            className="relative mt-6 min-h-[980px] rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,10,18,0.56)_0%,rgba(5,7,14,0.68)_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          >
            <div className="mb-6 xl:hidden">
              <div className="grid gap-4 md:grid-cols-2">
                {visibleModuleCards.map((card) => (
                  <WorkspaceModuleCard
                    key={card.id}
                    {...card}
                    desktopStyle={cardPositions[card.id]}
                    isActive={expandedCard === card.id}
                    isDragging={draggingCard?.id === card.id}
                    onExpand={handleFocusCard}
                    onDragStart={handleCardDragStart}
                  />
                ))}
              </div>
            </div>

            <div className="hidden xl:block">
              {visibleModuleCards.map((card) => (
                <WorkspaceModuleCard
                  key={card.id}
                  {...card}
                  desktopStyle={cardPositions[card.id]}
                  isActive={expandedCard === card.id}
                  isDragging={draggingCard?.id === card.id}
                  onExpand={handleFocusCard}
                  onDragStart={handleCardDragStart}
                />
              ))}

              <div className="absolute left-6 top-6 z-20 w-[286px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92)_0%,rgba(8,11,20,0.94)_100%)] p-4 shadow-[0_26px_90px_rgba(0,0,0,0.34)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Layer stack</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">模块层级</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetLayout}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    title="Reset layout"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {orderedModuleCards.map((card, index) => {
                    const isVisible = cardVisibility[card.id]
                    return (
                      <div
                        key={card.id}
                        className={cn(
                          'rounded-[20px] border px-3 py-3 transition',
                          expandedCard === card.id
                            ? 'border-sky-300/30 bg-sky-300/10'
                            : 'border-white/10 bg-white/5'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleFocusCard(card.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-semibold text-white">{card.title}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                              z {index + 1} · {isVisible ? 'visible' : 'hidden'}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(card.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            title={isVisible ? 'Hide card' : 'Show card'}
                          >
                            {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleMoveLayer(card.id, 'down')}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            title="Send backward"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveLayer(card.id, 'up')}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                            title="Bring forward"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {expandedPanelContent && expandedCard ? (
                <WorkDrawerPanel
                  panel={expandedPanelContent}
                  cardId={expandedCard}
                  actionStates={previewActionStates}
                  onTriggerAction={(action) => {
                    void handlePreviewAction(action)
                  }}
                  onClose={() => setExpandedCard(null)}
                  status={expandedDrawerStatus}
                  variant="desktop"
                />
              ) : null}

              <div className="absolute left-[36rem] top-[18rem] w-[390px] rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.34)] backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-full bg-sky-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-200">
                      main-stage
                    </span>
                    <h3 className="mt-4 text-3xl font-semibold text-white">Strategy Engine Canvas</h3>
                  </div>
                  <Link
                    href={`/workspace/${params.workspaceId}/comfy` as Route}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200"
                  >
                    Open live board
                  </Link>
                </div>

                <div className="mt-5 rounded-[26px] border border-dashed border-sky-300/18 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08),transparent_56%)] px-5 py-6">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.8)]" />
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                    <div className="h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.8)]" />
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
                    <div className="h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.8)]" />
                  </div>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Evidence Mesh', value: `${knowledgeEvidence.length}` },
                      { label: 'Reasoning Flow', value: `${runtime.seminarTurns.length}` },
                      { label: 'Decision State', value: finalRecommendation ? 'ready' : 'open' }
                    ].map((item) => (
                      <div key={item.label} className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current recommendation</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">
                      {finalRecommendation ?? '还没有最终建议。你可以继续补充知识、发起研究，或让专家协作进一步收敛。'}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'P', value: phaseCount.planning },
                      { label: 'E', value: phaseCount.execution },
                      { label: 'R', value: phaseCount.review },
                      { label: 'D', value: phaseCount.decision }
                    ].map((item) => (
                      <div key={item.label} className="rounded-[18px] bg-white/5 px-3 py-3 text-center">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1200 980" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="workspace-connection" x1="0%" x2="100%" y1="0%" y2="0%">
                    <stop offset="0%" stopColor="rgba(148,163,184,0.04)" />
                    <stop offset="50%" stopColor="rgba(148,163,184,0.34)" />
                    <stop offset="100%" stopColor="rgba(148,163,184,0.04)" />
                  </linearGradient>
                </defs>
                <path d="M 300 210 C 420 180, 470 180, 576 220" stroke="url(#workspace-connection)" strokeWidth="2" fill="none" />
                <path d="M 650 220 C 760 220, 830 235, 920 320" stroke="url(#workspace-connection)" strokeWidth="2" fill="none" />
                <path d="M 330 500 C 420 470, 500 410, 600 350" stroke="url(#workspace-connection)" strokeWidth="2" fill="none" />
                <path d="M 790 540 C 735 470, 700 410, 664 360" stroke="url(#workspace-connection)" strokeWidth="2" fill="none" />
                <path d="M 600 430 C 735 520, 800 600, 900 620" stroke="url(#workspace-connection)" strokeWidth="2" fill="none" />
              </svg>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#090b12] via-[#090b12]/70 to-transparent" />

            {expandedPanelContent && expandedCard ? (
              <div className="mb-6 xl:hidden">
                <WorkDrawerPanel
                  panel={expandedPanelContent}
                  cardId={expandedCard}
                  actionStates={previewActionStates}
                  onTriggerAction={(action) => {
                    void handlePreviewAction(action)
                  }}
                  onClose={() => setExpandedCard(null)}
                  status={expandedDrawerStatus}
                  variant="mobile"
                />
              </div>
            ) : null}

            <div className="absolute bottom-8 left-8 w-[290px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.92)_0%,rgba(8,11,20,0.92)_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5">
                    <Bot className="h-5 w-5 text-slate-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">智能体日志</p>
                    <p className="text-xs text-slate-500">最近协作动态</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">{recentLogItems.length}</span>
              </div>

              <div className="mt-4 space-y-2">
                {recentLogItems.length > 0 ? (
                  recentLogItems.map((item) => (
                    <div key={item.id} className="rounded-[18px] bg-white/5 px-3 py-3 text-sm text-slate-300">
                      {item.label}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[18px] bg-white/5 px-3 py-3 text-sm text-slate-500">
                    还没有新的协作事件。
                  </div>
                )}
              </div>
            </div>

            <div className="absolute right-8 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.88)_0%,rgba(8,11,20,0.92)_100%)] px-3 py-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              {[
                { icon: MousePointer2, label: 'Select' },
                { icon: ScanSearch, label: 'Focus' },
                { icon: Camera, label: 'Capture' },
                { icon: Hand, label: 'Move' },
                { icon: RotateCcw, label: 'Reset', onClick: handleResetLayout }
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                  title={item.label}
                >
                  <item.icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-8 left-1/2 z-20 w-[min(860px,calc(100%-20rem))] -translate-x-1/2 max-lg:w-[calc(100%-2rem)]">
          <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.94)_0%,rgba(8,11,20,0.96)_100%)] px-6 py-5 shadow-[0_34px_90px_rgba(0,0,0,0.34)] backdrop-blur">
            <div className="flex flex-col gap-4">
              <textarea
                id="canvas-command-input"
                value={promptInput}
                onChange={(event) => setPromptInput(event.target.value)}
                placeholder="您想更改或创建什么内容？例如：把知识库里的欧洲市场证据整理成三条进入策略，并让 @experts 给出争议点。"
                className="min-h-[74px] w-full resize-none border-none bg-transparent text-base leading-7 text-white outline-none placeholder:text-slate-500"
              />
              {actionNotice ? (
                <div className="rounded-[20px] border border-sky-300/14 bg-sky-300/8 px-4 py-3 text-sm text-sky-100">
                  {actionNotice}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10">
                    <Plus className="h-4 w-4" />
                  </button>
                  <KbSelector
                    knowledgeBases={knowledgeBases}
                    value={selectedKbId}
                    onChange={setSelectedKbId}
                    disabled={isOrchestratorProcessing}
                    className="h-10 min-w-[180px] rounded-full border-white/10 bg-white/5 text-slate-300"
                  />
                  <button
                    onClick={handleRunCritic}
                    disabled={isCriticProcessing}
                    className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {isCriticProcessing ? '扫描中...' : '冲突检测'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300">
                    <BrainCircuit className="h-4 w-4 text-sky-300" />
                    智慧画布引擎
                  </div>
                  <button
                    onClick={() => void handlePromptSubmit()}
                    disabled={!promptInput.trim() || isOrchestratorProcessing}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 shadow-[0_14px_40px_rgba(56,189,248,0.32)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {pendingDecisionRequest ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.96)_0%,rgba(8,11,20,0.96)_100%)] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.42)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_18px_40px_rgba(251,191,36,0.24)]">
                  <AlertTriangle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">专家协作请求你做决策</p>
                  <p className="mt-1 text-xs text-slate-500">先在模块地图里确认方向，再决定是否继续自动修正。</p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 px-5 py-5">
                <p className="text-sm leading-7 text-slate-200">{pendingDecisionRequest.payload.decision}</p>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  onClick={async () => {
                    await approveDecision(pendingDecisionRequest.conversationId, 'auto_revise')
                    appendChatMessage({ role: 'assistant', content: '已要求专家协作继续自动修正。' })
                  }}
                  className="flex w-full items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
                >
                  <Check className="h-4 w-4 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white">让系统继续修正</p>
                    <p className="mt-1 text-xs text-slate-500">继续推进下一轮专家讨论。</p>
                  </div>
                </button>

                <div className="flex gap-2">
                  <input
                    value={hitlInput}
                    onChange={(event) => setHitlInput(event.target.value)}
                    placeholder="输入你的修正方向..."
                    className="h-12 flex-1 rounded-[20px] border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    onClick={async () => {
                      if (!hitlInput.trim()) return
                      await approveDecision(pendingDecisionRequest.conversationId, hitlInput.trim())
                      appendChatMessage({ role: 'assistant', content: `已同步你的指导：“${hitlInput.trim()}”。` })
                      setHitlInput('')
                    }}
                    disabled={!hitlInput.trim()}
                    className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 disabled:opacity-60"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={async () => {
                    await approveDecision(pendingDecisionRequest.conversationId, 'accept_current')
                    appendChatMessage({ role: 'assistant', content: '已接受当前专家结论。' })
                  }}
                  className="flex w-full items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10"
                >
                  <X className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-white">接受当前结果</p>
                    <p className="mt-1 text-xs text-slate-500">保持当前判断，进入下一阶段。</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">v1 module map</span>
        </div>
      </div>
    </div>
  )
}
