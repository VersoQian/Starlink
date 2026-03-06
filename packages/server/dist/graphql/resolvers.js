import GraphQLJSON from 'graphql-type-json';
import { conversationMetadataSchema } from '@starlink/shared';
import { addKnowledgeSeed, createKnowledgeBase, getKnowledgeBaseStatus, importKnowledgeUrl, listKnowledgeBases, publishKnowledgeBase } from '../services/kb-task-service.js';
export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
        workspaceGraph: async (_, args, ctx) => {
            return await ctx.conversationStore.getGraph(args.workspaceId);
        },
        conversation: async (_, args, ctx) => {
            const record = await ctx.conversationStore.getConversation(args.id);
            if (!record)
                return null;
            return {
                metadata: {
                    ...record.metadata,
                    createdAt: record.metadata.createdAt.toISOString(),
                    updatedAt: record.metadata.updatedAt.toISOString()
                },
                graph: record.graph,
                knowledgeEvidence: record.knowledgeEvidence ?? []
            };
        },
        kbTaskStatus: async (_, args, ctx) => {
            return await ctx.taskEventStore.getTaskStatuses(args.kbId);
        },
        knowledgeBases: async () => {
            return await listKnowledgeBases();
        },
        knowledgeBaseStatus: async (_, args) => {
            return await getKnowledgeBaseStatus(args.kbId);
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
                graph: record.graph,
                knowledgeEvidence: record.knowledgeEvidence ?? []
            };
        },
        approveDecision: async (_, args, ctx) => {
            return await ctx.conversationStore.approveDecision(args.conversationId, args.decision ?? undefined);
        },
        addNode: async (_, args, ctx) => {
            const node = await ctx.conversationStore.addNode(args.workspaceId, args.input);
            return node;
        },
        connectNodes: async (_, args, ctx) => {
            const edge = await ctx.conversationStore.connectNodes(args.workspaceId, args.input);
            return edge;
        },
        createKnowledgeBase: async () => {
            return await createKnowledgeBase();
        },
        publishKnowledgeBase: async (_, args) => {
            return await publishKnowledgeBase(args.kbId);
        },
        addKnowledgeSeed: async (_, args) => {
            return await addKnowledgeSeed(args.kbId, args.text);
        },
        importKnowledgeUrl: async (_, args) => {
            return await importKnowledgeUrl(args.kbId, args.url);
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
