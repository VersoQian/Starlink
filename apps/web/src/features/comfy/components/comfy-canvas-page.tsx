'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Node } from 'reactflow'
import { useComfyStore } from '../store'
import { CCBMCDetailDrawer } from './cc-bmc-detail-drawer'
import { CanvasHeader } from './canvas-header'
import { CanvasFlow } from './canvas'
import { CanvasTutorialDialog } from './canvas-tutorial-dialog'
import { WorkspaceShell } from './workspace-shell'
import type { PendingDecisionRequest } from './workspace-shell-context'
import './panels/register-default-panels'
import { useCitationHighlight } from '../hooks/use-citation-highlight'
import { useConversationRuntime } from '@/features/workspace/hooks'
import { BmcGrid } from '@/features/macra/components/BmcGrid'
import type { MacraNodeData } from '@/types/macra'
import { LayoutGrid, PanelsTopLeft } from 'lucide-react'

type CanvasPageProps = {
  workspaceId?: string
  /**
   * When true, render the canvas full-viewport WITHOUT WorkspaceShell's
   * left/right panel rails. The CanvasHeader still sits on top and the
   * canvas occupies all remaining space. Used by the (standalone)
   * /canvas/[workspaceId] route — gives the user a chromeless work
   * surface for demos / focused editing without the input panel,
   * node library, knowledge sidebar etc.
   *
   * Defaults to false so /workspace/[id]/canvas (the existing route
   * inside the (app) shell) keeps its current full UI.
   */
  standalone?: boolean
}

const CANVAS_TUTORIAL_STORAGE_KEY = 'canvas_tutorial_seen'
const LEGACY_TUTORIAL_STORAGE_KEY = 'comfy_tutorial_seen'

