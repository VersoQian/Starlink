import { PubSub } from 'graphql-subscriptions'
import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ConversationEvent,
  ConversationMetadata
} from '@starlink/shared'
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@starlink/shared'
import { BusinessLangGraphService, type BusinessStreamUpdate, type GraphDelta } from '../services/business-langgraph.js'
export type ConversationStoreDeps = {
  pubSub: PubSub
}

type ConversationRecord = {
  metadata: ConversationMetadata
  graph: CanvasGraph
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
      }
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
    return record ? { ...record, metadata: conversationMetadataSchema.parse(record.metadata) } : null
  }

  getGraph(workspaceId: string): CanvasGraph {
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
    const emptyGraph: CanvasGraph = {
      workspaceId,
      nodes: [],
      edges: []
    }
    this.workspaceGraphs.set(workspaceId, emptyGraph)
    return emptyGraph
  }

  addNode(
    workspaceId: string,
    input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
  ): CanvasNode {
    const id = input.id ?? nanoid()
    const parsed = canvasNodeSchema.parse({
      id,
      type: input.type,
      position: input.position,
      data: input.data
    })

    const baseGraph = this.getGraph(workspaceId)

    const updatedNodes = [...baseGraph.nodes.filter((node) => node.id !== parsed.id), parsed]
    const updatedGraph: CanvasGraph = {
      workspaceId,
      nodes: updatedNodes,
      edges: baseGraph.edges
    }

    this.workspaceGraphs.set(workspaceId, updatedGraph)

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

  connectNodes(
    workspaceId: string,
    input: { id?: string; source: string; target: string; label?: string | null }
  ): CanvasEdge {
    const id = input.id ?? nanoid()
    const parsed = canvasEdgeSchema.parse({
      id,
      source: input.source,
      target: input.target,
      label: input.label ?? null
    })

    const baseGraph = this.getGraph(workspaceId)
    const updatedEdges = [...baseGraph.edges.filter((edge) => edge.id !== parsed.id), parsed]
    const updatedGraph: CanvasGraph = {
      workspaceId,
      nodes: baseGraph.nodes,
      edges: updatedEdges
    }

    this.workspaceGraphs.set(workspaceId, updatedGraph)

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
    let { stream, record, workspaceId, conversationId, initialized } = options
    let currentGraph = record.graph

    try {
      for await (const update of stream) {
        if (update.type === 'init') {
          currentGraph = update.graph
          record.graph = currentGraph
          this.workspaceGraphs.set(workspaceId, currentGraph)
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

        currentGraph = applyGraphDelta(currentGraph, update.delta)
        record.graph = currentGraph
        this.workspaceGraphs.set(workspaceId, currentGraph)

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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
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
