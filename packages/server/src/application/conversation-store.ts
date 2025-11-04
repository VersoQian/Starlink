import { PubSub } from 'graphql-subscriptions'
import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ConversationEvent,
  ConversationMetadata
} from '@branching-chat/shared'
import {
  canvasEdgeSchema,
  canvasNodeSchema,
  conversationMetadataSchema
} from '@branching-chat/shared'
import { runCanvasPipeline } from '@branching-chat/agent-runtime'

export type ConversationStoreDeps = {
  pubSub: PubSub
}

type ConversationRecord = {
  metadata: ConversationMetadata
  graph: CanvasGraph
}

const EVENT_TOPIC = 'conversation-progress'

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

    const execution = await runCanvasPipeline({ workspaceId, userId, question })
    const record: ConversationRecord = {
      metadata,
      graph: execution.graph
    }

    this.conversations.set(id, record)
    this.workspaceGraphs.set(workspaceId, execution.graph)

    const baseEvent: ConversationEvent = {
      type: 'graph/appended',
      conversationId: id,
      payload: execution.graph
    }

    await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: baseEvent })

    for (const delta of execution.deltas) {
      const deltaEvent: ConversationEvent = {
        type: 'graph/diff',
        conversationId: id,
        payload: {
          nodes: delta.nodes,
          edges: delta.edges
        }
      }
      await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: deltaEvent })
    }

    const completeEvent: ConversationEvent = {
      type: 'status',
      conversationId: id,
      status: 'completed'
    }

    await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: completeEvent })

    record.metadata = {
      ...record.metadata,
      status: 'completed',
      updatedAt: new Date()
    }

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
}
