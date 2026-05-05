import GraphQLJSON from 'graphql-type-json'
import { GraphQLError } from 'graphql'
import {
  communityPostInputSchema,
  conversationMessageSchema,
  conversationMetadataSchema,
  conversationSessionSchema,
  deriveSnippetId,
  memoryItemSchema,
  practiceSessionInputSchema,
  workspaceAssetSchema,
  workspaceContextSnapshotSchema,
  workspaceDirectoryItemSchema,
  workspaceMetadataHistoryEntrySchema,
  workspaceMetadataUpdateInputSchema
} from '@starlink/shared'
import type { FlowDefinition } from '@starlink/shared'
import type { GraphQLContext } from '../context/index.js'
import {
  addKnowledgeSeed,
  createKnowledgeBase,
  getKnowledgeBaseStatus,
  importKnowledgeUrl,
  listKnowledgeBases,
  publishKnowledgeBase,
  searchKnowledgeBase
} from '../services/kb-task-service.js'
import { pubsub, FLOW_EXECUTION_PROGRESS, publishExecutionEvent } from './subscriptions.js'
import {
  reflectOnIdeation,
  processIdeationWizardStep
} from '../services/ideation-coach-service.js'
import { buildUserSkillPrompt } from '../services/user-skill-prompt.js'
import { ConversationMemoryStore } from '../application/conversation-memory-store.js'
import { parseHitlDecision } from '../application/hitl-resume.js'

// Lazy module-level singleton: constructed on first use, shares the same
// `pool` (infrastructure/db/pool.ts) all other store consumers use, so no
// extra connections. Used by the user-skill block fetch in the
// reflectOnIdeation / processIdeationWizardStep resolvers below.
const defaultConversationMemoryStore = new ConversationMemoryStore()

