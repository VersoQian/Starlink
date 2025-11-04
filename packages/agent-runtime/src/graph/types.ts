import type { CanvasGraph, CanvasNode, CanvasEdge } from '@branching-chat/shared'

export type AgentContext = {
  workspaceId: string
  userId: string
  question: string
  signal?: AbortSignal
}

export type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

export type CanvasExecutionResult = {
  graph: CanvasGraph
  deltas: GraphDelta[]
}

export type CanvasExecutionState = {
  context: AgentContext
  graph: CanvasGraph
  deltas: GraphDelta[]
}
