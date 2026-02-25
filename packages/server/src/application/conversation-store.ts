import { PubSub } from 'graphql-subscriptions'
import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ConversationEvent,
  ConversationMetadata,
  KnowledgeEvidence
} from '@starlink/shared'
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@starlink/shared'
import { BusinessLangGraphService, type BusinessStreamUpdate, type GraphDelta } from '../services/business-langgraph.js'
import { loadPersistedGraph, persistCanvasGraph } from './canvas-persistence.js'
export type ConversationStoreDeps = {
  pubSub: PubSub
}

type ConversationRecord = {
  metadata: ConversationMetadata
  graph: CanvasGraph
  knowledgeEvidence: KnowledgeEvidence[]
}

const EVENT_TOPIC = 'conversation-progress'
const businessLangGraphService = new BusinessLangGraphService()

export class ConversationStore {
  private readonly conversations = new Map<string, ConversationRecord>()
  private readonly workspaceGraphs = new Map<string, CanvasGraph>()
  private readonly pubSub: PubSub

  constructor({ pubSub }: ConversationStoreDeps) {
    this.pubSub = pubSub
  }

  async startConversation(
    workspaceId: string,
    userId: string,
    question: string
  ): Promise<ConversationRecord> {
    const id = nanoid()
    const startedAt = new Date()
    const metadata: ConversationMetadata = {
      id,
      createdAt: startedAt,
      updatedAt: startedAt,
      status: 'running',
      latestQuestion: question
    }

    const record: ConversationRecord = {
      metadata,
      graph: {
        workspaceId,
        nodes: [],
        edges: []
      },
      knowledgeEvidence: []
    }

    this.conversations.set(id, record)
    this.workspaceGraphs.set(workspaceId, record.graph)

    const stream = businessLangGraphService.streamConversation({ workspaceId, userId, question })
    let initialized = false

    try {
      const initResult = await stream.next()
      if (!initResult.done && initResult.value?.type === 'init') {
        initialized = true
        const currentGraph = initResult.value.graph
        record.graph = currentGraph
        this.workspaceGraphs.set(workspaceId, currentGraph)
        await this.persistGraphState(currentGraph)
        const baseEvent: ConversationEvent = {
          type: 'graph/appended',
          conversationId: id,
          payload: currentGraph
        }
        await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: baseEvent })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedEvent: ConversationEvent = {
        type: 'status',
        conversationId: id,
        status: 'failed',
        message
      }
      await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: failedEvent })
      record.metadata = {
        ...record.metadata,
        status: 'failed',
        updatedAt: new Date()
      }
      return record
    }

    setTimeout(() => {
      void this.runConversationStream({
        stream,
        record,
        workspaceId,
        conversationId: id,
        initialized
      })
    }, 0)

    return record
  }

  getConversation(id: string): ConversationRecord | null {
    const record = this.conversations.get(id)
    if (!record) return null
    const metadata = conversationMetadataSchema.parse(record.metadata)
    return {
      ...record,
      metadata
    }
  }

  async getGraph(workspaceId: string): Promise<CanvasGraph> {
    const manualGraph = this.workspaceGraphs.get(workspaceId)
    if (manualGraph) {
      return {
        workspaceId: manualGraph.workspaceId,
        nodes: [...manualGraph.nodes],
        edges: [...manualGraph.edges]
      }
    }

    const existing = [...this.conversations.values()].find((conv) => conv.graph.workspaceId === workspaceId)
    if (existing) {
      this.workspaceGraphs.set(workspaceId, existing.graph)
      return {
        workspaceId,
        nodes: [...existing.graph.nodes],
        edges: [...existing.graph.edges]
      }
    }

    const persistedGraph = await loadPersistedGraph(workspaceId)
    if (persistedGraph) {
      this.workspaceGraphs.set(workspaceId, persistedGraph)
      return {
        workspaceId,
        nodes: [...persistedGraph.nodes],
        edges: [...persistedGraph.edges]
      }
    }

    const emptyGraph: CanvasGraph = {
      workspaceId,
      nodes: [],
      edges: []
    }
    this.workspaceGraphs.set(workspaceId, emptyGraph)
    return emptyGraph
  }

  async addNode(
    workspaceId: string,
    input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
  ): Promise<CanvasNode> {
    const id = input.id ?? nanoid()
    const parsed = canvasNodeSchema.parse({
      id,
      type: input.type,
      position: input.position,
      data: input.data
    })

    const baseGraph = await this.getGraph(workspaceId)

    const updatedNodes = [...baseGraph.nodes.filter((node) => node.id !== parsed.id), parsed]
    const updatedGraph: CanvasGraph = {
      workspaceId,
      nodes: updatedNodes,
      edges: baseGraph.edges
    }

    this.workspaceGraphs.set(workspaceId, updatedGraph)
    await this.persistGraphState(updatedGraph)

    // Also update any conversation record referencing this workspace
    for (const record of this.conversations.values()) {
      if (record.graph.workspaceId === workspaceId) {
        record.graph = {
          ...record.graph,
          nodes: updatedNodes
        }
      }
    }

    return parsed
  }

  async connectNodes(
    workspaceId: string,
    input: { id?: string; source: string; target: string; label?: string | null }
  ): Promise<CanvasEdge> {
    const id = input.id ?? nanoid()
    const parsed = canvasEdgeSchema.parse({
      id,
      source: input.source,
      target: input.target,
      label: input.label ?? null
    })

    const baseGraph = await this.getGraph(workspaceId)
    const updatedEdges = [...baseGraph.edges.filter((edge) => edge.id !== parsed.id), parsed]
    const updatedGraph: CanvasGraph = {
      workspaceId,
      nodes: baseGraph.nodes,
      edges: updatedEdges
    }

    this.workspaceGraphs.set(workspaceId, updatedGraph)
    await this.persistGraphState(updatedGraph)

    for (const record of this.conversations.values()) {
      if (record.graph.workspaceId === workspaceId) {
        record.graph = {
          ...record.graph,
          edges: updatedEdges
        }
      }
    }

    return parsed
  }

  private async persistGraphState(graph: CanvasGraph) {
    try {
      await persistCanvasGraph(graph)
    } catch (error) {
      console.error('Failed to persist canvas graph', error)
    }
  }

  getEventIterator() {
    return this.pubSub.asyncIterableIterator<{ conversationProgress: ConversationEvent }>(EVENT_TOPIC)
  }

  private async runConversationStream(options: {
    stream: AsyncGenerator<BusinessStreamUpdate>
    record: ConversationRecord
    workspaceId: string
    conversationId: string
    initialized: boolean
  }) {
    console.log('🎬 [runConversationStream] Starting background stream processing...')
    let { stream, record, workspaceId, conversationId, initialized } = options
    let currentGraph = record.graph

    try {
      console.log('🔄 [runConversationStream] Iterating stream updates...')
      for await (const update of stream) {
        if (update.type === 'init') {
          currentGraph = update.graph
          record.graph = currentGraph
          this.workspaceGraphs.set(workspaceId, currentGraph)
          await this.persistGraphState(currentGraph)
          record.knowledgeEvidence = update.knowledgeEvidence ?? []
          if (!initialized) {
            initialized = true
            const appendedEvent: ConversationEvent = {
              type: 'graph/appended',
              conversationId,
              payload: currentGraph
            }
            await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: appendedEvent })
          }
          continue
        }

        if (update.type === 'delta') {
          currentGraph = applyGraphDelta(currentGraph, update.delta)
          record.graph = currentGraph
          this.workspaceGraphs.set(workspaceId, currentGraph)
          await this.persistGraphState(currentGraph)

          const event: ConversationEvent = initialized
            ? {
                type: 'graph/diff',
                conversationId,
                payload: { nodes: update.delta.nodes, edges: update.delta.edges }
              }
            : {
                type: 'graph/appended',
                conversationId,
                payload: currentGraph
              }

          await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: event })
          initialized = true
          continue
        }

        if (update.type === 'status') {
          continue
        }
      }

      const completeEvent: ConversationEvent = {
        type: 'status',
        conversationId,
        status: 'completed'
      }
      await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: completeEvent })

      record.metadata = {
        ...record.metadata,
        status: 'completed',
        updatedAt: new Date()
      }
      console.log('✅ [runConversationStream] Stream completed successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const stack = error instanceof Error ? error.stack : undefined
      console.error('❌ [runConversationStream] Stream failed:', message)
      if (stack) {
        console.error('Stack trace:', stack)
      }
      const failedEvent: ConversationEvent = {
        type: 'status',
        conversationId,
        status: 'failed',
        message
      }
      await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: failedEvent })

      record.metadata = {
        ...record.metadata,
        status: 'failed',
        updatedAt: new Date()
      }
    }
  }
}

function applyGraphDelta(graph: CanvasGraph, delta: GraphDelta): CanvasGraph {
  return {
    workspaceId: graph.workspaceId,
    nodes: mergeById(graph.nodes, delta.nodes),
    edges: mergeById(graph.edges, delta.edges)
  }
}

function mergeById<T extends { id: string }>(current: T[], updates?: T[]): T[] {
  if (!updates || updates.length === 0) return current
  const merged = new Map(current.map((item) => [item.id, item]))
  for (const item of updates) {
    merged.set(item.id, item)
  }
  return [...merged.values()]
}
