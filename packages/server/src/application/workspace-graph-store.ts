import type { CanvasGraph } from '@starlink/shared'
import type { ConversationRuntimeRepository } from './conversation-runtime-repository.js'
import { loadPersistedGraph, persistCanvasGraph } from './canvas-persistence.js'

export class WorkspaceGraphStore {
  constructor(private readonly runtimeRepository: ConversationRuntimeRepository) {}

  getWorkspaceGraph(workspaceId: string) {
    return this.runtimeRepository.getWorkspaceGraph(workspaceId)
  }

  setWorkspaceGraph(workspaceId: string, graph: CanvasGraph) {
    return this.runtimeRepository.setWorkspaceGraph(workspaceId, graph)
  }

  loadPersistedGraph(workspaceId: string) {
    return loadPersistedGraph(workspaceId)
  }

  async persistGraph(graph: CanvasGraph) {
    try {
      await persistCanvasGraph(graph)
    } catch (error) {
      console.error('Failed to persist canvas graph', error)
    }
  }
}
