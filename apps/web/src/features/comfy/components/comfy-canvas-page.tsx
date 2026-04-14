'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Node } from 'reactflow'
import { useComfyStore } from '../store'
import { CCBMCDetailDrawer } from './cc-bmc-detail-drawer'
import { CanvasChatPanel } from './canvas-chat-panel'
import { CanvasHeader } from './canvas-header'
import { CanvasSidebar } from './canvas-sidebar'
import { CanvasFlow } from './canvas'
import { CanvasTutorialDialog } from './canvas-tutorial-dialog'
import { useConversationRuntime } from '@/features/workspace/hooks'
import { BmcGrid } from '@/features/macra/components/BmcGrid'
import type { MacraNodeData } from '@/types/macra'
import { AlertTriangle, Check, LayoutGrid, MessageCircle, PanelsTopLeft, X } from 'lucide-react'

type CanvasPageProps = {
  workspaceId?: string
}

const CANVAS_TUTORIAL_STORAGE_KEY = 'canvas_tutorial_seen'
const LEGACY_TUTORIAL_STORAGE_KEY = 'comfy_tutorial_seen'

export function CanvasPage({
  workspaceId = 'canvas-default',
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
  const isCriticProcessing = useComfyStore((state) => state.isCriticProcessing)
  const setWorkspaceId = useComfyStore((state) => state.setWorkspaceId)
  const knowledgeEvidence = useComfyStore((state) => state.knowledgeEvidence)
  const appendChatMessage = useComfyStore((state) => state.appendChatMessage)
  const setChatInput = useComfyStore((state) => state.setChatInput)
  const approveDecision = useComfyStore((state) => state.approveDecision)
  const macraNodes = useComfyStore((state) => state.macraNodes)
  const openDetailPanel = useComfyStore((state) => state.openDetailPanel)

  const runtime = useConversationRuntime(workspaceId)
  const [viewMode, setViewMode] = useState<'freeform' | 'bmc'>('freeform')

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

  return (
    <>
      <div
        className="canvas-page-shell h-screen w-screen flex flex-col overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #0c1428 0%, #1e293b 50%, #0f172a 100%)',
        }}
      >
        <CanvasHeader
          isAnimating={isAnimating}
          onOpenTutorial={() => setShowTutorial(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <div className="flex flex-1 overflow-hidden">
          <CanvasSidebar
            isAnimating={isAnimating}
            seedInput={seedInput}
            onSeedInputChange={setSeedInput}
            onAddNode={addNode}
            onSeedGeneration={handleSeedGeneration}
            onRunCritic={handleRunCritic}
            isOrchestratorProcessing={isOrchestratorProcessing}
            isCriticProcessing={isCriticProcessing}
            nodeCount={nodes.length}
            knowledgeEvidence={knowledgeEvidence}
          />

          {viewMode === 'freeform' ? (
            <CanvasFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isAnimating={isAnimating}
            />
          ) : (
            <main
              className={`relative flex-1 overflow-hidden ${
                isAnimating ? 'opacity-0' : 'animate-fade-in-up'
              }`}
              style={{ animationDelay: '0.3s' }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute left-12 top-12 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute bottom-10 right-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              </div>
              <div className="relative flex h-full flex-col px-6 pb-6 pt-5">
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-cyan-300">
                      <LayoutGrid className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-[0.24em]">Structured Business Model</span>
                    </div>
                    <h2 className="text-lg font-black text-white title-font">CC-BMC 结构化输出视图</h2>
                    <p className="text-xs text-slate-400">
                      用于答辩演示、结构化审阅和维度冲突检查。自由画布负责推演，九宫格负责归档表达。
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-center">
                      <div className="text-xl font-black text-white">{structuredNodes.length}</div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">BMC Nodes</div>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center">
                      <div className="text-xl font-black text-white">{conflictAlertCount}</div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200">Conflict Alerts</div>
                    </div>
                  </div>
                </div>

                <div className="relative min-h-0 flex-1 rounded-[28px] border border-white/10 bg-slate-950/70 backdrop-blur-xl">
                  {structuredNodes.length > 0 ? (
                    <BmcGrid
                      nodes={structuredNodes}
                      conflicts={[]}
                      onNodeClick={(node) => openDetailPanel(node.id)}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                        <PanelsTopLeft className="h-7 w-7 text-cyan-300" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-base font-bold text-white">还没有可展示的 BMC 结构节点</h3>
                        <p className="max-w-md text-sm text-slate-400">
                          先在自由画布中运行多智能体分析或补充业务节点，系统会把带有商业维度的结果自动归入九宫格视图。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </main>
          )}

          {/* HITL 决策弹窗 */}
          {pendingDecisionRequest && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="w-[28rem] rounded-3xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Critic 发现高严重度冲突</h3>
                    <p className="text-xs text-slate-400">需要你的决策来继续研讨</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {pendingDecisionRequest.payload.decision}
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  <button
                    onClick={async () => {
                      await approveDecision(pendingDecisionRequest.conversationId, 'auto_revise')
                      appendChatMessage({ role: 'assistant', content: '已指示 Agent 自行修正冲突。' })
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                  >
                    <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">让 Agent 自行修正</p>
                      <p className="text-xs text-slate-400">Supervisor 将分派相关 Agent 进行修正</p>
                    </div>
                  </button>

                  <div className="flex gap-2">
                    <input
                      value={hitlInput}
                      onChange={(e) => setHitlInput(e.target.value)}
                      placeholder="输入你的修正方向..."
                      className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-400/50 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                    <button
                      onClick={async () => {
                        if (!hitlInput.trim()) return
                        await approveDecision(pendingDecisionRequest.conversationId, hitlInput.trim())
                        appendChatMessage({ role: 'assistant', content: `已将你的指导 "${hitlInput.trim()}" 传达给 Agent。` })
                        setHitlInput('')
                      }}
                      disabled={!hitlInput.trim()}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 hover:from-amber-500 hover:to-amber-600"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      await approveDecision(pendingDecisionRequest.conversationId, 'accept_current')
                      appendChatMessage({ role: 'assistant', content: '已接受当前分析结果。' })
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
                  >
                    <X className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">接受当前结果</p>
                      <p className="text-xs text-slate-400">跳过修正，使用当前分析</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <CanvasChatPanel
            workspaceId={workspaceId}
            isAnimating={isAnimating}
            onSendChat={handleSendChat}
          />
        </div>

        <CanvasTutorialDialog
          open={showTutorial}
          tutorialStep={tutorialStep}
          onClose={handleCloseTutorial}
          onNext={handleNextStep}
        />

        <CCBMCDetailDrawer />
      </div>
    </>
  )
}

export const ComfyCanvasPage = CanvasPage