export function CanvasPage({
  workspaceId = 'canvas-default',
  standalone = false,
}: CanvasPageProps) {
  const nodes = useComfyStore((state) => state.nodes)
  const edges = useComfyStore((state) => state.edges)
  const onNodesChange = useComfyStore((state) => state.onNodesChange)
  const onEdgesChange = useComfyStore((state) => state.onEdgesChange)
  const onConnect = useComfyStore((state) => state.onConnect)
  const setNodes = useComfyStore((state) => state.setNodes)
  const callLangGraph = useComfyStore((state) => state.callLangGraph)
  const isOrchestratorProcessing = useComfyStore((state) => state.isOrchestratorProcessing)
  const callCritic = useComfyStore((state) => state.callCritic)
  const setWorkspaceId = useComfyStore((state) => state.setWorkspaceId)
  const appendChatMessage = useComfyStore((state) => state.appendChatMessage)
  const setChatInput = useComfyStore((state) => state.setChatInput)
  const approveDecision = useComfyStore((state) => state.approveDecision)
  const macraNodes = useComfyStore((state) => state.macraNodes)
  const openDetailPanel = useComfyStore((state) => state.openDetailPanel)
  const workflowStage = useComfyStore((state) => state.workflowStage)
  const setWorkflowStage = useComfyStore((state) => state.setWorkflowStage)
  const exportCanvasJson = useComfyStore((state) => state.exportCanvasJson)
  const importCanvasJson = useComfyStore((state) => state.importCanvasJson)

  const handleExportCanvas = useCallback((): void => {
    const json = exportCanvasJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    link.href = url
    link.download = `canvas-${workspaceId}-${stamp}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [exportCanvasJson, workspaceId])

  const handleImportCanvas = useCallback(
    async (file: File): Promise<void> => {
      try {
        const text = await file.text()
        importCanvasJson(text)
      } catch (err) {
        // Surface to the user — bad JSON / wrong version / missing fields
        // shouldn't silently corrupt the canvas.
        const message = err instanceof Error ? err.message : String(err)
        if (typeof window !== 'undefined') window.alert(`画布导入失败：${message}`)
      }
    },
    [importCanvasJson]
  )

  const runtime = useConversationRuntime(workspaceId)
  const [viewMode, setViewMode] = useState<'freeform' | 'bmc'>('freeform')

  // Citation highlight: Esc 键清除反向高亮 + 卡片高亮 className derivation
  useCitationHighlight()

  // 检测 HITL 决策请求
  const pendingDecisionRequest = useMemo(() => {
    const requests = runtime.events.filter(
      (e): e is Extract<typeof e, { type: 'seminar.decision.requested' }> =>
        e.type === 'seminar.decision.requested'
    )
    const decisions = runtime.events.filter(
      (e) => e.type === 'seminar.decision.made'
    )
    // 只显示最新的未响应的决策请求
    if (requests.length > decisions.length) {
      return requests[requests.length - 1]
    }
    return null
  }, [runtime.events])

  const [hitlInput, setHitlInput] = useState('')

  const [seedInput, setSeedInput] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)
  const structuredNodes = useMemo(
    () =>
      Array.from(macraNodes.values()).filter((node): node is MacraNodeData =>
        typeof node.domain === 'string' && node.type === 'cc-bmc-card'
      ),
    [macraNodes]
  )
  const conflictAlertCount = useMemo(
    () => Array.from(macraNodes.values()).filter((node) => node.type === 'conflict-alert').length,
    [macraNodes]
  )

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setWorkspaceId(workspaceId)
  }, [setWorkspaceId, workspaceId])

  useEffect(() => {
    if (pendingDecisionRequest) {
      setWorkflowStage('review', 'decision-requested')
      return
    }

    if (!isOrchestratorProcessing && (workflowStage === 'thinking' || workflowStage === 'revising')) {
      setWorkflowStage(nodes.length > 0 ? 'output' : 'idle', nodes.length > 0 ? 'analysis-finished' : 'analysis-cleared')
    }
  }, [isOrchestratorProcessing, nodes.length, pendingDecisionRequest, setWorkflowStage, workflowStage])

  useEffect(() => {
    const hasSeenTutorial =
      localStorage.getItem(CANVAS_TUTORIAL_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_TUTORIAL_STORAGE_KEY)
    if (!hasSeenTutorial && nodes.length === 0) {
      setShowTutorial(true)
    }
  }, [nodes.length])

  const handleCloseTutorial = useCallback(() => {
    setShowTutorial(false)
    localStorage.setItem(CANVAS_TUTORIAL_STORAGE_KEY, 'true')
  }, [])

  const handleNextStep = useCallback(() => {
    if (tutorialStep < 2) {
      setTutorialStep((currentStep) => currentStep + 1)
      return
    }
    handleCloseTutorial()
  }, [handleCloseTutorial, tutorialStep])

  const addNode = useCallback(
    (type: string) => {
      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: {
          x: Math.random() * 400 + 300,
          y: Math.random() * 400 + 200,
        },
        data: { label: `${type} node` },
      }
      setNodes((previousNodes) => [...previousNodes, newNode])
    },
    [setNodes]
  )

  const handleSeedInputChange = useCallback((value: string) => {
    setSeedInput(value)
    if (value.trim()) {
      setWorkflowStage('input', 'seed-draft')
      return
    }

    if (nodes.length === 0 && !isOrchestratorProcessing) {
      setWorkflowStage('idle', 'seed-cleared')
    }
  }, [isOrchestratorProcessing, nodes.length, setWorkflowStage])

  const handleSeedGeneration = useCallback(async () => {
    if (!seedInput.trim() || isOrchestratorProcessing) return

    appendChatMessage({ role: 'user', content: seedInput })

    try {
      await callLangGraph(seedInput, 'seed')
      appendChatMessage({
        role: 'assistant',
        content: `已为你生成基于"${seedInput}"的初始画布。继续对话来完善它。`,
      })
      setSeedInput('')
    } catch (error) {
      console.error('种子生成失败:', error)
      appendChatMessage({
        role: 'assistant',
        content: '抱歉，AI 生成失败，请稍后再试。',
      })
    }
  }, [appendChatMessage, callLangGraph, isOrchestratorProcessing, seedInput])

  const handleSendChat = useCallback(async () => {
    const { chatInput } = useComfyStore.getState()
    if (!chatInput.trim() || isOrchestratorProcessing) return

    appendChatMessage({ role: 'user', content: chatInput })

    try {
      await callLangGraph(chatInput, 'general')
      appendChatMessage({
        role: 'assistant',
        content: '已根据你的问题更新画布。',
      })
      setChatInput('')
    } catch (error) {
      console.error('对话失败:', error)
    }
  }, [appendChatMessage, callLangGraph, isOrchestratorProcessing, setChatInput])

  const handleRunCritic = useCallback(async () => {
    try {
      await callCritic()
      appendChatMessage({
        role: 'assistant',
        content: '冲突扫描完成。如发现问题，已在画布上标记。',
      })
    } catch (error) {
      console.error('冲突检测失败:', error)
    }
  }, [appendChatMessage, callCritic])

  const handleApproveAutoRevise = useCallback(async () => {
    if (!pendingDecisionRequest) return
    await approveDecision(pendingDecisionRequest.conversationId, 'auto_revise')
    appendChatMessage({ role: 'assistant', content: '已指示 Agent 自行修正冲突。' })
  }, [appendChatMessage, approveDecision, pendingDecisionRequest])

  const handleApproveCustomDecision = useCallback(async () => {
    if (!pendingDecisionRequest || !hitlInput.trim()) return
    await approveDecision(pendingDecisionRequest.conversationId, hitlInput.trim())
    appendChatMessage({ role: 'assistant', content: `已将你的指导 "${hitlInput.trim()}" 传达给 Agent。` })
    setHitlInput('')
  }, [appendChatMessage, approveDecision, hitlInput, pendingDecisionRequest])

  const handleAcceptCurrentDecision = useCallback(async () => {
    if (!pendingDecisionRequest) return
    await approveDecision(pendingDecisionRequest.conversationId, 'accept_current')
    appendChatMessage({ role: 'assistant', content: '已接受当前分析结果。' })
    setWorkflowStage('output', 'decision-accepted')
  }, [appendChatMessage, approveDecision, pendingDecisionRequest, setWorkflowStage])

  const shellContext = useMemo(() => ({
    workspaceId,
    isAnimating,
    viewMode,
    seedInput,
    onSeedInputChange: handleSeedInputChange,
    onAddNode: addNode,
    onSeedGeneration: handleSeedGeneration,
    onRunCritic: handleRunCritic,
    onSendChat: handleSendChat,
    pendingDecisionRequest: pendingDecisionRequest
      ? {
          conversationId: pendingDecisionRequest.conversationId,
          payload: {
            decision: pendingDecisionRequest.payload.decision,
            occurredAt: pendingDecisionRequest.payload.occurredAt
          }
        } satisfies PendingDecisionRequest
      : null,
    hitlInput,
    onHitlInputChange: setHitlInput,
    onApproveAutoRevise: handleApproveAutoRevise,
    onApproveCustomDecision: handleApproveCustomDecision,
    onAcceptCurrentDecision: handleAcceptCurrentDecision
  }), [
    workspaceId,
    isAnimating,
    viewMode,
    seedInput,
    handleSeedInputChange,
    addNode,
    handleSeedGeneration,
    handleRunCritic,
    handleSendChat,
    pendingDecisionRequest,
    hitlInput,
    handleApproveAutoRevise,
    handleApproveCustomDecision,
    handleAcceptCurrentDecision
  ])

  // Standalone mode: bypass WorkspaceShell + panel rails entirely.
  // Renders just the CanvasHeader on top + CanvasFlow taking the
  // rest of the viewport. Detail drawer + tutorial dialog still
  // available as overlays. Only honoured for freeform mode (BMC
  // grid view requires the shell's persistent panels).
  // Shared BMC grid view content — used by BOTH standalone and full
  // (WorkspaceShell-wrapped) renders so the visual treatment is the
  // same regardless of route. v2 editorial: ash-bordered hairlines,
  // mono kicker stats, no cyan/amber blur orbs, no glass cards.
  const bmcGridContent = (
    <main
      className={`relative flex-1 overflow-hidden bg-ink ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.3s' }}
    >
      {/* Paper grain overlay so the empty BMC view doesn't look like a void */}
      <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none bg-grain-ink" />

      <div className="relative z-[1] flex h-full flex-col px-6 pb-6 pt-5">
        {/* Mast — section kicker + stats readouts */}
        <header className="mb-4 flex items-baseline justify-between gap-6 border-b-[1.5px] border-paper/30 pb-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <LayoutGrid className="h-3.5 w-3.5 text-paper-ash3 self-center" strokeWidth={1.5} />
              <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
                STRUCTURED BUSINESS MODEL · 九宫格
              </span>
            </div>
            <h2 className="font-display font-[700] text-[20px] tracking-[0.02em] text-paper truncate">
              CC-BMC 结构化输出视图
            </h2>
            <p className="font-body text-[12px] leading-[1.55] text-paper/70 max-w-measure-body">
              用于答辩演示、结构化审阅和维度冲突检查。自由画布负责推演，九宫格负责归档表达。
            </p>
          </div>
          <div className="flex items-stretch gap-0 shrink-0 border-[1px] border-paper/30">
            <div className="flex flex-col items-center justify-center px-4 py-2 border-r-[1px] border-paper/20 min-w-[80px]">
              <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
                BMC NODES
              </span>
              <span className="font-display font-[700] text-[20px] tabular-nums text-paper leading-none mt-1">
                {String(structuredNodes.length).padStart(2, '0')}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center px-4 py-2 min-w-[80px]">
              <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
                CONFLICTS
              </span>
              <span
                className={`font-display font-[700] text-[20px] tabular-nums leading-none mt-1 ${
                  conflictAlertCount > 0 ? 'text-press' : 'text-paper'
                }`}
              >
                {String(conflictAlertCount).padStart(2, '0')}
              </span>
            </div>
          </div>
        </header>

        {/* Grid surface */}
        <div className="relative min-h-0 flex-1 border-[1px] border-ink-ash3/30 bg-ink-ash1">
          {structuredNodes.length > 0 ? (
            <BmcGrid
              nodes={structuredNodes}
              conflicts={[]}
              onNodeClick={(node) => openDetailPanel(node.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
              <PanelsTopLeft className="h-8 w-8 text-paper-ash3" strokeWidth={1.25} />
              <div className="space-y-2">
                <h3 className="font-display font-[700] text-[15px] tracking-[0.02em] text-paper">
                  还没有可展示的 BMC 结构节点
                </h3>
                <p className="font-body text-[12px] leading-[1.55] text-paper/70 max-w-measure-cell">
                  先在自由画布中运行多智能体分析或补充业务节点，系统会把带有商业维度的结果自动归入九宫格视图。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )

  const freeformContent = (
    <CanvasFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isAnimating={isAnimating}
    />
  )

  // Standalone (chromeless) — honour for BOTH viewModes so flipping the
  // header segmented control doesn't suddenly summon WorkspaceShell.
  if (standalone) {
    return (
      <div className="h-screen w-screen flex flex-col bg-ink overflow-hidden">
        <CanvasHeader
          isAnimating={isAnimating}
          onOpenTutorial={() => setShowTutorial(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          workflowStage={workflowStage}
          onExportCanvas={handleExportCanvas}
          onImportCanvas={handleImportCanvas}
        />
        <div className="flex-1 relative">
          {viewMode === 'freeform' ? freeformContent : bmcGridContent}
        </div>
        <CanvasTutorialDialog
          open={showTutorial}
          tutorialStep={tutorialStep}
          onClose={handleCloseTutorial}
          onNext={handleNextStep}
        />
        <CCBMCDetailDrawer />
      </div>
    )
  }

  return (
    <WorkspaceShell
      context={shellContext}
      header={
        <CanvasHeader
          isAnimating={isAnimating}
          onOpenTutorial={() => setShowTutorial(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          workflowStage={workflowStage}
          onExportCanvas={handleExportCanvas}
          onImportCanvas={handleImportCanvas}
        />
      }
      main={viewMode === 'freeform' ? freeformContent : bmcGridContent}
      persistentOverlay={
        <>
          <CanvasTutorialDialog
            open={showTutorial}
            tutorialStep={tutorialStep}
            onClose={handleCloseTutorial}
            onNext={handleNextStep}
          />
          <CCBMCDetailDrawer />
        </>
      }
    />
  )
}

export const ComfyCanvasPage = CanvasPage
