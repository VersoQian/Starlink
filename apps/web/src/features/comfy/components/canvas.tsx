'use client'

import { useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useComfyStore } from '../store'
import { ResourceNode } from './nodes/resource-node'
import { AgentNode } from './nodes/agent-node'
import { ResultNode } from './nodes/result-node'
import { AgentAvatarNode } from './nodes/agent-avatar-node'
import { CCBMCCardNode } from './nodes/cc-bmc-card-node'
import { ConflictAlertNode } from './nodes/conflict-alert-node'
import { InsightNoteNode } from './nodes/insight-note-node'
import { PlanNode } from './nodes/plan-node'
import { CanvasNoteNode } from './nodes/canvas-note-node'
import { CanvasImageNode } from './nodes/canvas-image-node'
import { DataSourceNode } from './nodes/data-source-node'
import { CanvasRegions } from './canvas-regions'
import { CCBMCDetailDrawer } from './cc-bmc-detail-drawer'
import { Button } from '@/shared/components/ui/button'
import { Sparkles, Loader2, AlertTriangle, Wand2, X, ChevronRight, Send, History, FileText, Lightbulb, Zap, TrendingUp } from 'lucide-react'

const nodeTypes = {
  resource: ResourceNode,
  agent: AgentNode,
  result: ResultNode,
  'agent-avatar': AgentAvatarNode,
  'cc-bmc-card': CCBMCCardNode,
  'cc-bmc-customer-segments': CCBMCCardNode,
  'cc-bmc-customer-relationships': CCBMCCardNode,
  'cc-bmc-channels': CCBMCCardNode,
  'cc-bmc-value-propositions': CCBMCCardNode,
  'cc-bmc-revenue-streams': CCBMCCardNode,
  'cc-bmc-key-activities': CCBMCCardNode,
  'cc-bmc-key-resources': CCBMCCardNode,
  'cc-bmc-key-partnerships': CCBMCCardNode,
  'cc-bmc-cost-structure': CCBMCCardNode,
  'conflict-alert': ConflictAlertNode,
  'insight-note': InsightNoteNode,
  'plan-node': PlanNode,
  'data-source': DataSourceNode,
  'canvas-note': CanvasNoteNode,
  'canvas-image': CanvasImageNode
}

// 节点配置 - 新配色方案
const NODE_PALETTE = [
  { type: 'cc-bmc-card', label: '商业卡片', icon: '💎', gradient: 'from-amber-400 to-amber-500', description: '核心业务模型卡片' },
  { type: 'agent-avatar', label: 'AI 顾问', icon: '🤖', gradient: 'from-emerald-400 to-emerald-500', description: '虚拟专家顾问' },
  { type: 'insight-note', label: '洞察便签', icon: '💡', gradient: 'from-blue-400 to-blue-500', description: 'AI 生成的洞察' },
  { type: 'data-source', label: '数据源', icon: '🗂️', gradient: 'from-cyan-400 to-sky-500', description: '研究资料与数据输入' },
  { type: 'resource', label: '资源', icon: '📁', gradient: 'from-slate-400 to-slate-500', description: '文档或数据源' }
]

// 引导步骤
const TUTORIAL_STEPS = [
  {
    title: '欢迎来到智绘画布',
    description: '通过 AI 驱动的可视化画布，让商业想法变成现实。',
    icon: <Sparkles className="w-10 h-10 text-amber-400" />
  },
  {
    title: '描述你的愿景',
    description: '用自然语言描述你的商业想法，AI 将为你构建初始结构。',
    icon: <Wand2 className="w-10 h-10 text-emerald-400" />
  },
  {
    title: '实时协作优化',
    description: '拖拽节点、建立连接，AI 助手会持续提供专业建议。',
    icon: <TrendingUp className="w-10 h-10 text-blue-400" />
  }
]

type ComfyCanvasProps = {
  workspaceId?: string
}

