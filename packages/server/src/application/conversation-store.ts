import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  ConversationEvent,
  ConversationMetadata,
  KnowledgeEvidence,
  SeminarPhase
} from '@starlink/shared'
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@starlink/shared'
import { BusinessLangGraphService, type BusinessStreamUpdate, type GraphDelta } from '../services/business-langgraph.js'
import { loadPersistedGraph, persistCanvasGraph } from './canvas-persistence.js'
import type { ConversationEventBus } from './conversation-event-bus.js'
import type {
  ConversationRecord,
  ConversationRuntimeRepository
} from './conversation-runtime-repository.js'
export type ConversationStoreDeps = {
  eventBus: ConversationEventBus
  runtimeRepository: ConversationRuntimeRepository
}

const businessLangGraphService = new BusinessLangGraphService()

export class ConversationStore {
  private readonly eventBus: ConversationEventBus
  private readonly runtimeRepository: ConversationRuntimeRepository
  private readonly pendingDecisionApprovals = new Map<string, PendingDecisionApproval>()
  private readonly hitlEnabled = process.env.HITL_ENABLED === 'true'
  private readonly hitlApprovalTimeoutMs = Number(process.env.HITL_APPROVAL_TIMEOUT_MS ?? '600000')

  constructor({
    eventBus,
    runtimeRepository
  }: ConversationStoreDeps) {
    this.eventBus = eventBus
    this.runtimeRepository = runtimeRepository
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

    await this.runtimeRepository.createConversation(id, record)
    await this.runtimeRepository.setWorkspaceGraph(workspaceId, record.graph)

    const stream = businessLangGraphService.streamConversation({
      workspaceId,
      userId,
      question,
      traceId: id
    })
    let initialized = false

    try {
      const initResult = await stream.next()
      if (!initResult.done && initResult.value?.type === 'init') {
        initialized = true
        const currentGraph = initResult.value.graph
        record.graph = currentGraph
        await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph)
        await this.runtimeRepository.updateConversation(id, record)
        await this.persistGraphState(currentGraph)
        const baseEvent: ConversationEvent = {
          type: 'graph/appended',
          conversationId: id,
          payload: currentGraph
        }
        await this.publishEvent(baseEvent)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedEvent: ConversationEvent = {
        type: 'status',
        conversationId: id,
        status: 'failed',
        message
      }
      await this.publishEvent(failedEvent)
      record.metadata = {
        ...record.metadata,
        status: 'failed',
        updatedAt: new Date()
      }
      await this.runtimeRepository.updateConversation(id, record)
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

  async getConversation(id: string): Promise<ConversationRecord | null> {
    const record = await this.runtimeRepository.getConversation(id)
    if (!record) return null
    const metadata = conversationMetadataSchema.parse(record.metadata)
    return {
      ...record,
      metadata
    }
  }

  async getGraph(workspaceId: string): Promise<CanvasGraph> {
    const manualGraph = await this.runtimeRepository.getWorkspaceGraph(workspaceId)
    if (manualGraph) {
      return {
        workspaceId: manualGraph.workspaceId,
        nodes: [...manualGraph.nodes],
        edges: [...manualGraph.edges]
      }
    }

    const workspaceConversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId)
    const existing = workspaceConversations[0]?.record
    if (existing) {
      await this.runtimeRepository.setWorkspaceGraph(workspaceId, existing.graph)
      return {
        workspaceId,
        nodes: [...existing.graph.nodes],
        edges: [...existing.graph.edges]
      }
    }

    const persistedGraph = await loadPersistedGraph(workspaceId)
    if (persistedGraph) {
      await this.runtimeRepository.setWorkspaceGraph(workspaceId, persistedGraph)
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
    await this.runtimeRepository.setWorkspaceGraph(workspaceId, emptyGraph)
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

    await this.runtimeRepository.setWorkspaceGraph(workspaceId, updatedGraph)
    await this.persistGraphState(updatedGraph)

    const conversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId)
    for (const item of conversations) {
      const nextRecord: ConversationRecord = {
        ...item.record,
        graph: {
          ...item.record.graph,
          nodes: updatedNodes
        }
      }
      await this.runtimeRepository.updateConversation(item.id, nextRecord)
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

    await this.runtimeRepository.setWorkspaceGraph(workspaceId, updatedGraph)
    await this.persistGraphState(updatedGraph)

    const conversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId)
    for (const item of conversations) {
      const nextRecord: ConversationRecord = {
        ...item.record,
        graph: {
          ...item.record.graph,
          edges: updatedEdges
        }
      }
      await this.runtimeRepository.updateConversation(item.id, nextRecord)
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
    return this.eventBus.getEventIterator()
  }

  async close() {
    for (const approval of this.pendingDecisionApprovals.values()) {
      if (approval.timeout) {
        clearTimeout(approval.timeout)
      }
    }
    this.pendingDecisionApprovals.clear()
    await this.runtimeRepository.close()
    await this.eventBus.close()
  }

  async approveDecision(conversationId: string, decision?: string): Promise<boolean> {
    const pending = this.pendingDecisionApprovals.get(conversationId)
    if (!pending) {
      return false
    }

    const nextDecision = (decision ?? '').trim() || pending.decision
    pending.resolve(nextDecision)
    return true
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
    const emittedTurnNodeIds = new Set<string>()
    let currentPhase: SeminarPhase | null = null
    let latestDecision = ''

    const publishEvent = async (event: ConversationEvent) => {
      await this.publishEvent(event)
    }

    const publishPhaseChanged = async (phase: SeminarPhase, reason?: string | null) => {
      if (currentPhase === phase) return
      currentPhase = phase
      await publishEvent({
        type: 'phase.changed',
        conversationId,
        payload: {
          workspaceId,
          phase,
          reason: reason ?? null,
          occurredAt: new Date().toISOString()
        }
      })
    }

    const publishSeminarTurn = async (payload: Omit<ExtractRuntimeInfo, 'stage'> & { phase: SeminarPhase }) => {
      await publishEvent({
        type: 'seminar.turn.completed',
        conversationId,
        payload: {
          workspaceId,
          phase: payload.phase,
          agentId: payload.agentId,
          agentName: payload.agentName,
          nodeId: payload.nodeId,
          title: payload.title,
          summary: payload.summary,
          occurredAt: new Date().toISOString()
        }
      })
    }

    await publishPhaseChanged('planning', 'conversation.started')

    try {
      console.log('🔄 [runConversationStream] Iterating stream updates...')
      for await (const update of stream) {
        if (update.type === 'init') {
          currentGraph = update.graph
          record.graph = currentGraph
          await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph)
          await this.persistGraphState(currentGraph)
          record.knowledgeEvidence = update.knowledgeEvidence ?? []
          await this.runtimeRepository.updateConversation(conversationId, record)
          if (!initialized) {
            initialized = true
            const appendedEvent: ConversationEvent = {
              type: 'graph/appended',
              conversationId,
              payload: currentGraph
            }
            await this.publishEvent(appendedEvent)
          }
          continue
        }

        if (update.type === 'delta') {
          currentGraph = applyGraphDelta(currentGraph, update.delta)
          record.graph = currentGraph
          await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph)
          await this.runtimeRepository.updateConversation(conversationId, record)
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

          await publishEvent(event)
          initialized = true

          const deltaNodes = update.delta.nodes ?? []
          for (const node of deltaNodes) {
            const info = extractRuntimeInfo(node)
            if (!info) continue

            await publishPhaseChanged(info.stage, `from.${info.agentName}`)

            if (!emittedTurnNodeIds.has(node.id)) {
              emittedTurnNodeIds.add(node.id)
              await publishSeminarTurn({
                phase: info.stage,
                agentId: info.agentId,
                agentName: info.agentName,
                nodeId: node.id,
                title: info.title,
                summary: info.summary
              })
            }

            if (info.stage === 'decision' && info.summary.trim().length > 0) {
              latestDecision = info.summary
            }
          }
          continue
        }

        if (update.type === 'status') {
          continue
        }
      }

      if (!latestDecision) {
        latestDecision = findLatestDecision(currentGraph)
      }

      if (latestDecision) {
        if (this.hitlEnabled) {
          latestDecision = await this.waitForDecisionApproval({
            conversationId,
            workspaceId,
            decision: latestDecision,
            record
          })
        }

        await publishPhaseChanged('decision', 'seminar.final-decision')
        await publishEvent({
          type: 'seminar.decision.made',
          conversationId,
          payload: {
            workspaceId,
            phase: 'decision',
            decision: latestDecision,
            occurredAt: new Date().toISOString()
          }
        })
      }

      const completeEvent: ConversationEvent = {
        type: 'status',
        conversationId,
        status: 'completed'
      }
      await publishEvent(completeEvent)

      record.metadata = {
        ...record.metadata,
        status: 'completed',
        updatedAt: new Date()
      }
      await this.runtimeRepository.updateConversation(conversationId, record)
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
      await publishEvent(failedEvent)

      record.metadata = {
        ...record.metadata,
        status: 'failed',
        updatedAt: new Date()
      }
      await this.runtimeRepository.updateConversation(conversationId, record)
    }
  }

