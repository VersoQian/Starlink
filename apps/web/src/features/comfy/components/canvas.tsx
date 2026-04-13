'use client'

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { CanvasRegions } from './canvas-regions'
import { comfyNodeTypes } from './canvas-config'
import type { Edge, Node } from 'reactflow'
import type { NodeChange, EdgeChange, Connection } from 'reactflow'
import { Lightbulb } from 'lucide-react'

type CanvasFlowProps = {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  isAnimating: boolean
}

export function CanvasFlow({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isAnimating,
}: CanvasFlowProps) {
  return (
    <main
      className={`flex-1 relative overflow-hidden ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.3s' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={comfyNodeTypes}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#fbbf24', strokeWidth: 2.5, opacity: 0.8 },
        }}
        className="canvas-flow-surface"
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
        }}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
      >
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

      <div className="absolute bottom-8 left-8 glass-effect rounded-2xl px-5 py-3 text-xs text-slate-300 border border-white/20 shadow-2xl flex items-center gap-3 glow-border">
        <Lightbulb className="w-5 h-5 text-amber-400" />
        <span className="mono-font">
          按住 <kbd className="px-2 py-1 bg-white/10 rounded-lg border border-white/20 font-bold text-amber-400 mx-1">Space</kbd>
          拖动 · 滚轮缩放
        </span>
      </div>
    </main>
  )
}

export const ComfyCanvasFlow = CanvasFlow
