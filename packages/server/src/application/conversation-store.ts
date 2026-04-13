import { nanoid } from 'nanoid'
import type {
  CanvasEdge,
  CanvasGraph,
  WorkspaceMetadataUpdateInput,
  CanvasNode,
  CommunityPostInput,
  ConversationEvent,
  ConversationMetadata,
  KnowledgeEvidence,
  PracticeSessionInput,
  WorkspaceDirectoryItem,
  WorkspaceMetadataHistoryEntry,
  WorkspaceAsset,
  SeminarPhase
} from '@starlink/shared'
import {
  canvasEdgeSchema,
  canvasNodeSchema,
  conversationEventSchema,
  conversationMetadataSchema
} from '@starlink/shared'
import { BusinessLangGraphService, type BusinessStreamUpdate, type GraphDelta } from '../services/business-langgraph.js'
import type { ConversationEventBus, ConversationEventFilter } from './conversation-event-bus.js'
import type {
  ConversationRecord,
  ConversationRuntimeRepository,
  PendingApprovalData
} from './conversation-runtime-repository.js'
import { ConversationSessionStore } from './conversation-session-store.js'
import { WorkspaceGraphStore } from './workspace-graph-store.js'
import { WorkspaceAssetStore } from './workspace-asset-store.js'
import { RuntimeEventStore } from './runtime-event-store.js'
import { applyGraphDelta } from './graph-delta.js'
import {
  getWorkspaceMetadata as getWorkspaceMetadataPg,
  listWorkspaceMetadata as listWorkspaceMetadataPg,
  listWorkspaceMetadataHistory as listWorkspaceMetadataHistoryPg,
  updateWorkspaceMetadata as updateWorkspaceMetadataPg
} from './workspace-metadata-pg-store.js'
import {
  getWorkspaceMetadata as getWorkspaceMetadataFile,
  listWorkspaceMetadata as listWorkspaceMetadataFile,
  listWorkspaceMetadataHistory as listWorkspaceMetadataHistoryFile,
  updateWorkspaceMetadata as updateWorkspaceMetadataFile
} from './workspace-metadata-store.js'
import {
  getViewerPermissions,
  requireWorkspacePermission,
  type WorkspaceMetadataRecord
} from './workspace-access.js'

const usePg = (process.env.WORKSPACE_METADATA_DRIVER ?? 'pg') === 'pg'
const getWorkspaceMetadata = usePg ? getWorkspaceMetadataPg : getWorkspaceMetadataFile
const listWorkspaceMetadata = usePg ? listWorkspaceMetadataPg : listWorkspaceMetadataFile
const listWorkspaceMetadataHistory = usePg ? listWorkspaceMetadataHistoryPg : listWorkspaceMetadataHistoryFile
const updateWorkspaceMetadata = usePg ? updateWorkspaceMetadataPg : updateWorkspaceMetadataFile
export type ConversationStoreDeps = {
  eventBus: ConversationEventBus
  runtimeRepository: ConversationRuntimeRepository
  businessLangGraphService?: BusinessLangGraphService
}

export class ConversationStore {
  private readonly eventBus: ConversationEventBus
  private readonly runtimeRepository: ConversationRuntimeRepository
  private readonly sessionStore: ConversationSessionStore
  private readonly graphStore: WorkspaceGraphStore
  private readonly assetStore: WorkspaceAssetStore
  private readonly eventStore: RuntimeEventStore
  private readonly businessLangGraphService: BusinessLangGraphService
  private readonly pendingDecisionTimeouts = new Map<string, NodeJS.Timeout>()
  private readonly pendingDecisionResolvers = new Map<string, (decision: string) => void>()
  private readonly hitlEnabled = process.env.HITL_ENABLED === 'true'
  private readonly hitlApprovalTimeoutMs = Number(process.env.HITL_APPROVAL_TIMEOUT_MS ?? '600000')

  constructor({
    eventBus,
    runtimeRepository,
    businessLangGraphService = new BusinessLangGraphService()
  }: ConversationStoreDeps) {
    this.eventBus = eventBus
    this.runtimeRepository = runtimeRepository
    this.businessLangGraphService = businessLangGraphService
    this.sessionStore = new ConversationSessionStore(runtimeRepository)
    this.graphStore = new WorkspaceGraphStore(runtimeRepository)
    this.assetStore = new WorkspaceAssetStore(runtimeRepository)
    this.eventStore = new RuntimeEventStore(runtimeRepository, eventBus)
  }