  private async publishEvent(event: ConversationEvent) {
    await this.eventBus.publish(event)
  }

  private async waitForDecisionApproval(options: {
    conversationId: string
    workspaceId: string
    decision: string
    record: ConversationRecord
  }) {
    const { conversationId, workspaceId, decision, record } = options
    await this.publishEvent({
      type: 'seminar.decision.requested',
      conversationId,
      payload: {
        workspaceId,
        phase: 'decision',
        decision,
        occurredAt: new Date().toISOString()
      }
    })

    record.metadata = {
      ...record.metadata,
      status: 'paused',
      updatedAt: new Date()
    }
    await this.runtimeRepository.updateConversation(conversationId, record)

    return await new Promise<string>((resolve) => {
      const finalize = (nextDecision: string) => {
        const existing = this.pendingDecisionApprovals.get(conversationId)
        if (existing?.timeout) {
          clearTimeout(existing.timeout)
        }
        this.pendingDecisionApprovals.delete(conversationId)
        resolve(nextDecision)
      }

      const timeout = setTimeout(() => {
        finalize(decision)
      }, this.hitlApprovalTimeoutMs)

      this.pendingDecisionApprovals.set(conversationId, {
        decision,
        timeout,
        resolve: finalize
      })
    })
  }
}

type PendingDecisionApproval = {
  decision: string
  timeout: NodeJS.Timeout | null
  resolve: (decision: string) => void
}

