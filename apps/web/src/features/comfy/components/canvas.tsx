'use client'

import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useComfyStore } from '../store'
import { ResourceNode } from './nodes/resource-node'
import { AgentNode } from './nodes/agent-node'
import { ResultNode } from './nodes/result-node'
import { CCBMCCardNode } from './nodes/cc-bmc-card-node'
import { AgentAvatarNode } from './nodes/agent-avatar-node'
import { ConflictAlertNode } from './nodes/conflict-alert-node'
import { InsightNoteNode } from './nodes/insight-note-node'
import { Button } from '@/shared/components/ui/button'
import { Play, Plus, Sparkles, Loader2, AlertTriangle, Wand2, X, ChevronRight, Send, History, FileText, Lightbulb } from 'lucide-react'

const nodeTypes = {
  resource: ResourceNode,
  agent: AgentNode,
  result: ResultNode,
  'cc-bmc-card': CCBMCCardNode,
  'agent-avatar': AgentAvatarNode,
  'conflict-alert': ConflictAlertNode,
  'insight-note': InsightNoteNode
}

// 节点配置 (参考参考UI的设计)
const NODE_PALETTE = [
  { type: 'cc-bmc-card', label: '商业卡片', icon: '💎', color: '#8b5cf6', description: '核心业务模型卡片' },
  { type: 'agent-avatar', label: 'AI 顾问', icon: '🤖', color: '#7c3aed', description: '虚拟专家顾问' },
  { type: 'insight-note', label: '洞察便签', icon: '💡', color: '#a78bfa', description: 'AI 生成的洞察' },
  { type: 'resource', label: '资源', icon: '📁', color: '#64748b', description: '文档或数据源' }
]

// 引导步骤
const TUTORIAL_STEPS = [
  {
    title: '欢迎使用智绘·无限商业画布',
    description: '通过 AI 驱动的画布，快速构建和分析商业模型。',
    icon: <Sparkles className="w-8 h-8 text-purple-500" />
  },
  {
    title: '描述你的商业想法',
    description: '在输入框中描述你的想法，AI 将自动生成初始画布结构。',
    icon: <Wand2 className="w-8 h-8 text-purple-500" />
  },
  {
    title: '编辑和扩展节点',
    description: '点击节点编辑内容，拖拽连接线建立关系，AI 会持续提供建议。',
    icon: <Lightbulb className="w-8 h-8 text-purple-500" />
  }
]

