import GraphQLJSON from 'graphql-type-json';
import { GraphQLError } from 'graphql';
import { communityPostInputSchema, conversationMetadataSchema, practiceSessionInputSchema, workspaceAssetSchema, workspaceDirectoryItemSchema, workspaceMetadataHistoryEntrySchema, workspaceMetadataUpdateInputSchema } from '@starlink/shared';
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
        conversationRuntimeEvents: async (_, args, ctx) => {
            return await ctx.conversationStore.listConversationRuntimeEvents(args.workspaceId, args.conversationId ?? undefined);
        },
        kbTaskStatus: async (_, args, ctx) => {
            const statuses = await ctx.taskEventStore.getTaskStatuses(args.kbId);
            return statuses.map((status) => ({
                ...status,
                workspaceId: args.workspaceId
            }));
        },
        knowledgeBases: async (_, args) => {
            return await listKnowledgeBases(args.workspaceId);
        },
        knowledgeBaseStatus: async (_, args) => {
            return await getKnowledgeBaseStatus(args.workspaceId, args.kbId);
        },
        workspaces: async (_, __, ctx) => {
            const workspaces = await ctx.conversationStore.listWorkspaces(ctx.userId);
            return workspaces.map((workspace) => workspaceDirectoryItemSchema.parse(workspace));
        },
        workspaceAssets: async (_, args, ctx) => {
            const assets = await ctx.conversationStore.listWorkspaceAssets(args.workspaceId);
            return assets.map((asset) => workspaceAssetSchema.parse(asset));
        },
        workspaceMetadataHistory: async (_, args, ctx) => {
            const history = await ctx.conversationStore.listWorkspaceHistory(args.workspaceId);
            return history.map((entry) => workspaceMetadataHistoryEntrySchema.parse(entry));
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
        createKnowledgeBase: async (_, args) => {
            return await createKnowledgeBase(args.workspaceId);
        },
        publishKnowledgeBase: async (_, args) => {
            return await publishKnowledgeBase(args.workspaceId, args.kbId);
        },
        addKnowledgeSeed: async (_, args) => {
            return await addKnowledgeSeed(args.workspaceId, args.kbId, args.text);
        },
        importKnowledgeUrl: async (_, args) => {
            return await importKnowledgeUrl(args.workspaceId, args.kbId, args.url);
        },
        saveCommunityPost: async (_, args, ctx) => {
            const input = communityPostInputSchema.parse(args.input);
            const asset = await ctx.conversationStore.saveCommunityPost(input, ctx.userId);
            return workspaceAssetSchema.parse(asset);
        },
        savePracticeSession: async (_, args, ctx) => {
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
            });
            const asset = await ctx.conversationStore.savePracticeSession(input, ctx.userId);
            return workspaceAssetSchema.parse(asset);
        },
        updateWorkspaceMetadata: async (_, args, ctx) => {
            const input = workspaceMetadataUpdateInputSchema.parse({
                ...args.input,
                members: args.input.members.map((member) => ({
                    ...member,
                    role: member.role ?? undefined
                }))
            });
            try {
                const workspace = await ctx.conversationStore.updateWorkspace(input, ctx.userId);
                return workspaceDirectoryItemSchema.parse(workspace);
            }
            catch (error) {
                if (error instanceof Error && error.message === 'FORBIDDEN_WORKSPACE_METADATA') {
                    throw new GraphQLError('You do not have permission to manage this workspace.', {
                        extensions: {
                            code: 'FORBIDDEN'
                        }
                    });
                }
                throw error;
            }
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