export const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    workspaceGraph: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => (
        await ctx.conversationStore.getGraph(args.workspaceId, ctx.userId)
      ))
    },
    conversation: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        const record = await ctx.conversationStore.getConversation(args.id, ctx.userId)
        if (!record) return null
        return {
          metadata: {
            ...record.metadata,
            createdAt: record.metadata.createdAt.toISOString(),
            updatedAt: record.metadata.updatedAt.toISOString()
          },
          graph: record.graph,
          knowledgeEvidence: record.knowledgeEvidence ?? [],
          citations: record.citations ?? []
        }
      })
    },
    conversationSessions: async (
      _: unknown,
      args: { workspaceId: string; limit?: number | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const sessions = await ctx.conversationStore.listConversationSessions(
          args.workspaceId,
          ctx.userId,
          args.limit ?? undefined
        )
        return sessions.map((session) => conversationSessionSchema.parse(session))
      })
    },
    conversationMessages: async (
      _: unknown,
      args: { workspaceId: string; conversationId: string; limit?: number | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const messages = await ctx.conversationStore.listConversationMessages(
          args.workspaceId,
          ctx.userId,
          args.conversationId,
          args.limit ?? undefined
        )
        return messages.map((message) => conversationMessageSchema.parse(message))
      })
    },
    cardsReferencingEvidence: async (
      _: unknown,
      args: { conversationId: string; evidenceId: string },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const record = await ctx.conversationStore.getConversation(args.conversationId, ctx.userId)
        if (!record) return []
        const cardIds = new Set<string>()
        for (const citation of record.citations ?? []) {
          for (const span of citation.spans) {
            if (span.refs.some((r) => r.evidenceId === args.evidenceId)) {
              cardIds.add(citation.cardId)
              break
            }
          }
        }
        return Array.from(cardIds)
      })
    },
    workspaceMemories: async (
      _: unknown,
      args: { workspaceId: string; query?: string | null; scope?: string | null; kind?: string | null; limit?: number | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const memories = await ctx.conversationStore.listWorkspaceMemories(args.workspaceId, ctx.userId, {
          query: args.query,
          scope: args.scope,
          kind: args.kind,
          limit: args.limit
        })
        return memories.map((memory) => memoryItemSchema.parse(memory))
      })
    },
    workspaceContextSnapshot: async (
      _: unknown,
      args: { workspaceId: string; conversationId?: string | null; query: string; kbId?: string | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const snapshot = await ctx.conversationStore.buildWorkspaceContextSnapshot(
          args.workspaceId,
          ctx.userId,
          args.query,
          {
            conversationId: args.conversationId ?? null,
            kbId: args.kbId ?? null
          }
        )
        return workspaceContextSnapshotSchema.parse(snapshot)
      })
    },
    /**
     * Runtime event backfill for WS subscription gap-fill.
     *
     * Client-side flow for gap-free delivery across reconnects:
     *   1. Open WS, subscribe to `conversationProgress(workspaceId, conversationId)`.
     *   2. Track the highest 1-based index seen so far (`lastSeenCursor`). The Nth event
     *      received corresponds to cursor N. Persist this in client state.
     *   3. On WS disconnect → reconnect:
     *        a. Re-open subscription (buffer arriving live events client-side).
     *        b. Issue `query conversationRuntimeEvents(workspaceId, conversationId,
     *           sinceCursor: lastSeenCursor)` — returns only events with index > sinceCursor.
     *        c. Merge backfilled events ahead of buffered live ones, dedupe by content
     *           (event-bus is best-effort; duplicates are possible during the handoff window).
     *        d. Resume normal live processing; bump `lastSeenCursor` for each new event.
     *
     * Note: cursor is positional within the workspace event ring buffer (capped by
     *       CONVERSATION_RUNTIME_EVENT_LIMIT, default 400). If a client is offline long
     *       enough for events to roll out of the buffer, sinceCursor=0 is implicitly the
     *       safe-but-lossy fallback. A future extension may switch to monotonic IDs.
     */
    conversationRuntimeEvents: async (
      _: unknown,
      args: { workspaceId: string; conversationId?: string | null; sinceCursor?: number | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const all = await ctx.conversationStore.listConversationRuntimeEvents(
          args.workspaceId,
          ctx.userId,
          args.conversationId ?? undefined
        )
        const cursor = Math.max(0, args.sinceCursor ?? 0)
        return cursor > 0 ? all.slice(cursor) : all
      })
    },
    kbTaskStatus: async (_: unknown, args: { workspaceId: string; kbId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read')
        const statuses = await ctx.taskEventStore.getTaskStatuses(args.kbId)
        return statuses.map((status) => ({
          ...status,
          workspaceId: args.workspaceId
        }))
      })
    },
    knowledgeBases: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read')
        return await listKnowledgeBases(args.workspaceId)
      })
    },
    knowledgeBaseStatus: async (_: unknown, args: { workspaceId: string; kbId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read')
        return await getKnowledgeBaseStatus(args.workspaceId, args.kbId)
      })
    },
    knowledgeBaseSearch: async (
      _: unknown,
      args: { workspaceId: string; kbId: string; query: string; topK?: number | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read')
        const results = await searchKnowledgeBase(args.workspaceId, args.kbId, args.query, args.topK ?? 5)
        return results.map((result) => ({
          docId: result.docId,
          snippet: result.snippet,
          score: result.score,
          metadata: {
            ...(result.metadata ?? {}),
            snippetId: deriveSnippetId(
              result.docId,
              result.metadata as { chunkIndex?: number } | undefined,
              result.snippet
            )
          }
        }))
      })
    },
    workspaces: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const workspaces = await ctx.conversationStore.listWorkspaces(ctx.userId)
      return workspaces.map((workspace) => workspaceDirectoryItemSchema.parse(workspace))
    },
    workspaceAssets: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        const assets = await ctx.conversationStore.listWorkspaceAssets(args.workspaceId, ctx.userId)
        return assets.map((asset) => workspaceAssetSchema.parse(asset))
      })
    },
    workspaceMetadataHistory: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        const history = await ctx.conversationStore.listWorkspaceHistory(args.workspaceId, ctx.userId)
        return history.map((entry) => workspaceMetadataHistoryEntrySchema.parse(entry))
      })
    },
    // ── Flow / Tool queries ─────────────────────────────
    availableTools: (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.toolRegistry) return []
      return ctx.toolRegistry.listAll().map((def) => ({
        name: def.identity.name,
        label: def.display.label,
        description: def.display.description,
        category: def.display.category,
        icon: def.display.icon,
        color: def.display.color,
        inputSchema: def.inputSchema,
        outputSchema: def.outputSchema,
        inputPorts: def.inputPorts,
        outputPorts: def.outputPorts,
        runtime: def.runtime
      }))
    },
    toolByName: (_: unknown, args: { name: string }, ctx: GraphQLContext) => {
      if (!ctx.toolRegistry || !ctx.toolRegistry.has(args.name)) return null
      const def = ctx.toolRegistry.getTool(args.name).definition
      return {
        name: def.identity.name,
        label: def.display.label,
        description: def.display.description,
        category: def.display.category,
        icon: def.display.icon,
        color: def.display.color,
        inputSchema: def.inputSchema,
        outputSchema: def.outputSchema,
        inputPorts: def.inputPorts,
        outputPorts: def.outputPorts,
        runtime: def.runtime
      }
    },
    flows: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      if (!ctx.flowStore) return []
      const flows = await ctx.flowStore.listFlows(args.workspaceId)
      return flows.map(toFlowGQL)
    },
    flow: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.flowStore) return null
      const flow = await ctx.flowStore.getFlow(args.id)
      return flow ? toFlowGQL(flow) : null
    },
    flowTemplates: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      if (!ctx.flowStore) return []
      const templates = await ctx.flowStore.listTemplates()
      return templates.map(toFlowGQL)
    },
    flowExecution: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.executionStore) return null
      const exec = await ctx.executionStore.getExecution(args.id)
      if (!exec) return null
      const nodeStates = await ctx.executionStore.getNodeStates(args.id)
      return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: exec.completedAt?.toISOString() ?? null, nodeStates }
    },
    flowExecutions: async (_: unknown, args: { flowId: string }, ctx: GraphQLContext) => {
      if (!ctx.executionStore) return []
      const execs = await ctx.executionStore.listExecutions(args.flowId)
      return execs.map((e) => ({ ...e, startedAt: e.startedAt.toISOString(), completedAt: e.completedAt?.toISOString() ?? null, nodeStates: [] }))
    }
  },
  Mutation: {
    startConversation: async (
      _: unknown,
      args: { workspaceId: string; question: string; kbId?: string | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const record = await ctx.conversationStore.startConversation(
          args.workspaceId,
          ctx.userId,
          args.question,
          args.kbId ?? undefined
        )
        const metadata = conversationMetadataSchema.parse(record.metadata)
        return {
          metadata: {
            ...metadata,
            createdAt: metadata.createdAt.toISOString(),
            updatedAt: metadata.updatedAt.toISOString()
          },
          graph: record.graph,
          knowledgeEvidence: record.knowledgeEvidence ?? [],
          citations: record.citations ?? []
        }
      })
    },
    approveDecision: async (
      _: unknown,
      args: { conversationId: string; decision?: string | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => (
        await ctx.conversationStore.approveDecision(
          args.conversationId,
          ctx.userId,
          args.decision ?? undefined
        )
      ))
    },
    /**
     * Phase 2.6 · HITL resume.
     *
     * Validates the decision string ([ACCEPTED] / [EDIT_PLAN][<dim>]:<body> /
     * [REJECTED]) and routes through `conversationStore.approveDecision`,
     * which (a) resolves the in-memory awaiter so the streaming `for await`
     * loop continues and (b) dual-writes to the PG HITL store for cross-
     * instance / post-restart visibility.
     *
     * The parsed directive is also picked up by the conversation-store's
     * stream loop (after `waitForDecisionApproval` returns) and forwarded to
     * `BusinessLangGraphService.setHitlResumeDirective`, where the supervisor
     * consumes it on the next revision round to either halt the critic loop
     * or scope revision to a single BMC dimension's owning agent.
     */
    resumeConversation: async (
      _: unknown,
      args: { conversationId: string; decision: string },
      ctx: GraphQLContext
    ): Promise<{ ok: boolean; decisionKind: string; message?: string }> => {
      const directive = parseHitlDecision(args.decision)
      if (directive.kind === 'invalid') {
        return { ok: false, decisionKind: 'invalid', message: directive.reason }
      }
      const found = await ctx.conversationStore.approveDecision(
        args.conversationId,
        ctx.userId,
        directive.raw
      )
      if (!found) {
        return {
          ok: false,
          decisionKind: directive.kind,
          message: 'no pending HITL approval for this conversation'
        }
      }
      const message = directive.kind === 'edit_plan' && directive.dimension
        ? `revision scoped to ${directive.dimension}`
        : directive.kind === 'edit_plan'
          ? 'full revision round will run'
          : 'critic loop halted'
      return { ok: true, decisionKind: directive.kind, message }
    },
    appendConversationMessage: async (
      _: unknown,
      args: {
        input: {
          conversationId: string
          workspaceId: string
          role: string
          content: string
          metadata?: Record<string, unknown> | null
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const message = await ctx.conversationStore.appendConversationMessage({
          conversationId: args.input.conversationId,
          workspaceId: args.input.workspaceId,
          role: args.input.role,
          content: args.input.content,
          metadata: args.input.metadata ?? undefined
        }, ctx.userId)
        return conversationMessageSchema.parse(message)
      })
    },
    createMemoryItem: async (
      _: unknown,
      args: {
        input: {
          workspaceId: string
          scope?: string | null
          kind?: string | null
          title: string
          content: string
          sourceType?: string | null
          sourceId?: string | null
          importance?: number | null
          confidence?: number | null
          tags?: string[] | null
          metadata?: Record<string, unknown> | null
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const memory = await ctx.conversationStore.createMemoryItem({
          workspaceId: args.input.workspaceId,
          scope: args.input.scope,
          kind: args.input.kind,
          title: args.input.title,
          content: args.input.content,
          sourceType: args.input.sourceType ?? undefined,
          sourceId: args.input.sourceId ?? undefined,
          importance: args.input.importance ?? undefined,
          confidence: args.input.confidence ?? undefined,
          tags: args.input.tags ?? undefined,
          metadata: args.input.metadata ?? undefined
        }, ctx.userId)
        return memoryItemSchema.parse(memory)
      })
    },
    extractConversationMemory: async (
      _: unknown,
      args: { conversationId: string },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const memories = await ctx.conversationStore.extractConversationMemory(args.conversationId, ctx.userId)
        return memories.map((memory) => memoryItemSchema.parse(memory))
      })
    },
    addNode: async (
      _: unknown,
      args: {
        workspaceId: string
        input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => (
        await ctx.conversationStore.addNode(args.workspaceId, ctx.userId, args.input)
      ))
    },
    connectNodes: async (
      _: unknown,
      args: {
        workspaceId: string
        input: { id?: string; source: string; target: string; label?: string | null }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => (
        await ctx.conversationStore.connectNodes(args.workspaceId, ctx.userId, args.input)
      ))
    },
    createKnowledgeBase: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write')
        return await createKnowledgeBase(args.workspaceId)
      })
    },
    publishKnowledgeBase: async (_: unknown, args: { workspaceId: string; kbId: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.publish')
        return await publishKnowledgeBase(args.workspaceId, args.kbId)
      })
    },
    addKnowledgeSeed: async (_: unknown, args: { workspaceId: string; kbId: string; text: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write')
        return await addKnowledgeSeed(args.workspaceId, args.kbId, args.text)
      })
    },
    importKnowledgeUrl: async (_: unknown, args: { workspaceId: string; kbId: string; url: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write')
        return await importKnowledgeUrl(args.workspaceId, args.kbId, args.url)
      })
    },
    saveCommunityPost: async (
      _: unknown,
      args: {
        input: {
          workspaceId: string
          title: string
          body: string
          tags: string[]
          authorName: string
          authorRole?: string | null
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const input = communityPostInputSchema.parse(args.input)
        const asset = await ctx.conversationStore.saveCommunityPost(input, ctx.userId)
        return workspaceAssetSchema.parse(asset)
      })
    },
    savePracticeSession: async (
      _: unknown,
      args: {
        input: {
          workspaceId: string
          scenarioId: string
          scenarioTitle?: string | null
          messages: Array<{
            id: string
            role: string
            content: string
            timestamp: number
            feedback?: string | null
          }>
          insights?: Array<{ title: string; detail: string }>
          resources?: Array<{ title: string; url?: string | null }>
          quickReplies?: string[]
          lastUpdated?: string | null
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const input = practiceSessionInputSchema.parse({
          ...args.input,
          scenarioTitle: args.input.scenarioTitle ?? undefined,
          insights: args.input.insights ?? [],
          resources: (args.input.resources ?? []).map((resource) => ({
            ...resource,
            url: resource.url ?? undefined
          })),
          quickReplies: args.input.quickReplies ?? [],
          lastUpdated: args.input.lastUpdated ?? undefined,
          messages: args.input.messages.map((message) => ({
            ...message,
            feedback: message.feedback ?? undefined
          }))
        })
        const asset = await ctx.conversationStore.savePracticeSession(input, ctx.userId)
        return workspaceAssetSchema.parse(asset)
      })
    },
    // ── Flow mutations ─────────────────────────────
    createFlow: async (_: unknown, args: { workspaceId: string; name: string; definition: FlowDefinition }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        if (!ctx.flowStore) throw new Error('Flow store not available')
        const flow = await ctx.flowStore.createFlow(args.workspaceId, args.name, args.definition, ctx.userId)
        return toFlowGQL(flow)
      })
    },
    updateFlow: async (_: unknown, args: { id: string; name?: string; definition?: FlowDefinition }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        if (!ctx.flowStore) throw new Error('Flow store not available')
        const flow = await ctx.flowStore.updateFlow(args.id, { name: args.name ?? undefined, definition: args.definition ?? undefined })
        if (!flow) throw new GraphQLError('Flow not found')
        return toFlowGQL(flow)
      })
    },
    deleteFlow: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      if (!ctx.flowStore) return false
      return await ctx.flowStore.deleteFlow(args.id)
    },
    saveAsTemplate: async (_: unknown, args: { flowId: string; name: string }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        if (!ctx.flowStore) throw new Error('Flow store not available')
        const flow = await ctx.flowStore.saveAsTemplate(args.flowId, args.name)
        if (!flow) throw new GraphQLError('Source flow not found')
        return toFlowGQL(flow)
      })
    },
    executeFlow: async (_: unknown, args: { flowId: string; inputs?: Record<string, unknown> }, ctx: GraphQLContext) => {
      return await resolveOrThrow(async () => {
        if (!ctx.flowStore || !ctx.executionStore || !ctx.graphCompiler || !ctx.graphExecutor) {
          throw new Error('Execution infrastructure not available')
        }
        const flowStore = ctx.flowStore
        const executionStore = ctx.executionStore
        const graphCompiler = ctx.graphCompiler
        const graphExecutor = ctx.graphExecutor
        const flowRecord = await flowStore.getFlow(args.flowId)
        if (!flowRecord) throw new GraphQLError('Flow not found')

        const plan = graphCompiler.compile(flowRecord.definition)
        const exec = await executionStore.createExecution(args.flowId, args.inputs ?? {})
        await executionStore.updateExecutionStatus(exec.id, 'running')

        // Run in background
        const execCtx = { workspaceId: flowRecord.workspaceId, userId: ctx.userId, executionId: exec.id, abortController: new AbortController() }
        void (async () => {
          try {
            for await (const event of graphExecutor.execute(plan, args.inputs ?? {}, execCtx)) {
              publishExecutionEvent(exec.id, event)
              if (event.type === 'node_complete') {
                await executionStore.updateNodeState(exec.id, event.nodeId, 'completed', event.output, undefined, event.duration)
              } else if (event.type === 'node_error') {
                await executionStore.updateNodeState(exec.id, event.nodeId, 'failed', undefined, event.error)
              } else if (event.type === 'flow_complete') {
                await executionStore.updateExecutionStatus(exec.id, 'completed', event.finalState)
              }
            }
          } catch (err) {
            await executionStore.updateExecutionStatus(exec.id, 'failed', undefined, err instanceof Error ? err.message : String(err))
          }
        })()

        return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: null, nodeStates: [] }
      })
    },
    cancelExecution: async (_: unknown, args: { executionId: string }, ctx: GraphQLContext) => {
      if (!ctx.executionStore) return false
      await ctx.executionStore.updateExecutionStatus(args.executionId, 'cancelled')
      return true
    },
    updateWorkspaceMetadata: async (
      _: unknown,
      args: {
        input: {
          workspaceId: string
          name: string
          type: string
          focus: string
          ownerId: string
          ownerName: string
          members: Array<{
            id: string
            name: string
            role?: string | null
            permissions: string[]
          }>
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const input = workspaceMetadataUpdateInputSchema.parse({
          ...args.input,
          members: args.input.members.map((member) => ({
            ...member,
            role: member.role ?? undefined
          }))
        })
        const workspace = await ctx.conversationStore.updateWorkspace(input, ctx.userId)
        return workspaceDirectoryItemSchema.parse(workspace)
      })
    },

    // ── Ideation Coach mutations (Wave F.6 + F.7) ──────────────────
    // Mirror the existing apps/web Next.js routes at
    //   /api/ideation/reflect
    //   /api/ideation/wizard-step
    // via the shared @starlink/shared/ideation-coach module. Both
    // surfaces consume the same prompt + parser. Frontend can use
    // either; benchmark consumers / future mobile clients use this
    // GraphQL surface.
    reflectOnIdeation: async (
      _: unknown,
      args: {
        input: {
          event: {
            type: string
            kind?: string | null
            label?: string | null
            fromKind?: string | null
            toKind?: string | null
          }
          canvas: {
            nodes: Array<{ id: string; kind: string; label: string; content: string }>
            edgeCount: number
            nodeCountByKind: Record<string, number>
          }
          recentChat: Array<{ role: string; content: string }>
          firedMetaIds: string[]
          workspaceId?: string | null
        }
      },
      context: GraphQLContext
    ) => {
      // Cast to ReflectionRequest — Apollo strips the GraphQL types;
      // shared Zod will reject anything malformed downstream, but this
      // resolver only does the bare adaptation.
      const baseReq = args.input as unknown as Parameters<typeof reflectOnIdeation>[0]
      // User-skill block: server-fetched (never trusted from client).
      // Skip fetch when workspaceId / userId missing — both layers of the
      // skill query require them. Build helper returns '' on any failure
      // (no PG, no skills, etc) so the downstream prompt stays identical
      // to the pre-personalization shape.
      const userSkillBlock =
        context.userId && args.input.workspaceId
          ? await buildUserSkillPrompt(
              defaultConversationMemoryStore,
              context.userId,
              args.input.workspaceId,
              args.input.canvas.nodes
                .map((n) => `${n.label}: ${n.content}`)
                .join(' · ')
                .slice(0, 240) || 'reflection'
            )
          : ''
      const req = { ...baseReq, userSkillBlock }
      const result = await reflectOnIdeation(req)
      // Map scaffold "so-what" / "evidence-needed" to their GraphQL enum
      // forms (snake_case) since GraphQL enums can't have hyphens.
      const SCAFFOLD_GQL: Record<string, string> = {
        why: 'why',
        how: 'how',
        'so-what': 'so_what',
        'evidence-needed': 'evidence_needed',
        meta: 'meta'
      }
      return {
        scaffold: SCAFFOLD_GQL[result.scaffold] ?? result.scaffold,
        content: result.content,
        source: result.source,
        latencyMs: result.latencyMs
      }
    },

    processIdeationWizardStep: async (
      _: unknown,
      args: {
        input: {
          step: string
          userAnswer: string
          canvas: {
            nodes: Array<{ id: string; kind: string; label: string; content: string }>
            edgeCount: number
          }
          recentChat: Array<{ role: string; content: string }>
          workspaceId?: string | null
        }
      },
      context: GraphQLContext
    ) => {
      const baseReq = args.input as unknown as Parameters<
        typeof processIdeationWizardStep
      >[0]
      const userSkillBlock =
        context.userId && args.input.workspaceId
          ? await buildUserSkillPrompt(
              defaultConversationMemoryStore,
              context.userId,
              args.input.workspaceId,
              args.input.userAnswer.slice(0, 240) || args.input.step
            )
          : ''
      const req = { ...baseReq, userSkillBlock }
      return await processIdeationWizardStep(req)
    },
    /**
     * Cancel a stale 'running' session. Authorization: caller must own
     * the session (userId match) — we don't allow one user to cancel
     * another user's session even within the same workspace.
     *
     * The session is marked 'failed' with the supplied reason (or a
     * default user-cancellation message). Heartbeat-driven reaper would
     * eventually do this for us when the gateway crashed, but exposing
     * the explicit mutation lets the UI offer "clear stuck session"
     * without waiting for the next reaper tick.
     */
    cancelStaleSession: async (
      _: unknown,
      args: { sessionId: string; reason?: string | null },
      ctx: GraphQLContext
    ) => {
      const session = await defaultConversationMemoryStore.getSession(args.sessionId)
      if (!session) return null
      if (ctx.userId && session.userId !== ctx.userId) {
        throw new GraphQLError('cancelStaleSession: forbidden — session belongs to another user', {
          extensions: { code: 'FORBIDDEN' }
        })
      }
      if (session.status !== 'running') {
        // Already done — return current state for idempotency.
        return session
      }
      const reason = args.reason?.trim() || 'user-cancelled'
      await defaultConversationMemoryStore.failSession(session.id, reason)
      return await defaultConversationMemoryStore.getSession(args.sessionId)
    },
    // @-mention agent (2026-05-04). Routes via ConversationStore.mentionAgent
    // which checks workspace.write, reads current canvas snapshot, and
    // persists any appended nodes via MentionRouter.
    mentionAgent: async (
      _: unknown,
      args: {
        input: {
          workspaceId: string
          conversationId?: string | null
          agentId: string
          message: string
        }
      },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const trimmedMessage = args.input.message?.trim() ?? ''
        if (!trimmedMessage) {
          throw new GraphQLError('mentionAgent: message cannot be empty', {
            extensions: { code: 'BAD_USER_INPUT' }
          })
        }
        const result = await ctx.conversationStore.mentionAgent(
          args.input.workspaceId,
          ctx.userId,
          {
            agentId: args.input.agentId,
            message: trimmedMessage,
            conversationId: args.input.conversationId ?? undefined
          }
        )
        return result
      })
    }
  },
  // ── Flow / Tool resolvers ────────────────────────────────
  // These are merged into Query/Mutation via extend type in type-defs.
  // Apollo merges them automatically.

  Subscription: {
    flowExecutionProgress: {
      subscribe: (_: unknown, args: { executionId: string }) => {
        return pubsub.asyncIterableIterator(FLOW_EXECUTION_PROGRESS)
      },
      resolve: (payload: { flowExecutionProgress: unknown }) => payload.flowExecutionProgress
    },
    conversationProgress: {
      subscribe: async (
        _: unknown,
        args: { workspaceId: string; conversationId?: string | null },
        ctx: GraphQLContext
      ) => {
        return await resolveOrThrow(async () => {
          await ctx.conversationStore.assertConversationScope(
            args.workspaceId,
            ctx.userId,
            args.conversationId ?? undefined
          )
          return ctx.conversationStore.getEventIterator({
            workspaceId: args.workspaceId,
            conversationId: args.conversationId ?? undefined
          })
        })
      },
      resolve: (payload: { conversationProgress: unknown }) => payload.conversationProgress
    }
  }
}

