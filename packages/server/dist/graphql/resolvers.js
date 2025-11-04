import GraphQLJSON from 'graphql-type-json';
import { conversationMetadataSchema } from '@branching-chat/shared';
export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
        workspaceGraph: async (_, args, ctx) => {
            return ctx.conversationStore.getGraph(args.workspaceId);
        },
        conversation: async (_, args, ctx) => {
            const record = ctx.conversationStore.getConversation(args.id);
            if (!record)
                return null;
            return {
                metadata: {
                    ...record.metadata,
                    createdAt: record.metadata.createdAt.toISOString(),
                    updatedAt: record.metadata.updatedAt.toISOString()
                },
                graph: record.graph
            };
        }
    },
    Mutation: {
        startConversation: async (_, args, ctx) => {
            const record = await ctx.conversationStore.startConversation(args.workspaceId, ctx.userId, args.question);
            const metadata = conversationMetadataSchema.parse(record.metadata);
            return {
                metadata: {
                    ...metadata,
                    createdAt: metadata.createdAt.toISOString(),
                    updatedAt: metadata.updatedAt.toISOString()
                },
                graph: record.graph
            };
        },
        addNode: async (_, args, ctx) => {
            const node = ctx.conversationStore.addNode(args.workspaceId, args.input);
            return node;
        },
        connectNodes: async (_, args, ctx) => {
            const edge = ctx.conversationStore.connectNodes(args.workspaceId, args.input);
            return edge;
        }
    },
    Subscription: {
        conversationProgress: {
            subscribe: (_, __, ctx) => {
                return ctx.conversationStore.getEventIterator();
            },
            resolve: (payload) => payload.conversationProgress
        }
    }
};
