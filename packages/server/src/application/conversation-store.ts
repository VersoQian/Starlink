import { PubSub } from 'graphql-subscriptions'
import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ConversationEvent,
  ConversationMetadata
} from '@branching-chat/shared'
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@branching-chat/shared'


export type ConversationStoreDeps = {
  pubSub: PubSub
}

type ConversationRecord = {
  metadata: ConversationMetadata
  graph: CanvasGraph
}

const EVENT_TOPIC = 'conversation-progress'
const ROOT_POSITION = { x: 160, y: 160 }


import { LLMService } from '../services/llm-service.js'

const llmService = new LLMService()

type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

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

    const execution = await buildGraphWithLLM({ workspaceId, userId, question })
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

type BuildGraphContext = {
  workspaceId: string
  userId: string
  question: string
}

async function buildGraphWithLLM(context: BuildGraphContext): Promise<{
  graph: CanvasGraph
  deltas: GraphDelta[]
}> {
  // Use the LLMService to get structured JSON
  const data = await llmService.generateGraphData(context.question, context.userId)

  const nodes: CanvasNode[] = []
  const edges: CanvasEdge[] = []
  const deltas: GraphDelta[] = []

  const addNode = (node: CanvasNode, edge?: CanvasEdge) => {
    nodes.push(node)
    if (edge) {
      edges.push(edge)
    }
    deltas.push({
      nodes: [node],
      edges: edge ? [edge] : undefined
    })
  }

  const rootNode: CanvasNode = {
    id: `root-${nanoid(8)}`,
    type: 'note',
    position: { ...ROOT_POSITION },
    data: {
      type: 'note',
      title: '多维画布任务',
      subtitle: `提问人：${context.userId || 'anonymous'}`,
      content: data.summary,
      footerText: 'AI 助手生成摘要 · 节点会随着推理逐步出现',
      variant: 'primary'
    }
  }

  addNode(rootNode)

  const branchSpacing = 320
  const levelSpacing = 220

  // Dynamic branch generation
  if (data.branches && Array.isArray(data.branches)) {
    data.branches.forEach((branchData, branchIndex) => {
      const branchId = `branch-${nanoid(8)}`
      const branchPosition = {
        x: ROOT_POSITION.x + branchSpacing * (branchIndex + 1),
        y: ROOT_POSITION.y
      }

      const branchNode: CanvasNode = {
        id: branchId,
        type: 'note',
        position: branchPosition,
        data: {
          type: 'note',
          title: branchData.title,
          content: branchData.content,
          variant: 'timeline-step'
        }
      }

      const branchEdge: CanvasEdge = {
        id: `${rootNode.id}->${branchNode.id}`,
        source: rootNode.id,
        target: branchNode.id,
        label: `分支 ${branchIndex + 1}`
      }

      addNode(branchNode, branchEdge)

      // Dynamic dimension generation
      if (branchData.dimensions && Array.isArray(branchData.dimensions)) {
        branchData.dimensions.forEach((dimData, dimIndex) => {
          const dimId = `dimension-${nanoid(8)}`
          const dimPosition = {
            x: branchPosition.x,
            y: branchPosition.y + levelSpacing * (dimIndex + 1)
          }

          const dimNode: CanvasNode = {
            id: dimId,
            type: 'note',
            position: dimPosition,
            data: {
              type: 'note',
              title: dimData.title,
              content: dimData.content,
              variant: 'timeline-dimension'
            }
          }

          const dimEdge: CanvasEdge = {
            id: `${branchId}->${dimId}`,
            source: branchId,
            target: dimId,
            label: '分析维度'
          }

          addNode(dimNode, dimEdge)

          // Dynamic action generation (if present in JSON)
          if (dimData.actions && Array.isArray(dimData.actions)) {
            dimData.actions.forEach((actionData, actionIndex) => {
              const actionId = `action-${nanoid(8)}`
              const actionPosition = {
                x: dimPosition.x,
                y: dimPosition.y + levelSpacing * (actionIndex + 1)
              }

              const actionNode: CanvasNode = {
                id: actionId,
                type: 'note',
                position: actionPosition,
                data: {
                  type: 'note',
                  title: actionData.title,
                  content: actionData.content,
                  variant: 'timeline-action'
                }
              }

              const actionEdge: CanvasEdge = {
                id: `${dimId}->${actionId}`,
                source: dimId,
                target: actionId,
                label: '行动计划'
              }

              addNode(actionNode, actionEdge)
            })
          }
        })
      }
    })
  }

  const graph: CanvasGraph = {
    workspaceId: context.workspaceId,
    nodes,
    edges
  }

  return { graph, deltas }
}
