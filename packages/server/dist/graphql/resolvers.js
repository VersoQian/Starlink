import GraphQLJSON from 'graphql-type-json';
import { GraphQLError } from 'graphql';
import { communityPostInputSchema, conversationMetadataSchema, practiceSessionInputSchema, workspaceAssetSchema, workspaceDirectoryItemSchema, workspaceMetadataHistoryEntrySchema, workspaceMetadataUpdateInputSchema } from '@starlink/shared';
import { addKnowledgeSeed, createKnowledgeBase, getKnowledgeBaseStatus, importKnowledgeUrl, listKnowledgeBases, publishKnowledgeBase } from '../services/kb-task-service.js';
export const resolvers = {
    JSON: GraphQLJSON,
    Query: {
        workspaceGraph: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.getGraph(args.workspaceId, ctx.userId)));
        },
        conversation: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.getConversation(args.id, ctx.userId);
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
            });
        },
        conversationRuntimeEvents: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.listConversationRuntimeEvents(args.workspaceId, ctx.userId, args.conversationId ?? undefined)));
        },
        kbTaskStatus: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                const statuses = await ctx.taskEventStore.getTaskStatuses(args.kbId);
                return statuses.map((status) => ({
                    ...status,
                    workspaceId: args.workspaceId
                }));
            });
        },
        knowledgeBases: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await listKnowledgeBases(args.workspaceId);
            });
        },
        knowledgeBaseStatus: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                return await getKnowledgeBaseStatus(args.workspaceId, args.kbId);
            });
        },
        workspaces: async (_, __, ctx) => {
            const workspaces = await ctx.conversationStore.listWorkspaces(ctx.userId);
            return workspaces.map((workspace) => workspaceDirectoryItemSchema.parse(workspace));
        },
        workspaceAssets: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const assets = await ctx.conversationStore.listWorkspaceAssets(args.workspaceId, ctx.userId);
                return assets.map((asset) => workspaceAssetSchema.parse(asset));
            });
        },
        workspaceMetadataHistory: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const history = await ctx.conversationStore.listWorkspaceHistory(args.workspaceId, ctx.userId);
                return history.map((entry) => workspaceMetadataHistoryEntrySchema.parse(entry));
            });
        }
    },
    Mutation: {
        startConversation: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
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
            });
        },
        approveDecision: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.approveDecision(args.conversationId, ctx.userId, args.decision ?? undefined)));
        },
        addNode: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.addNode(args.workspaceId, ctx.userId, args.input)));
        },
        connectNodes: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.connectNodes(args.workspaceId, ctx.userId, args.input)));
        },
        createKnowledgeBase: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await createKnowledgeBase(args.workspaceId);
            });
        },
        publishKnowledgeBase: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.publish');
                return await publishKnowledgeBase(args.workspaceId, args.kbId);
            });
        },
        addKnowledgeSeed: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await addKnowledgeSeed(args.workspaceId, args.kbId, args.text);
            });
        },
        importKnowledgeUrl: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.write');
                return await importKnowledgeUrl(args.workspaceId, args.kbId, args.url);
            });
        },
        saveCommunityPost: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const input = communityPostInputSchema.parse(args.input);
                const asset = await ctx.conversationStore.saveCommunityPost(input, ctx.userId);
                return workspaceAssetSchema.parse(asset);
            });
        },
        savePracticeSession: async (_, args, ctx) => {
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
                });
                const asset = await ctx.conversationStore.savePracticeSession(input, ctx.userId);
                return workspaceAssetSchema.parse(asset);
            });
        },
        updateWorkspaceMetadata: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const input = workspaceMetadataUpdateInputSchema.parse({
                    ...args.input,
                    members: args.input.members.map((member) => ({
                        ...member,
                        role: member.role ?? undefined
                    }))
                });
                const workspace = await ctx.conversationStore.updateWorkspace(input, ctx.userId);
                return workspaceDirectoryItemSchema.parse(workspace);
            });
        }
    },
    Subscription: {
        conversationProgress: {
            subscribe: async (_, args, ctx) => {
                return await resolveOrThrow(async () => {
                    await ctx.conversationStore.assertConversationScope(args.workspaceId, ctx.userId, args.conversationId ?? undefined);
                    return ctx.conversationStore.getEventIterator({
                        workspaceId: args.workspaceId,
                        conversationId: args.conversationId ?? undefined
                    });
                });
            },
            resolve: (payload) => payload.conversationProgress
        }
    }
};
async function resolveOrThrow(operation) {
    try {
        return await operation();
    }
    catch (error) {
        throw toGraphQLError(error);
    }
}
function toGraphQLError(error) {
    if (error instanceof GraphQLError)
        return error;
    if (error instanceof Error) {
        if (error.message === 'FORBIDDEN_WORKSPACE' || error.message === 'FORBIDDEN_WORKSPACE_METADATA') {
            return new GraphQLError('You do not have permission to access this workspace.', {
                extensions: {
                    code: 'FORBIDDEN'
                }
            });
        }
        if (error.message === 'INVALID_CONVERSATION_SCOPE') {
            return new GraphQLError('The conversation does not belong to the requested workspace.', {
                extensions: {
                    code: 'BAD_USER_INPUT'
                }
            });
        }
        return new GraphQLError(error.message);
    }
    return new GraphQLError('Unexpected resolver error');
}
