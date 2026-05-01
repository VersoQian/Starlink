'use client'

/**
 * BoardroomCanvas — full-viewport React Flow host with Editorial
 * Boardroom v2 styling.
 *
 * Strategy:
 *   - ReactFlow does the heavy lifting (pan, zoom, drag, multi-select,
 *     keyboard delete, marquee). We do NOT wrap or replace its event
 *     model; we just style it.
 *   - The canvas surface is the ink-grain background (CanvasBg). Edges
 *     and nodes render on top.
 *   - Two custom node types: `bmcCell` and `agentAvatar`.
 *   - Edges are styled via CSS variables on the React Flow root —
 *     stroke = ash-2, marker = small triangle, no animation.
 *   - The MiniMap and Controls are intentionally omitted in P2 — they
 *     belong to the v1 comfy aesthetic (gradient + glow); P3 will add
 *     v2-styled equivalents if needed.
 */

import { useCallback } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { CanvasBg } from './canvas-bg'
import { BmcCellNode } from './nodes/bmc-cell-node'
import { AgentAvatarNode } from './nodes/agent-avatar-node'

const NODE_TYPES = {
  bmcCell:     BmcCellNode,
  agentAvatar: AgentAvatarNode,
}

// Edge default style — 1.5 px ash-2, paper-tinted label box. The label
// uses our mono font + kicker tracking so connections read like
// editorial captions ("served by", "enables") rather than Visio arrows.
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep' as const,
  animated: false,
  style: {
    stroke: '#4A4744',  // ink-ash3 — visible on dark background
    strokeWidth: 1.5,
  },
  labelStyle: {
    fontFamily: 'var(--font-jetbrains-mono)',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase' as const,
    fill: '#8A8784', // ink-ash4
  },
  labelBgStyle: {
    fill: '#161514', // ink-ash1
  },
  labelBgPadding: [6, 4] as [number, number],
  labelBgBorderRadius: 0, // brutalist — no rounded label pill
}

interface BoardroomCanvasProps {
  /** Initial nodes (BMC cells + agent avatars). */
  initialNodes: Node[]
  /** Initial edges. */
  initialEdges: Edge[]
}

export function BoardroomCanvas({ initialNodes, initialEdges }: BoardroomCanvasProps) {
  // Local state — kept simple in P2 (no global store). P3 will lift to
  // Zustand if cross-component reads need it (e.g. selection sync with
  // Wire / Stacks).
  const [nodes, setNodes] = useNodesState(initialNodes)
  const [edges, setEdges] = useEdgesState(initialEdges)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [setNodes],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges],
  )

  return (
    <CanvasBg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        nodesDraggable
        nodesConnectable={false}  // P2 read-only; P3 enables connect
        elementsSelectable
        multiSelectionKeyCode={['Shift', 'Meta']}
        deleteKeyCode={null}      // P2 disable delete; P3 wires it
        minZoom={0.2}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.18, includeHiddenNodes: false }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Subtle dot pattern from React Flow's own Background — set to
            ash-3 at low alpha so it overlays well with our outer dot
            grid. The CanvasBg dot grid is FIXED to viewport; this one
            PANS with the canvas, giving a "pinned cells on infinite
            graph paper" feel. */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={48}
          size={1}
          color="rgba(74, 71, 68, 0.22)"
          style={{ background: 'transparent' }}
        />
      </ReactFlow>
    </CanvasBg>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Tiny inline state hooks — avoids depending on @reactflow/core internals
// and lets us swap to Zustand later without touching call sites.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react'

function useNodesState<T>(initial: Node<T>[]): [Node<T>[], (updater: (n: Node<T>[]) => Node<T>[]) => void] {
  const [state, setState] = useState<Node<T>[]>(initial)
  const setter = useCallback((updater: (n: Node<T>[]) => Node<T>[]) => {
    setState((prev) => updater(prev))
  }, [])
  return [state, setter]
}

function useEdgesState(initial: Edge[]): [Edge[], (updater: (e: Edge[]) => Edge[]) => void] {
  const [state, setState] = useState<Edge[]>(initial)
  const setter = useCallback((updater: (e: Edge[]) => Edge[]) => {
    setState((prev) => updater(prev))
  }, [])
  return [state, setter]
}