type ExtractRuntimeInfo = {
  stage: SeminarPhase
  agentId: string
  agentName: string
  nodeId: string
  title: string
  summary: string
}

const AGENT_NAME_MAP: Record<string, string> = {
  Market_Agent: 'Market Agent',
  Product_Agent: 'Product Agent',
  Finance_Agent: 'Finance Agent',
  Adversarial_Critic: 'Critic Agent',
  Orchestrator: 'Orchestrator'
}

function extractRuntimeInfo(node: CanvasNode): ExtractRuntimeInfo | null {
  const data = (node.data ?? {}) as {
    title?: string
    content?: string
    meta?: {
      macraType?: string
      agentType?: string
      metadata?: {
        agent_signature?: string
      }
    }
  }
  const meta = data.meta
  const agentId = meta?.metadata?.agent_signature ?? meta?.agentType
  if (!agentId) return null

  const title = (typeof data.title === 'string' && data.title.trim()) || node.id
  const summary = typeof data.content === 'string' ? data.content : ''
  const stage = inferPhase(agentId, meta?.macraType, title, summary)

  return {
    stage,
    agentId,
    agentName: AGENT_NAME_MAP[agentId] ?? agentId,
    nodeId: node.id,
    title,
    summary
  }
}

function inferPhase(agentId: string, macraType?: string, title = '', content = ''): SeminarPhase {
  const corpus = `${title}\n${content}`
  if (agentId === 'Adversarial_Critic' || macraType === 'conflict-alert') {
    return 'review'
  }
  if (agentId === 'Orchestrator') {
    if (/规划|计划|路线|拆解|阶段|里程碑/.test(corpus)) {
      return 'planning'
    }
    return 'decision'
  }
  return 'execution'
}

function findLatestDecision(graph: CanvasGraph): string {
  const decisionNodes = graph.nodes
    .map((node) => extractRuntimeInfo(node))
    .filter((item): item is ExtractRuntimeInfo => item !== null)
    .filter((item) => item.stage === 'decision')
  return decisionNodes[decisionNodes.length - 1]?.summary ?? ''
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
