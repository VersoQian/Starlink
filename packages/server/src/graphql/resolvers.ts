import GraphQLJSON from 'graphql-type-json'
import { conversationMetadataSchema } from '@starlink/shared'
import type { GraphQLContext } from '../context/index.js'

export const resolvers = {
  JSON: GraphQLJSON,
  Query: {
    workspaceGraph: async (_: unknown, args: { workspaceId: string }, ctx: GraphQLContext) => {
      return ctx.conversationStore.getGraph(args.workspaceId)
    },
    conversation: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const record = ctx.conversationStore.getConversation(args.id)
      if (!record) return null
      return {
        metadata: {
          ...record.metadata,
          createdAt: record.metadata.createdAt.toISOString(),
          updatedAt: record.metadata.updatedAt.toISOString()
        },
        graph: record.graph
      }
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
        graph: record.graph
      }
    },
    addNode: async (
      _: unknown,
      args: {
        workspaceId: string
        input: { id?: string; type: string; position: { x: number; y: number }; data: unknown }
      },
      ctx: GraphQLContext
    ) => {
      const node = ctx.conversationStore.addNode(args.workspaceId, args.input)
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
      const edge = ctx.conversationStore.connectNodes(args.workspaceId, args.input)
      return edge
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
