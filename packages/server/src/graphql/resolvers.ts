import GraphQLJSON from 'graphql-type-json'
import { GraphQLError } from 'graphql'
import {
  communityPostInputSchema,
  conversationMetadataSchema,
  practiceSessionInputSchema,
  workspaceAssetSchema,
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
  publishKnowledgeBase
} from '../services/kb-task-service.js'
import { pubsub, FLOW_EXECUTION_PROGRESS, publishExecutionEvent } from './subscriptions.js'

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
          knowledgeEvidence: record.knowledgeEvidence ?? []
        }
      })
    },
    conversationRuntimeEvents: async (
      _: unknown,
      args: { workspaceId: string; conversationId?: string | null },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => (
        await ctx.conversationStore.listConversationRuntimeEvents(
          args.workspaceId,
          ctx.userId,
          args.conversationId ?? undefined
        )
      ))
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
          knowledgeEvidence: record.knowledgeEvidence ?? []
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

    return new GraphQLError(error.message)
  }

  return new GraphQLError('Unexpected resolver error')
}