  async startConversation(
    workspaceId: string,
    userId: string,
    question: string
  ): Promise<ConversationRecord> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.write')
    const existingGraph = await this.getGraph(workspaceId)

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
      graph: existingGraph,
      knowledgeEvidence: []
    }

    await this.sessionStore.createConversation(id, record)
    await this.graphStore.setWorkspaceGraph(workspaceId, record.graph)

    const stream = this.businessLangGraphService.streamConversation({
      workspaceId,
      userId,
      question,
      traceId: id,
      baseGraph: existingGraph
    })
    let initialized = false

    try {
      const initResult = await stream.next()
      if (!initResult.done && initResult.value?.type === 'init') {
        initialized = true
        const currentGraph = initResult.value.graph
        record.graph = currentGraph
        await this.graphStore.setWorkspaceGraph(workspaceId, currentGraph)
        await this.sessionStore.updateConversation(id, record)
        await this.graphStore.persistGraph(currentGraph)
        const baseEvent: ConversationEvent = {
          type: 'graph/appended',
          conversationId: id,
          payload: currentGraph
        }
        await this.publishEvent(workspaceId, baseEvent)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedEvent: ConversationEvent = {
        type: 'status',
        conversationId: id,
        status: 'failed',
        message
      }
      await this.publishEvent(workspaceId, failedEvent)
      record.metadata = {
        ...record.metadata,
        status: 'failed',
        updatedAt: new Date()
      }
      await this.sessionStore.updateConversation(id, record)
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

  async getConversation(id: string, userId?: string): Promise<ConversationRecord | null> {
    const record = await this.sessionStore.getConversation(id)
    if (!record) return null
    if (userId) {
      await this.assertWorkspacePermission(record.graph.workspaceId, userId, 'workspace.read')
    }
    const metadata = conversationMetadataSchema.parse(record.metadata)
    return {
      ...record,
      metadata
    }
  }

  async listConversationRuntimeEvents(
    workspaceId: string,
    userId: string,
    conversationId?: string
  ): Promise<ConversationEvent[]> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.read')
    if (conversationId) {
      await this.assertConversationBelongsToWorkspace(workspaceId, conversationId)
    }
    const events = await this.eventStore.listConversationEvents(workspaceId, conversationId)
    return events.map((event) => conversationEventSchema.parse(event))
  }

  async assertWorkspaceAccess(
    workspaceId: string,
    userId: string,
    requiredPermission: 'workspace.read' | 'workspace.write' | 'workspace.publish' | 'workspace.manage'
  ) {
    await this.assertWorkspacePermission(workspaceId, userId, requiredPermission)
  }

  async assertConversationScope(workspaceId: string, userId: string, conversationId?: string) {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.read')
    if (!conversationId) return
    await this.assertConversationBelongsToWorkspace(workspaceId, conversationId)
  }

  async getGraph(workspaceId: string, userId?: string): Promise<CanvasGraph> {
    if (userId) {
      await this.assertWorkspacePermission(workspaceId, userId, 'workspace.read')
    }

    const manualGraph = await this.graphStore.getWorkspaceGraph(workspaceId)
    if (manualGraph) {
      return {
        workspaceId: manualGraph.workspaceId,
        nodes: [...manualGraph.nodes],
        edges: [...manualGraph.edges]
      }
    }

    const workspaceConversations = await this.sessionStore.getConversationsByWorkspace(workspaceId)
    const existing = workspaceConversations[0]?.record
    if (existing) {
      await this.graphStore.setWorkspaceGraph(workspaceId, existing.graph)
      return {
        workspaceId,
        nodes: [...existing.graph.nodes],
        edges: [...existing.graph.edges]
      }
    }

    const persistedGraph = await this.graphStore.loadPersistedGraph(workspaceId)
    if (persistedGraph) {
      await this.graphStore.setWorkspaceGraph(workspaceId, persistedGraph)
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
    await this.graphStore.setWorkspaceGraph(workspaceId, emptyGraph)
    return emptyGraph
  }

  async listWorkspaces(userId: string): Promise<WorkspaceDirectoryItem[]> {
    const workspaces = await this.runtimeRepository.listWorkspaces()
    const metadataRecords = await listWorkspaceMetadata()
    const runtimeById = new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace] as const))
    const knownIds = new Set<string>([
      ...metadataRecords.map((item) => item.workspaceId),
      ...workspaces.map((item) => item.workspaceId)
    ])

    return await Promise.all([...knownIds].map(async (workspaceId) => {
      const metadata = await getWorkspaceMetadata(workspaceId)
      const runtime = runtimeById.get(workspaceId)
      const viewerPermissions = getViewerPermissions(userId, metadata.members)
      return {
        workspaceId,
        name: metadata.name,
        type: metadata.type,
        focus: metadata.focus,
        ownerId: metadata.ownerId,
        ownerName: metadata.ownerName,
        members: metadata.members,
        viewerPermissions,
        canManage: viewerPermissions.includes('workspace.manage'),
        status: runtime?.status ?? 'draft',
        updatedAt: runtime?.updatedAt ?? new Date().toISOString()
      }
    })).then((items) => items.filter((workspace) => workspace.viewerPermissions.length > 0))
  }

  async listWorkspaceHistory(workspaceId: string, userId: string): Promise<WorkspaceMetadataHistoryEntry[]> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.read')
    return await listWorkspaceMetadataHistory(workspaceId)
  }

  async updateWorkspace(input: WorkspaceMetadataUpdateInput, userId: string): Promise<WorkspaceDirectoryItem> {
    const currentMetadata = await getWorkspaceMetadata(input.workspaceId)
    let viewerPermissions: string[]
    try {
      viewerPermissions = this.assertPermissionFromMetadata(currentMetadata, userId, 'workspace.manage')
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN_WORKSPACE') {
        throw new Error('FORBIDDEN_WORKSPACE_METADATA')
      }
      throw error
    }

    const { workspace: metadata } = await updateWorkspaceMetadata(input, userId)
    const runtime = (await this.runtimeRepository.listWorkspaces()).find(
      (workspace) => workspace.workspaceId === input.workspaceId
    )
    const nextViewerPermissions = getViewerPermissions(userId, metadata.members)

    return {
      workspaceId: metadata.workspaceId,
      name: metadata.name,
      type: metadata.type,
      focus: metadata.focus,
      ownerId: metadata.ownerId,
      ownerName: metadata.ownerName,
      members: metadata.members,
      viewerPermissions: nextViewerPermissions,
      canManage: nextViewerPermissions.includes('workspace.manage'),
      status: runtime?.status ?? 'draft',
      updatedAt: runtime?.updatedAt ?? new Date().toISOString()
    }
  }

  async listWorkspaceAssets(workspaceId: string, userId: string): Promise<WorkspaceAsset[]> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.read')
    return await this.assetStore.listWorkspaceAssets(workspaceId)
  }

  async saveCommunityPost(input: CommunityPostInput, userId: string): Promise<WorkspaceAsset> {
    await this.assertWorkspacePermission(input.workspaceId, userId, 'workspace.write')

    const createdAt = new Date().toISOString()
    const postId = nanoid()
    const asset: WorkspaceAsset = {
      assetId: `community:${postId}`,
      workspaceId: input.workspaceId,
      assetType: 'community-post',
      title: input.title,
      sourceModule: 'community',
      sourceTaskId: null,
      metadata: {
        tags: input.tags,
        authorName: input.authorName,
        authorRole: input.authorRole ?? null
      },
      content: {
        id: postId,
        workspaceId: input.workspaceId,
        title: input.title,
        body: input.body,
        tags: input.tags,
        authorName: input.authorName,
        authorRole: input.authorRole ?? null,
        createdAt
      },
      version: 1,
      status: 'published',
      createdBy: userId,
      createdAt,
      updatedAt: createdAt
    }

    await this.assetStore.upsertWorkspaceAsset(asset)
    return asset
  }

  async savePracticeSession(input: PracticeSessionInput, userId: string): Promise<WorkspaceAsset> {
    await this.assertWorkspacePermission(input.workspaceId, userId, 'workspace.write')

    const updatedAt = input.lastUpdated ?? new Date().toISOString()
    const assetId = `practice:${input.workspaceId}:${input.scenarioId}`
    const current = (await this.assetStore.listWorkspaceAssets(input.workspaceId))
      .find((asset) => asset.assetId === assetId)
    const asset: WorkspaceAsset = {
      assetId,
      workspaceId: input.workspaceId,
      assetType: 'practice-output',
      title: input.scenarioTitle?.trim() ? `Practice Session · ${input.scenarioTitle}` : `Practice Session · ${input.scenarioId}`,
      sourceModule: 'practice',
      sourceTaskId: null,
      metadata: {
        scenarioId: input.scenarioId,
        messageCount: input.messages.length,
        insightCount: input.insights.length,
        resourceCount: input.resources.length
      },
      content: {
        scenarioId: input.scenarioId,
        scenarioTitle: input.scenarioTitle ?? null,
        messages: input.messages,
        insights: input.insights,
        resources: input.resources,
        quickReplies: input.quickReplies,
        lastUpdated: updatedAt
      },
      version: Math.max(current?.version ?? 0, input.messages.length),
      status: input.messages.length > 1 ? 'ready' : 'draft',
      createdBy: current?.createdBy ?? userId,
      createdAt: current?.createdAt ?? updatedAt,
      updatedAt
    }

    await this.assetStore.upsertWorkspaceAsset(asset)
    return asset
  }

  async addNode(
    workspaceId: string,
    userId: string,
    input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
  ): Promise<CanvasNode> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.write')

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

    await this.graphStore.setWorkspaceGraph(workspaceId, updatedGraph)
    await this.graphStore.persistGraph(updatedGraph)

    const conversations = await this.sessionStore.getConversationsByWorkspace(workspaceId)
    for (const item of conversations) {
      const nextRecord: ConversationRecord = {
        ...item.record,
        graph: {
          ...item.record.graph,
          nodes: updatedNodes
        }
      }
      await this.sessionStore.updateConversation(item.id, nextRecord)
    }

    return parsed
  }

  async connectNodes(
    workspaceId: string,
    userId: string,
    input: { id?: string; source: string; target: string; label?: string | null }
  ): Promise<CanvasEdge> {
    await this.assertWorkspacePermission(workspaceId, userId, 'workspace.write')

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

    await this.graphStore.setWorkspaceGraph(workspaceId, updatedGraph)
    await this.graphStore.persistGraph(updatedGraph)

    const conversations = await this.sessionStore.getConversationsByWorkspace(workspaceId)
    for (const item of conversations) {
      const nextRecord: ConversationRecord = {
        ...item.record,
        graph: {
          ...item.record.graph,
          edges: updatedEdges
        }
      }
      await this.sessionStore.updateConversation(item.id, nextRecord)
    }

    return parsed
  }

  getEventIterator(filter: ConversationEventFilter) {
    return this.eventStore.getEventIterator(filter)
  }

  async close() {
    for (const timeout of this.pendingDecisionTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.pendingDecisionTimeouts.clear()
    this.pendingDecisionResolvers.clear()
    await this.runtimeRepository.close()
    await this.eventBus.close()
  }

  async approveDecision(conversationId: string, userId: string, decision?: string): Promise<boolean> {
    const pending = await this.sessionStore.getPendingApproval(conversationId)
    if (!pending) {
      return false
    }

    await this.assertWorkspacePermission(pending.workspaceId, userId, 'workspace.write')

    const nextDecision = (decision ?? '').trim() || pending.decision
    const resolver = this.pendingDecisionResolvers.get(conversationId)
    if (resolver) {
      resolver(nextDecision)
    }
    return true
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
    const emittedTurnNodeIds = new Set<string>()
    let currentPhase: SeminarPhase | null = null
    let latestDecision = ''

    const publishEvent = async (event: ConversationEvent) => {
      await this.publishEvent(workspaceId, event)
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
      for await (const update of stream) {
        if (update.type === 'init') {
          currentGraph = update.graph
          record.graph = currentGraph
          await this.graphStore.setWorkspaceGraph(workspaceId, currentGraph)
          await this.graphStore.persistGraph(currentGraph)
          record.knowledgeEvidence = update.knowledgeEvidence ?? []
          await this.sessionStore.updateConversation(conversationId, record)
          if (!initialized) {
            initialized = true
            const appendedEvent: ConversationEvent = {
              type: 'graph/appended',
              conversationId,
              payload: currentGraph
            }
            await this.publishEvent(workspaceId, appendedEvent)
          }
          continue
        }

        if (update.type === 'delta') {
          currentGraph = applyGraphDelta(currentGraph, update.delta)
          record.graph = currentGraph
          await this.graphStore.setWorkspaceGraph(workspaceId, currentGraph)
          await this.sessionStore.updateConversation(conversationId, record)
          await this.graphStore.persistGraph(currentGraph)

          const event: ConversationEvent = initialized
            ? {
                type: 'graph/diff',
              conversationId,
              payload: {
                nodes: update.delta.nodes,
                edges: update.delta.edges,
                removedNodeIds: update.delta.removedNodeIds,
                removedEdgeIds: update.delta.removedEdgeIds
              }
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

        if (update.type === 'interrupt') {
          if (this.hitlEnabled) {
            const userDecision = await this.waitForDecisionApproval({
              conversationId,
              workspaceId,
              decision: update.decision,
              record
            })

            record.metadata = {
              ...record.metadata,
              status: 'running',
              updatedAt: new Date()
            }
            await this.sessionStore.updateConversation(conversationId, record)

            await publishEvent({
              type: 'seminar.decision.made',
              conversationId,
              payload: {
                workspaceId,
                phase: 'decision' as const,
                decision: userDecision,
                occurredAt: new Date().toISOString()
              }
            })
          }
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
      await this.sessionStore.updateConversation(conversationId, record)
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
      await this.sessionStore.updateConversation(conversationId, record)
    }
  }

  private async publishEvent(workspaceId: string, event: ConversationEvent) {
    if (shouldPersistRuntimeEvent(event)) {
      await this.eventStore.appendConversationEvent(workspaceId, event)
    }
    await this.eventStore.publish(workspaceId, event)
  }

  private async waitForDecisionApproval(options: {
    conversationId: string
    workspaceId: string
    decision: string
    record: ConversationRecord
  }) {
    const { conversationId, workspaceId, decision, record } = options
    await this.publishEvent(workspaceId, {
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
    await this.sessionStore.updateConversation(conversationId, record)

    const approvalData: PendingApprovalData = {
      conversationId,
      workspaceId,
      decision,
      createdAt: new Date().toISOString(),
      timeoutMs: this.hitlApprovalTimeoutMs
    }
    await this.sessionStore.setPendingApproval(conversationId, approvalData)

    return await new Promise<string>((resolve) => {
      const finalize = (nextDecision: string) => {
        const existingTimeout = this.pendingDecisionTimeouts.get(conversationId)
        if (existingTimeout) {
          clearTimeout(existingTimeout)
        }
        this.pendingDecisionTimeouts.delete(conversationId)
        this.pendingDecisionResolvers.delete(conversationId)
        void this.sessionStore.deletePendingApproval(conversationId)
        resolve(nextDecision)
      }

      const timeout = setTimeout(() => {
        finalize(decision)
      }, this.hitlApprovalTimeoutMs)

      this.pendingDecisionTimeouts.set(conversationId, timeout)
      this.pendingDecisionResolvers.set(conversationId, finalize)
    })
  }

  private assertPermissionFromMetadata(
    metadata: WorkspaceMetadataRecord,
    userId: string,
    requiredPermission: 'workspace.read' | 'workspace.write' | 'workspace.publish' | 'workspace.manage'
  ) {
    return requireWorkspacePermission(userId, metadata, requiredPermission)
  }

  private async assertWorkspacePermission(
    workspaceId: string,
    userId: string,
    requiredPermission: 'workspace.read' | 'workspace.write' | 'workspace.publish' | 'workspace.manage'
  ) {
    const metadata = await getWorkspaceMetadata(workspaceId)
    return this.assertPermissionFromMetadata(metadata, userId, requiredPermission)
  }

  private async assertConversationBelongsToWorkspace(workspaceId: string, conversationId: string) {
    const record = await this.sessionStore.getConversation(conversationId)
    if (!record) return
    if (record.graph.workspaceId !== workspaceId) {
      throw new Error('INVALID_CONVERSATION_SCOPE')
    }
  }
}

function shouldPersistRuntimeEvent(event: ConversationEvent) {
  return event.type === 'status'
    || event.type === 'phase.changed'
    || event.type === 'seminar.turn.completed'
    || event.type === 'seminar.decision.made'
    || event.type === 'seminar.decision.requested'
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
        stage?: SeminarPhase
      }
    }
  }
  const meta = data.meta
  const agentId = meta?.metadata?.agent_signature ?? meta?.agentType
  if (!agentId) return null

  const title = (typeof data.title === 'string' && data.title.trim()) || node.id
  const summary = typeof data.content === 'string' ? data.content : ''
  const stage = meta?.metadata?.stage ?? inferPhase(agentId, meta?.macraType, title, summary)

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
