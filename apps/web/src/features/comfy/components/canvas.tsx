'use client'

/**
 * CanvasFlow — ReactFlow surface with Editorial Boardroom v2 visual
 * polish (2026-05-02).
 *
 * What's tuned vs the v1 amber-glow version:
 *  - Edges: ash-3 1.5 px static (no amber yellow + no pulse animation)
 *  - Background: 3 layers — ink solid + paper-grain noise (multiply
 *    blend) + 24 px ash dot grid (was 48 px amber dots)
 *  - Controls: brutalist 1.5 px paper border on ink-ash1; no glass
 *  - MiniMap: same brutalist edge; ink-ash2 mask, paper node tint
 *  - Bottom hint: editorial mono kicker; no glow card
 *  - Snap-to-grid: 8 px on x+y, so nodes align to the dot grid
 *
 * All functional code (selection, undo/redo, multi-select, delete) is
 * preserved verbatim.
 */

import { useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type OnSelectionChangeParams
} from 'reactflow'
import 'reactflow/dist/style.css'
import { CanvasRegions } from './canvas-regions'
import { comfyNodeTypes } from './canvas-config'
import type { Edge, Node } from 'reactflow'
import type { NodeChange, EdgeChange, Connection } from 'reactflow'
import { useComfyStore } from '../store/comfy-store'

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
  const setSelectedNodeIds = useComfyStore((s) => s.setSelectedNodeIds)
  const undo = useComfyStore((s) => s.undo)
  const redo = useComfyStore((s) => s.redo)

  const handleSelectionChange = (params: OnSelectionChangeParams): void => {
    setSelectedNodeIds(params.nodes.map((n) => n.id))
  }

  // cmd+z / ctrl+z to undo, cmd+shift+z / ctrl+shift+z (or cmd+y) to redo.
  // Skip when focus is in a text input/textarea so chat typing isn't hijacked.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      const meta = e.metaKey || e.ctrlKey
      if (!meta) return
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])
  return (
    <main
      className={`flex-1 relative overflow-hidden bg-ink ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.3s' }}
    >
      {/* Layer 1 — paper-grain noise (multiply on ink). Pinned to
          viewport so zooming the canvas doesn't blur the texture. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 pointer-events-none bg-grain-ink"
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        nodeTypes={comfyNodeTypes}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        // Multi-select: shift-click for additive selection, drag-rectangle
        // for box select. Backspace/Delete fire `remove` changes through
        // onNodesChange — the store cascades to macraNodes + edges.
        multiSelectionKeyCode={['Shift', 'Meta']}
        deleteKeyCode={['Backspace', 'Delete']}
        // Snap to the 8 px ash dot grid so nodes align to the editorial
        // baseline. Avoids the "pixel-jitter" feel after multi-drag.
        snapToGrid
        snapGrid={[8, 8]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#4A4744',     // ink-ash3 — visible on dark, no amber
            strokeWidth: 1.5,
          },
          labelStyle: {
            fontFamily: 'var(--font-jetbrains-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fill: '#8A8784',       // ink-ash4
          },
          labelBgStyle: { fill: '#161514' },              // ink-ash1
          labelBgPadding: [6, 4],
          labelBgBorderRadius: 0,                         // brutalist
        }}
        className="canvas-flow-surface relative z-[1]"
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
        }}
        minZoom={0.1}
        maxZoom={2}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
      >
        <CanvasRegions />
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(74, 71, 68, 0.22)"   // ink-ash3 at 22%
          style={{ background: 'transparent' }}
        />
        <Controls
          className="!shadow-none !border-[1.5px] !border-paper/30 !bg-ink-ash1 !rounded-none [&_button]:!bg-transparent [&_button]:!border-0 [&_button]:!text-paper-ash3 [&_button:hover]:!text-paper [&_button:hover]:!bg-ink-ash2/40"
          showInteractive={false}
        />
        <MiniMap
          className="!shadow-none !border-[1.5px] !border-paper/30 !rounded-none"
          nodeColor="#8A8784"            // ink-ash4 nodes
          nodeStrokeColor="#161514"      // ink-ash1 outline
          nodeStrokeWidth={2}
          maskColor="rgba(10, 10, 10, 0.7)"  // ink at 70%
          style={{ background: '#161514' }}  // ink-ash1
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Bottom-left keyboard hint — editorial mono kicker, brutalist edge */}
      <div className="absolute bottom-6 left-6 z-[2] flex items-center gap-3 bg-ink-ash1 border-[1px] border-paper/20 px-3 py-1.5 pointer-events-none">
        <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
          按住 <kbd className="font-instr text-[10px] text-paper bg-ink-ash2/60 border-[0.5px] border-paper/30 px-1 py-0.5 mx-1">SPACE</kbd> 拖动 · 滚轮缩放 · ⌘<kbd className="font-instr text-[10px] text-paper bg-ink-ash2/60 border-[0.5px] border-paper/30 px-1 py-0.5 mx-1">Z</kbd>撤销
        </span>
      </div>
    </main>
  )
}

export const ComfyCanvasFlow = CanvasFlow
