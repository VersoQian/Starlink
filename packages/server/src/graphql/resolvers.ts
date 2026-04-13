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
import type { GraphQLContext } from '../context/index.js'
import {
  addKnowledgeSeed,
  createKnowledgeBase,
  getKnowledgeBaseStatus,
  importKnowledgeUrl,
  listKnowledgeBases,
  publishKnowledgeBase
} from '../services/kb-task-service.js'

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
    }
  },
  Mutation: {
    startConversation: async (
      _: unknown,
      args: { workspaceId: string; question: string },
      ctx: GraphQLContext
    ) => {
      return await resolveOrThrow(async () => {
        const record = await ctx.conversationStore.startConversation(
          args.workspaceId,
          ctx.userId,
          args.question
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
  Subscription: {
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
