import GraphQLJSON from 'graphql-type-json'
import { conversationMetadataSchema } from '@starlink/shared'
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
      return await ctx.conversationStore.getGraph(args.workspaceId)
    },
    conversation: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const record = await ctx.conversationStore.getConversation(args.id)
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
    },
    kbTaskStatus: async (_: unknown, args: { kbId: string }, ctx: GraphQLContext) => {
      return await ctx.taskEventStore.getTaskStatuses(args.kbId)
    },
    knowledgeBases: async () => {
      return await listKnowledgeBases()
    },
    knowledgeBaseStatus: async (_: unknown, args: { kbId: string }) => {
      return await getKnowledgeBaseStatus(args.kbId)
    }
  },
  Mutation: {
    startConversation: async (
      _: unknown,
      args: { workspaceId: string; question: string },
      ctx: GraphQLContext
    ) => {
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
    },
    approveDecision: async (
      _: unknown,
      args: { conversationId: string; decision?: string | null },
      ctx: GraphQLContext
    ) => {
      return await ctx.conversationStore.approveDecision(
        args.conversationId,
        args.decision ?? undefined
      )
    },
    addNode: async (
      _: unknown,
      args: {
        workspaceId: string
        input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
      },
      ctx: GraphQLContext
    ) => {
      const node = await ctx.conversationStore.addNode(args.workspaceId, args.input)
      return node
    },
    connectNodes: async (
      _: unknown,
      args: {
        workspaceId: string
        input: { id?: string; source: string; target: string; label?: string | null }
      },
      ctx: GraphQLContext
    ) => {
      const edge = await ctx.conversationStore.connectNodes(args.workspaceId, args.input)
      return edge
    },
    createKnowledgeBase: async () => {
      return await createKnowledgeBase()
    },
    publishKnowledgeBase: async (_: unknown, args: { kbId: string }) => {
      return await publishKnowledgeBase(args.kbId)
    },
    addKnowledgeSeed: async (_: unknown, args: { kbId: string; text: string }) => {
      return await addKnowledgeSeed(args.kbId, args.text)
    },
    importKnowledgeUrl: async (_: unknown, args: { kbId: string; url: string }) => {
      return await importKnowledgeUrl(args.kbId, args.url)
    }
  },
  Subscription: {
    conversationProgress: {
      subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => {
        return ctx.conversationStore.getEventIterator()
      },
      resolve: (payload: { conversationProgress: unknown }) => payload.conversationProgress
    }
  }
}