export function ComfyCanvas() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    executeWorkflow,
    executingNodeId,
    callOrchestrator,
    isOrchestratorProcessing,
    callCritic,
    isCriticProcessing
  } = useComfyStore()

  const [seedInput, setSeedInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([
    {
      role: 'assistant',
      content: '你好！我是你的商业画布助手。你可以描述你的商业想法，我会帮你生成初始画布结构。',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  ])

  // 首次加载时显示引导
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('comfy_tutorial_seen')
    if (!hasSeenTutorial && nodes.length === 0) {
      setShowTutorial(true)
    }
  }, [nodes.length])

  const handleCloseTutorial = () => {
    setShowTutorial(false)
    localStorage.setItem('comfy_tutorial_seen', 'true')
  }

  const handleNextStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(tutorialStep + 1)
    } else {
      handleCloseTutorial()
    }
  }

  const addNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 300,
        y: Math.random() * 400 + 200
      },
      data: { label: `${type} node` }
    }
    setNodes([...nodes, newNode])
  }, [nodes, setNodes])

  const handleSeedGeneration = useCallback(async () => {
    if (!seedInput.trim() || isOrchestratorProcessing) return

    const userMessage = {
      role: 'user' as const,
      content: seedInput,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, userMessage])

    try {
      await callOrchestrator(seedInput, 'seed')

      const assistantMessage = {
        role: 'assistant' as const,
        content: `已为你生成基于"${seedInput}"的初始画布结构。你可以点击节点进行编辑，或继续提问来完善画布。`,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, assistantMessage])
      setSeedInput('')
    } catch (error) {
      console.error('种子生成失败:', error)
      const errorMessage = {
        role: 'assistant' as const,
        content: '抱歉，AI 生成失败，请稍后再试。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, errorMessage])
    }
  }, [seedInput, isOrchestratorProcessing, callOrchestrator])

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isOrchestratorProcessing) return

    const userMessage = {
      role: 'user' as const,
      content: chatInput,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, userMessage])

    try {
      await callOrchestrator(chatInput, 'general')

      const assistantMessage = {
        role: 'assistant' as const,
        content: '已根据你的问题更新画布。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, assistantMessage])
      setChatInput('')
    } catch (error) {
      console.error('对话失败:', error)
    }
  }, [chatInput, isOrchestratorProcessing, callOrchestrator])

  const handleRunCritic = useCallback(async () => {
    try {
      await callCritic()
      const message = {
        role: 'assistant' as const,
        content: '已完成冲突检测。如果发现冲突，会在画布上标记。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, message])
    } catch (error) {
      console.error('冲突检测失败:', error)
    }
  }, [callCritic])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 text-purple-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">智绘·无限商业画布</h1>
            <p className="text-xs text-slate-500">MACRA 商业分析系统</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-colors text-sm font-medium text-slate-700">
            <FileText className="w-4 h-4" />
            导出
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            查看引导
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧节点调色板 */}
        <aside className="w-72 flex flex-col bg-white border-r border-slate-200 shadow-lg z-10">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">节点调色板</h3>
            <p className="text-xs text-slate-500 mt-1">拖拽到画布或点击添加</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {NODE_PALETTE.map((node) => (
              <button
                key={node.type}
                onClick={() => addNode(node.type)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all group cursor-pointer"
                style={{ borderLeftColor: node.color, borderLeftWidth: 3 }}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 text-2xl group-hover:scale-110 transition-transform">
                  {node.icon}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-800">{node.label}</p>
                  <p className="text-xs text-slate-500">{node.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-200 bg-purple-50/30">
            <div className="space-y-2">
              <textarea
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                placeholder="描述你的商业想法..."
                className="w-full h-24 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-400"
                disabled={isOrchestratorProcessing}
              />
              <Button
                onClick={handleSeedGeneration}
                disabled={!seedInput.trim() || isOrchestratorProcessing}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-md"
              >
                {isOrchestratorProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    AI 生成画布
                  </>
                )}
              </Button>
            </div>

            {nodes.length > 3 && (
              <Button
                onClick={handleRunCritic}
                disabled={isCriticProcessing}
                variant="outline"
                className="w-full mt-3 border-orange-200 text-orange-700 hover:bg-orange-50"
              >
                {isCriticProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    扫描中...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    冲突检测
                  </>
                )}
              </Button>
            )}
          </div>
        </aside>

        {/* 中间画布区域 */}
        <main className="flex-1 relative overflow-hidden bg-white">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#8b5cf6', strokeWidth: 2 }
            }}
            className="comfy-canvas"
            fitView
          >
            <Background
              color="#e9d5ff"
              gap={32}
              size={0.8}
              variant={BackgroundVariant.Dots}
            />
            <Controls className="bg-white/90 border border-slate-200 shadow-lg rounded-lg" />
            <MiniMap
              className="bg-white/90 border border-slate-200 shadow-lg rounded-lg"
              nodeColor="#8b5cf6"
              maskColor="rgba(139, 92, 246, 0.1)"
            />
          </ReactFlow>

          {/* 底部提示 */}
          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur rounded-lg px-4 py-2 text-xs text-slate-500 border border-slate-200 shadow-md flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            <span>按住 <kbd className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono text-slate-700">Space</kbd> 拖动画布 · 滚轮缩放</span>
          </div>
        </main>

        {/* 右侧 AI 助手面板 */}
        <aside className="w-80 flex flex-col bg-white border-l border-slate-200 shadow-lg z-10">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center border border-purple-200">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">星链助手</h3>
            </div>
            <button className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
              <History className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* 对话历史 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-purple-50/20">
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'assistant'
                    ? 'bg-gradient-to-br from-purple-100 to-purple-200 border border-purple-200'
                    : 'bg-slate-200'
                }`}>
                  {msg.role === 'assistant' ? (
                    <Sparkles className="w-4 h-4 text-purple-600" />
                  ) : (
                    <span className="text-slate-600 text-xs font-bold">U</span>
                  )}
                </div>
                <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`p-3 rounded-2xl text-sm ${
                    msg.role === 'assistant'
                      ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                      : 'bg-purple-600 text-white rounded-tr-none shadow-md'
                  }`}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400 px-1">{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 输入框 */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="relative">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="询问关于画布或商业模式的问题..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder-slate-400 shadow-inner"
                disabled={isOrchestratorProcessing}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isOrchestratorProcessing}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 hover:border-purple-300 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-purple-600" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 引导动画弹窗 */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">快速入门引导</h3>
              <button
                onClick={handleCloseTutorial}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 text-center">
              <div className="mb-4 flex justify-center">
                {TUTORIAL_STEPS[tutorialStep].icon}
              </div>
              <h4 className="text-xl font-bold text-slate-800 mb-2">
                {TUTORIAL_STEPS[tutorialStep].title}
              </h4>
              <p className="text-slate-600 mb-6">
                {TUTORIAL_STEPS[tutorialStep].description}
              </p>

              <div className="flex items-center justify-center gap-2 mb-6">
                {TUTORIAL_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all ${
                      idx === tutorialStep ? 'w-8 bg-purple-600' : 'w-2 bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseTutorial}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                >
                  跳过
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  {tutorialStep < TUTORIAL_STEPS.length - 1 ? '下一步' : '开始使用'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
