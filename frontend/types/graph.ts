export type CanvasNodeType = 'note' | 'document' | 'task' | 'reference' | 'image' | 'web'

export type CanvasNodeData =
  | {
      type: 'note'
      title: string
      content: string
      subtitle?: string
      bullets?: string[]
      variant?: 'primary' | 'list' | 'insight' | 'timeline-step' | 'timeline-dimension' | 'timeline-action'
      footerText?: string
      category?: string
      subCategory?: string
      status?: string
      meta?: Record<string, unknown>
    }
  | {
      type: 'document'
      title: string
      summary: string
      references: number
      points?: string[]
    }
  | {
      type: 'task'
      title: string
      assignee?: string
      dueDate?: string
      status: 'todo' | 'in-progress' | 'done'
    }
  | {
      type: 'reference'
      title: string
      source: string
      location: string
    }
  | {
      type: 'image'
      title: string
      url: string
    }
  | {
      type: 'web'
      title: string
      url: string
      description?: string
    }

export type CanvasNode = {
  id: string
  type: CanvasNodeType
  position: { x: number; y: number }
  data: CanvasNodeData
}

export type CanvasEdge = {
  id: string
  source: string
  target: string
  label?: string
}

export type WorkspaceGraphResponse = {
  workspaceId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}
