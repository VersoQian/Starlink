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
import { useConversationRuntime, useWorkspaceGraph } from '@/features/workspace/hooks'
import { buildAgentWorkspaceSnapshot, buildSeminarSnapshot } from '@/features/workspace/lib/agent-runtime'
import {
  buildResearchPreviewStorageKey,
  buildTranslationPreviewStorageKey,
  type ResearchPreviewSnapshot,
  type TranslationPreviewSnapshot
} from '@/shared/lib/tool-preview-storage'
import { cn } from '@/shared/lib/utils'

type WorkspaceCanvasPageProps = {
  params: { workspaceId: string }
}

type ModuleCardKey = 'workspace' | 'knowledge' | 'research' | 'translate' | 'experts' | 'live-board'

type PreviewAction = {
  label: string
  tone?: 'primary' | 'secondary'
  onClick: () => void
}

type CardPosition = {
  x: number
  y: number
}

type CardPositionMap = Record<ModuleCardKey, CardPosition>
type CardVisibilityMap = Record<ModuleCardKey, boolean>

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

export default function WorkspaceCanvasPage({ params }: WorkspaceCanvasPageProps) {
  const boardRef = useRef<HTMLDivElement>(null)
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
  const [expandedCard, setExpandedCard] = useState<ModuleCardKey | null>('knowledge')
  const [researchPreview, setResearchPreview] = useState<ResearchPreviewSnapshot | null>(null)
  const [translationPreview, setTranslationPreview] = useState<TranslationPreviewSnapshot | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
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

  const knowledgeTasks = activeKnowledgeStatus?.tasks ?? []
  const latestKnowledgeTask = knowledgeTasks.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  const processingTaskCount = knowledgeTasks.filter((task) => task.status === 'processing').length
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
    const topExperts = collaborationSnapshot?.agentSnapshot.agents.slice(0, 3) ?? []

    const panels: Record<
      ModuleCardKey,
      {
        eyebrow: string
        title: string
        summary: string
        items: string[]
        href: Route
        actions: PreviewAction[]
      }
    > = {
      workspace: {
        eyebrow: 'Workspace pulse',
        title: '项目总览预览',
        summary: '这里聚合了当前工作区的推进状态，适合快速判断下一步要回到哪个工具或哪条主线。',
        items: [
          `当前阶段：${runtime.latestPhase ?? 'idle'}`,
          `画布节点：${nodes.length}，连接：${edges.length}`,
          finalRecommendation ?? '当前还没有最终建议'
        ],
        href: `/workspace/${params.workspaceId}` as Route,
        actions: [
          {
            label: '填充下一步建议',
            tone: 'primary',
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
        items: [
          `知识库数量：${knowledgeBases.length}`,
          `处理中任务：${processingTaskCount}`,
          latestKnowledgeTask
            ? `最近任务：${latestKnowledgeTask.type} · ${latestKnowledgeTask.status}`
            : '暂无入库任务',
          ...knowledgePreviewLines
        ],
        href: `/workspace/${params.workspaceId}/knowledge` as Route,
        actions: [
          {
            label: '整理证据入画布',
            tone: 'primary',
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
        items: [
          researchPreview?.question || '尚无已保存研究问题',
          researchPreview?.summary || finalRecommendation || '等待新的研究摘要',
          `来源数量：${researchPreview?.sourceCount ?? 0}`
        ],
        href: `/workspace/${params.workspaceId}/deep-research` as Route,
        actions: [
          {
            label: '应用研究到画布',
            tone: 'primary',
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
        items: [
          `模式：${translationPreview?.mode ?? 'semantic'}`,
          translationPreview?.source || '暂无最近输入',
          translationPreview?.target || '暂无最近输出'
        ],
        href: `/workspace/${params.workspaceId}/translate` as Route,
        actions: [
          {
            label: '复制最近输出',
            onClick: () =>
              void handleCopyToClipboard(
                translationPreview?.target || '',
                '已复制最近一次翻译结果。'
              )
          },
          {
            label: '转成对外表达',
            tone: 'primary',
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
        items: [
          `活跃专家：${collaborationSnapshot?.agentSnapshot.agents.length ?? 0}`,
          `质询：${phaseCount.review} · 决策：${phaseCount.decision}`,
          ...topExperts.map((agent) => `${agent.name} · ${agent.role}`),
          finalRecommendation ?? '当前还没有最终结论'
        ],
        href: `/workspace/${params.workspaceId}/experts` as Route,
        actions: [
          {
            label: '运行冲突检测',
            onClick: () => {
              void handleRunCritic()
            }
          },
          {
            label: '整合专家意见',
            tone: 'primary',
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
        items: [
          `节点：${nodes.length}，边：${edges.length}`,
          `证据引用：${knowledgeEvidence.length}`,
          '适合进入细粒度节点编排与结构修整'
        ],
        href: `/workspace/${params.workspaceId}/comfy` as Route,
        actions: [
          {
            label: '生成更细节点',
            tone: 'primary',
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
    collaborationSnapshot?.agentSnapshot.agents,
    edges.length,
    expandedCard,
    finalRecommendation,
    knowledgeBases.length,
    knowledgeEvidence.length,
    knowledgePreviewLines,
    latestKnowledgeTask,
    nodes.length,
    params.workspaceId,
    phaseCount.decision,
    phaseCount.review,
    processingTaskCount,
    queueCanvasPrompt,
    researchPreview,
    runtime.latestPhase,
    handleCopyToClipboard,
    handleRunCritic,
    translationPreview
  ])

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
      await callLangGraph(prompt, nodes.length === 0 ? 'seed' : 'general')
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
  }, [appendChatMessage, callLangGraph, isOrchestratorProcessing, nodes.length, promptInput])

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

              {expandedPanelContent ? (
                <div className="absolute right-24 top-8 z-20 w-[360px] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.96)_0%,rgba(8,11,20,0.96)_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{expandedPanelContent.eyebrow}</p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">{expandedPanelContent.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedCard(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-400">{expandedPanelContent.summary}</p>

                  <div className="mt-5 space-y-3">
                    {expandedPanelContent.items.map((item) => (
                      <div key={item} className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>

                  {expandedPanelContent.actions.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {expandedPanelContent.actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-semibold transition',
                            action.tone === 'primary'
                              ? 'bg-white text-slate-950 hover:bg-slate-200'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedCard(null)}
                      className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
                    >
                      收起预览
                    </button>
                    <Link
                      href={expandedPanelContent.href}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Open page
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
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

            {expandedPanelContent ? (
              <div className="mb-6 xl:hidden">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.96)_0%,rgba(8,11,20,0.96)_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{expandedPanelContent.eyebrow}</p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">{expandedPanelContent.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedCard(null)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-slate-400">{expandedPanelContent.summary}</p>
                  <div className="mt-5 space-y-3">
                    {expandedPanelContent.items.map((item) => (
                      <div key={item} className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                  {expandedPanelContent.actions.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {expandedPanelContent.actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-semibold transition',
                            action.tone === 'primary'
                              ? 'bg-white text-slate-950 hover:bg-slate-200'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5">
                    <Link
                      href={expandedPanelContent.href}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Open page
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
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