function toFlowGQL(flow: { id: string; workspaceId: string; name: string; description?: string; definition: unknown; isTemplate: boolean; version: number; createdAt: Date; updatedAt: Date }) {
  return {
    id: flow.id,
    workspaceId: flow.workspaceId,
    name: flow.name,
    description: flow.description ?? null,
    definition: flow.definition,
    isTemplate: flow.isTemplate,
    version: flow.version,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString()
  }
}

async function resolveOrThrow<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw toGraphQLError(error)
  }
}

function toGraphQLError(error: unknown): GraphQLError {
  if (error instanceof GraphQLError) return error

  if (error instanceof Error) {
    if (error.message === 'FORBIDDEN_WORKSPACE' || error.message === 'FORBIDDEN_WORKSPACE_METADATA') {
      return new GraphQLError('You do not have permission to access this workspace.', {
        extensions: {
          code: 'FORBIDDEN'
        }
      })
    }

    if (error.message === 'INVALID_CONVERSATION_SCOPE') {
      return new GraphQLError('The conversation does not belong to the requested workspace.', {
        extensions: {
          code: 'BAD_USER_INPUT'
        }
      })
    }

    // DEC-5 soft-lock: surface the active conversation id so the frontend
    // can offer the user "open the active one" instead of just bouncing.
    if (error.name === 'WorkspaceLockError') {
      const lock = error as Error & { workspaceId?: string; activeConversationId?: string }
      return new GraphQLError(
        'This workspace already has an active conversation. Cancel or finish it before starting a new one.',
        {
          extensions: {
            code: 'WORKSPACE_HAS_ACTIVE_CONVERSATION',
            workspaceId: lock.workspaceId,
            activeConversationId: lock.activeConversationId
          }
        }
      )
    }

    return new GraphQLError(error.message)
  }

  return new GraphQLError('Unexpected resolver error')
}
