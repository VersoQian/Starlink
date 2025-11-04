import type { CanvasEdge, CanvasGraph, CanvasNode } from '@branching-chat/shared'
import type { AgentContext, CanvasExecutionState, GraphDelta } from './types.js'

const ROOT_OFFSET = { x: 160, y: 160 }

export function buildInitialState(ctx: AgentContext): CanvasExecutionState {
  const rootNode: CanvasNode = {
    id: createNodeId('root'),
    type: 'note',
    position: { x: ROOT_OFFSET.x, y: ROOT_OFFSET.y },
    data: {
      type: 'note',
      title: '多维画布任务',
      subtitle: 'Branching Canvas 起点',
      content: `当前议题：「${ctx.question}」。我们会一起梳理目标、关键维度与行动方案。`,
      footerText: '对话即画布 · 节点会随着推理逐步出现',
      variant: 'primary'
    }
  }

  const graph: CanvasGraph = {
    workspaceId: ctx.workspaceId,
    nodes: [rootNode],
    edges: []
  }

  const deltas: GraphDelta[] = [{ nodes: [rootNode] }]

  return {
    context: ctx,
    graph,
    deltas
  }
}

export function pushNode(state: CanvasExecutionState, node: CanvasNode, edge?: CanvasEdge) {
  state.graph.nodes.push(node)
  if (edge) {
    state.graph.edges.push(edge)
  }
  state.deltas.push({ nodes: [node], edges: edge ? [edge] : undefined })
}

export function pushNodes(state: CanvasExecutionState, nodes: CanvasNode[], edges: CanvasEdge[]) {
  state.graph.nodes.push(...nodes)
  state.graph.edges.push(...edges)
  state.deltas.push({ nodes, edges })
}

export function createNodeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
