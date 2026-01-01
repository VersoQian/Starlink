'use client'

import { useCallback, useState } from 'react'
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
import { Play, Plus, Sparkles, Loader2, AlertTriangle, Wand2 } from 'lucide-react'

const nodeTypes = {
  resource: ResourceNode,
  agent: AgentNode,
  result: ResultNode,
  'cc-bmc-card': CCBMCCardNode,
  'agent-avatar': AgentAvatarNode,
  'conflict-alert': ConflictAlertNode,
  'insight-note': InsightNoteNode
}

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
  const [showSeedInput, setShowSeedInput] = useState(false)

  const addNode = useCallback((type: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100
      },
      data: { label: `${type} node` }
    }
    setNodes([...nodes, newNode])
  }, [nodes, setNodes])

  const handleSeedGeneration = useCallback(async () => {
    if (!seedInput.trim() || isOrchestratorProcessing) return

    try {
      await callOrchestrator(seedInput, 'seed')
      setSeedInput('')
      setShowSeedInput(false)
    } catch (error) {
      console.error('种子生成失败:', error)
      alert('AI 生成失败，请稍后再试')
    }
  }, [seedInput, isOrchestratorProcessing, callOrchestrator])

  const handleRunCritic = useCallback(async () => {
    try {
      await callCritic()
    } catch (error) {
      console.error('冲突检测失败:', error)
    }
  }, [callCritic])

  return (
    <div className="h-screen w-screen relative bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#94a3b8', strokeWidth: 2 }
        }}
        className="comfy-canvas"
        fitView
      >
        <Background
          color="#d1d5db"
          gap={24}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls className="bg-white/90 border border-gray-200 shadow-lg" />
        <MiniMap
          className="bg-white/90 border border-gray-200 shadow-lg"
          nodeColor="#3b82f6"
          maskColor="rgba(0, 0, 0, 0.05)"
        />
      </ReactFlow>

      {/* 现代化工具栏 */}
      <div className="absolute top-6 left-6 z-10 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* 标题栏 */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            智能画布
          </h3>
          <p className="text-xs text-gray-500 mt-1">MACRA 商业分析系统</p>
        </div>

        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* AI 种子生成 */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSeedInput(!showSeedInput)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition shadow-md"
            >
              <span className="flex items-center gap-2 font-medium">
                <Wand2 className="w-4 h-4" />
                AI 生成画布
              </span>
              <span className="text-sm">{showSeedInput ? '▲' : '▼'}</span>
            </button>

            {showSeedInput && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <textarea
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="描述你的商业想法..."
                  className="w-full h-24 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                  disabled={isOrchestratorProcessing}
                />
                <Button
                  onClick={handleSeedGeneration}
                  disabled={!seedInput.trim() || isOrchestratorProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  size="sm"
                >
                  {isOrchestratorProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      开始生成
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* 冲突检测 */}
          {nodes.length > 3 && (
            <Button
              onClick={handleRunCritic}
              disabled={isCriticProcessing}
              variant="outline"
              size="sm"
              className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
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

          {/* 分隔线 */}
          <div className="border-t border-gray-200" />

          {/* 节点类型 */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">添加节点</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => addNode('cc-bmc-card')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition text-center group"
              >
                <span className="text-2xl">💎</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700">商业卡片</span>
              </button>

              <button
                onClick={() => addNode('agent-avatar')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition text-center group"
              >
                <span className="text-2xl">🤖</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-purple-700">AI 顾问</span>
              </button>

              <button
                onClick={() => addNode('insight-note')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition text-center group"
              >
                <span className="text-2xl">💡</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-amber-700">洞察便签</span>
              </button>

              <button
                onClick={() => addNode('resource')}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition text-center group"
              >
                <span className="text-2xl">📁</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">资源</span>
              </button>
            </div>
          </div>

          {/* 传统工作流 */}
          <Button
            onClick={executeWorkflow}
            disabled={!!executingNodeId}
            className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm"
            size="sm"
          >
            <Play className="w-4 h-4 mr-2" />
            {executingNodeId ? '执行中...' : '运行工作流'}
          </Button>
        </div>
      </div>
    </div>
  )
}