export function ComfyCanvas({ workspaceId = 'comfy-default' }: ComfyCanvasProps) {
    const {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      setNodes,
      callLangGraph,
      isOrchestratorProcessing,
      callCritic,
      isCriticProcessing,
      setWorkspaceId,
      knowledgeEvidence
  } = useComfyStore()

  const [seedInput, setSeedInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(true)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>>([
    {
      role: 'assistant',
      content: '你好！我是你的 AI 商业顾问。描述你的想法，让我们一起将它可视化。',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  ])

  // 首次加载动画
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    setWorkspaceId(workspaceId)
  }, [setWorkspaceId, workspaceId])

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
      await callLangGraph(seedInput, 'seed')

      const assistantMessage = {
        role: 'assistant' as const,
        content: `已为你生成基于"${seedInput}"的初始画布。继续对话来完善它。`,
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
  }, [seedInput, isOrchestratorProcessing, callLangGraph])

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || isOrchestratorProcessing) return

    const userMessage = {
      role: 'user' as const,
      content: chatInput,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, userMessage])

    try {
      await callLangGraph(chatInput, 'general')

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
  }, [chatInput, isOrchestratorProcessing, callLangGraph])

  const handleRunCritic = useCallback(async () => {
    try {
      await callCritic()
      const message = {
        role: 'assistant' as const,
        content: '冲突扫描完成。如发现问题，已在画布上标记。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, message])
    } catch (error) {
      console.error('冲突检测失败:', error)
    }
  }, [callCritic])

  return (
    <>
      {/* Google Fonts Import */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      <style jsx global>{`
        :root {
          --bg-deep: #0c1428;
          --bg-canvas: #1e293b;
          --accent-amber: #fbbf24;
          --accent-emerald: #10b981;
          --accent-coral: #f472b6;
          --neutral-light: #e2e8f0;
          --neutral-mid: #94a3b8;
          --neutral-dark: #334155;
          font-family: 'DM Sans', -apple-system, sans-serif;
        }

        .comfy-canvas-wrapper * {
          font-family: 'DM Sans', -apple-system, sans-serif;
        }

        .title-font {
          font-family: 'Outfit', sans-serif;
        }

        .mono-font {
          font-family: 'JetBrains Mono', monospace;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.1);
          }
          50% {
            box-shadow: 0 0 30px rgba(251, 191, 36, 0.5), 0 0 60px rgba(251, 191, 36, 0.2);
          }
        }

        @keyframes gradient-shift {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 3s ease infinite;
        }

        .glass-effect {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .glow-border {
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.2), inset 0 0 20px rgba(251, 191, 36, 0.05);
        }
      `}</style>

      <div className="h-screen w-screen flex flex-col overflow-hidden comfy-canvas-wrapper" style={{ background: 'linear-gradient(135deg, #0c1428 0%, #1e293b 50%, #0f172a 100%)' }}>
        {/* 顶部导航栏 - 毛玻璃效果 */}
        <header
          className={`flex items-center justify-between px-8 py-4 glass-effect border-b border-white/10 z-20 ${isAnimating ? 'opacity-0' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-center gap-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white title-font tracking-tight">智绘·无限画布</h1>
              <p className="text-xs text-slate-400 mono-font mt-0.5">MACRA Business Intelligence</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-effect border border-white/20 hover:border-amber-400/50 hover:bg-white/10 transition-all text-sm font-semibold text-slate-200 hover:text-white">
              <FileText className="w-4 h-4" />
              导出
            </button>
            <button
              onClick={() => setShowTutorial(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white text-sm font-bold transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-105"
            >
              <Zap className="w-4 h-4" />
              快速入门
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* 左侧节点面板 */}
          <aside
            className={`w-80 flex flex-col glass-effect border-r border-white/10 z-10 ${isAnimating ? 'opacity-0' : 'animate-fade-in-up'}`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="px-6 py-5 border-b border-white/10">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest title-font">节点库</h3>
              <p className="text-xs text-slate-400 mt-1.5">点击添加到画布</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {NODE_PALETTE.map((node) => (
                <button
                  key={node.type}
                  onClick={() => addNode(node.type)}
                  className="w-full group relative overflow-hidden"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl ${node.gradient}`}
                    style={{ background: 'linear-gradient(to right, var(--tw-gradient-stops))' }}
                  />
                  <div className="relative flex items-center gap-4 p-4 rounded-2xl glass-effect border border-white/10 group-hover:border-white/30 transition-all group-hover:transform group-hover:scale-105 group-hover:shadow-xl">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${node.gradient} shadow-lg text-2xl transform group-hover:rotate-12 transition-transform`}>
                      {node.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-white title-font">{node.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{node.description}</p>
                    </div>
                  </div>
                </button>
              ))}

              {knowledgeEvidence?.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">知识库证据</h3>
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                    {knowledgeEvidence?.map((evidence) => (
                      <div key={evidence.docId} className="space-y-1">
                        <p className="text-amber-300 text-[11px] font-semibold truncate">{evidence.docId}</p>
                        <p className="text-slate-400 leading-snug">{evidence.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 space-y-3.5">
              <div className="space-y-2.5">
                <textarea
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="用自然语言描述你的商业想法..."
                  className="w-full h-28 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 placeholder:text-slate-500 text-slate-200 backdrop-blur-sm"
                  disabled={isOrchestratorProcessing}
                />
                <Button
                  onClick={handleSeedGeneration}
                  disabled={!seedInput.trim() || isOrchestratorProcessing}
                  className={`w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold shadow-lg shadow-amber-500/30 rounded-xl py-6 ${isOrchestratorProcessing ? 'animate-pulse-glow' : ''}`}
                >
                  {isOrchestratorProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI 思考中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5 mr-2" />
                      生成画布
                    </>
                  )}
                </Button>
              </div>

              {nodes.length > 3 && (
                <Button
                  onClick={handleRunCritic}
                  disabled={isCriticProcessing}
                  variant="outline"
                  className="w-full border-pink-400/30 bg-pink-400/10 text-pink-300 hover:bg-pink-400/20 hover:border-pink-400/50 rounded-xl py-5"
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
          <main className={`flex-1 relative overflow-hidden ${isAnimating ? 'opacity-0' : 'animate-fade-in-up'}`} style={{ animationDelay: '0.3s' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#fbbf24', strokeWidth: 2.5, opacity: 0.8 }
              }}
              className="comfy-canvas"
              fitView
              fitViewOptions={{
                padding: 0.2,
                includeHiddenNodes: false
              }}
            >
              {/* CC-BMC 区域划分层 */}
              <CanvasRegions />

              <Background
                color="#fbbf24"
                gap={48}
                size={1.2}
                variant={BackgroundVariant.Dots}
                style={{ opacity: 0.15 }}
              />
              <Controls className="glass-effect border border-white/20 shadow-2xl rounded-xl overflow-hidden [&_button]:text-white [&_button]:hover:bg-white/20" />
              <MiniMap
                className="glass-effect border border-white/20 shadow-2xl rounded-xl overflow-hidden"
                nodeColor="#fbbf24"
                maskColor="rgba(12, 20, 40, 0.8)"
                style={{ background: 'rgba(30, 41, 59, 0.5)' }}
              />
            </ReactFlow>

            {/* 底部提示 */}
            <div className="absolute bottom-8 left-8 glass-effect rounded-2xl px-5 py-3 text-xs text-slate-300 border border-white/20 shadow-2xl flex items-center gap-3 glow-border">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              <span className="mono-font">按住 <kbd className="px-2 py-1 bg-white/10 rounded-lg border border-white/20 font-bold text-amber-400 mx-1">Space</kbd> 拖动 · 滚轮缩放</span>
            </div>
          </main>

          {/* 右侧 AI 助手面板 */}
          <aside
            className={`w-96 flex flex-col glass-effect border-l border-white/10 z-10 ${isAnimating ? 'opacity-0' : 'animate-fade-in-up'}`}
            style={{ animationDelay: '0.4s' }}
          >
            <div className="px-6 py-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center border-2 border-white/20 shadow-lg shadow-emerald-500/30">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-white title-font">AI 商业顾问</h3>
                </div>
                <button className="p-2 rounded-xl glass-effect border border-white/10 hover:bg-white/10 transition-colors">
                  <History className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* 对话历史 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'assistant'
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30'
                      : 'glass-effect border border-white/20'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-amber-400 text-xs font-bold mono-font">U</span>
                    )}
                  </div>
                  <div className={`flex flex-col gap-1.5 max-w-[80%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.role === 'assistant'
                        ? 'glass-effect border border-white/10 text-slate-200 rounded-tl-none shadow-xl'
                        : 'bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-tr-none shadow-lg shadow-amber-500/30'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-slate-500 px-2 mono-font">{msg.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 输入框 */}
            <div className="p-5 border-t border-white/10 bg-gradient-to-t from-slate-900/30 to-transparent">
              <div className="relative">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="询问关于你的商业模式..."
                  className="w-full glass-effect border border-white/20 rounded-2xl pl-5 pr-14 py-4 text-sm focus:outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/30 transition-all placeholder-slate-500 text-slate-200 shadow-inner"
                  disabled={isOrchestratorProcessing}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isOrchestratorProcessing}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* 引导弹窗 */}
        {showTutorial && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-fade-in-up">
            <div className="glass-effect border-2 border-white/20 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden glow-border">
              <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 px-8 py-6 flex items-center justify-between animate-gradient">
                <h3 className="text-white font-black text-xl title-font">快速入门</h3>
                <button
                  onClick={handleCloseTutorial}
                  className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 text-center">
                <div className="mb-6 flex justify-center transform hover:scale-110 transition-transform">
                  {TUTORIAL_STEPS[tutorialStep].icon}
                </div>
                <h4 className="text-2xl font-black text-white mb-3 title-font">
                  {TUTORIAL_STEPS[tutorialStep].title}
                </h4>
                <p className="text-slate-300 mb-8 leading-relaxed">
                  {TUTORIAL_STEPS[tutorialStep].description}
                </p>

                <div className="flex items-center justify-center gap-2.5 mb-8">
                  {TUTORIAL_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        idx === tutorialStep ? 'w-10 bg-gradient-to-r from-amber-400 to-emerald-400' : 'w-2 bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleCloseTutorial}
                    className="flex-1 px-6 py-3.5 rounded-xl glass-effect border border-white/20 hover:bg-white/10 transition-all text-slate-200 font-semibold"
                  >
                    跳过
                  </button>
                  <button
                    onClick={handleNextStep}
                    className="flex-1 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-500 hover:to-emerald-500 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
                  >
                    {tutorialStep < TUTORIAL_STEPS.length - 1 ? '下一步' : '开始使用'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CC-BMC 详情抽屉 */}
        <CCBMCDetailDrawer />
      </div>
    </>
  )
}
