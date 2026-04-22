import GraphQLJSON from 'graphql-type-json';
import { GraphQLError } from 'graphql';
import { communityPostInputSchema, conversationMessageSchema, conversationMetadataSchema, conversationSessionSchema, deriveSnippetId, memoryItemSchema, practiceSessionInputSchema, workspaceAssetSchema, workspaceContextSnapshotSchema, workspaceDirectoryItemSchema, workspaceMetadataHistoryEntrySchema, workspaceMetadataUpdateInputSchema } from '@starlink/shared';
import { addKnowledgeSeed, createKnowledgeBase, getKnowledgeBaseStatus, importKnowledgeUrl, listKnowledgeBases, publishKnowledgeBase, searchKnowledgeBase } from '../services/kb-task-service.js';
import { pubsub, FLOW_EXECUTION_PROGRESS, publishExecutionEvent } from './subscriptions.js';
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
                    knowledgeEvidence: record.knowledgeEvidence ?? [],
                    citations: record.citations ?? []
                };
            });
        },
        conversationSessions: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const sessions = await ctx.conversationStore.listConversationSessions(args.workspaceId, ctx.userId, args.limit ?? undefined);
                return sessions.map((session) => conversationSessionSchema.parse(session));
            });
        },
        conversationMessages: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const messages = await ctx.conversationStore.listConversationMessages(args.workspaceId, ctx.userId, args.conversationId, args.limit ?? undefined);
                return messages.map((message) => conversationMessageSchema.parse(message));
            });
        },
        cardsReferencingEvidence: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.getConversation(args.conversationId, ctx.userId);
                if (!record)
                    return [];
                const cardIds = new Set();
                for (const citation of record.citations ?? []) {
                    for (const span of citation.spans) {
                        if (span.refs.some((r) => r.evidenceId === args.evidenceId)) {
                            cardIds.add(citation.cardId);
                            break;
                        }
                    }
                }
                return Array.from(cardIds);
            });
        },
        workspaceMemories: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const memories = await ctx.conversationStore.listWorkspaceMemories(args.workspaceId, ctx.userId, {
                    query: args.query,
                    scope: args.scope,
                    kind: args.kind,
                    limit: args.limit
                });
                return memories.map((memory) => memoryItemSchema.parse(memory));
            });
        },
        workspaceContextSnapshot: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const snapshot = await ctx.conversationStore.buildWorkspaceContextSnapshot(args.workspaceId, ctx.userId, args.query, {
                    conversationId: args.conversationId ?? null,
                    kbId: args.kbId ?? null
                });
                return workspaceContextSnapshotSchema.parse(snapshot);
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
        knowledgeBaseSearch: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                await ctx.conversationStore.assertWorkspaceAccess(args.workspaceId, ctx.userId, 'workspace.read');
                const results = await searchKnowledgeBase(args.workspaceId, args.kbId, args.query, args.topK ?? 5);
                return results.map((result) => ({
                    docId: result.docId,
                    snippet: result.snippet,
                    score: result.score,
                    metadata: {
                        ...(result.metadata ?? {}),
                        snippetId: deriveSnippetId(result.docId, result.metadata, result.snippet)
                    }
                }));
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
        },
        // ── Flow / Tool queries ─────────────────────────────
        availableTools: (_, __, ctx) => {
            if (!ctx.toolRegistry)
                return [];
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
            }));
        },
        toolByName: (_, args, ctx) => {
            if (!ctx.toolRegistry || !ctx.toolRegistry.has(args.name))
                return null;
            const def = ctx.toolRegistry.getTool(args.name).definition;
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
            };
        },
        flows: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return [];
            const flows = await ctx.flowStore.listFlows(args.workspaceId);
            return flows.map(toFlowGQL);
        },
        flow: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return null;
            const flow = await ctx.flowStore.getFlow(args.id);
            return flow ? toFlowGQL(flow) : null;
        },
        flowTemplates: async (_, __, ctx) => {
            if (!ctx.flowStore)
                return [];
            const templates = await ctx.flowStore.listTemplates();
            return templates.map(toFlowGQL);
        },
        flowExecution: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return null;
            const exec = await ctx.executionStore.getExecution(args.id);
            if (!exec)
                return null;
            const nodeStates = await ctx.executionStore.getNodeStates(args.id);
            return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: exec.completedAt?.toISOString() ?? null, nodeStates };
        },
        flowExecutions: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return [];
            const execs = await ctx.executionStore.listExecutions(args.flowId);
            return execs.map((e) => ({ ...e, startedAt: e.startedAt.toISOString(), completedAt: e.completedAt?.toISOString() ?? null, nodeStates: [] }));
        }
    },
    Mutation: {
        startConversation: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const record = await ctx.conversationStore.startConversation(args.workspaceId, ctx.userId, args.question, args.kbId ?? undefined);
                const metadata = conversationMetadataSchema.parse(record.metadata);
                return {
                    metadata: {
                        ...metadata,
                        createdAt: metadata.createdAt.toISOString(),
                        updatedAt: metadata.updatedAt.toISOString()
                    },
                    graph: record.graph,
                    knowledgeEvidence: record.knowledgeEvidence ?? [],
                    citations: record.citations ?? []
                };
            });
        },
        approveDecision: async (_, args, ctx) => {
            return await resolveOrThrow(async () => (await ctx.conversationStore.approveDecision(args.conversationId, ctx.userId, args.decision ?? undefined)));
        },
        appendConversationMessage: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const message = await ctx.conversationStore.appendConversationMessage({
                    conversationId: args.input.conversationId,
                    workspaceId: args.input.workspaceId,
                    role: args.input.role,
                    content: args.input.content,
                    metadata: args.input.metadata ?? undefined
                }, ctx.userId);
                return conversationMessageSchema.parse(message);
            });
        },
        createMemoryItem: async (_, args, ctx) => {
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
                }, ctx.userId);
                return memoryItemSchema.parse(memory);
            });
        },
        extractConversationMemory: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                const memories = await ctx.conversationStore.extractConversationMemory(args.conversationId, ctx.userId);
                return memories.map((memory) => memoryItemSchema.parse(memory));
            });
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
        // ── Flow mutations ─────────────────────────────
        createFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.createFlow(args.workspaceId, args.name, args.definition, ctx.userId);
                return toFlowGQL(flow);
            });
        },
        updateFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.updateFlow(args.id, { name: args.name ?? undefined, definition: args.definition ?? undefined });
                if (!flow)
                    throw new GraphQLError('Flow not found');
                return toFlowGQL(flow);
            });
        },
        deleteFlow: async (_, args, ctx) => {
            if (!ctx.flowStore)
                return false;
            return await ctx.flowStore.deleteFlow(args.id);
        },
        saveAsTemplate: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore)
                    throw new Error('Flow store not available');
                const flow = await ctx.flowStore.saveAsTemplate(args.flowId, args.name);
                if (!flow)
                    throw new GraphQLError('Source flow not found');
                return toFlowGQL(flow);
            });
        },
        executeFlow: async (_, args, ctx) => {
            return await resolveOrThrow(async () => {
                if (!ctx.flowStore || !ctx.executionStore || !ctx.graphCompiler || !ctx.graphExecutor) {
                    throw new Error('Execution infrastructure not available');
                }
                const flowStore = ctx.flowStore;
                const executionStore = ctx.executionStore;
                const graphCompiler = ctx.graphCompiler;
                const graphExecutor = ctx.graphExecutor;
                const flowRecord = await flowStore.getFlow(args.flowId);
                if (!flowRecord)
                    throw new GraphQLError('Flow not found');
                const plan = graphCompiler.compile(flowRecord.definition);
                const exec = await executionStore.createExecution(args.flowId, args.inputs ?? {});
                await executionStore.updateExecutionStatus(exec.id, 'running');
                // Run in background
                const execCtx = { workspaceId: flowRecord.workspaceId, userId: ctx.userId, executionId: exec.id, abortController: new AbortController() };
                void (async () => {
                    try {
                        for await (const event of graphExecutor.execute(plan, args.inputs ?? {}, execCtx)) {
                            publishExecutionEvent(exec.id, event);
                            if (event.type === 'node_complete') {
                                await executionStore.updateNodeState(exec.id, event.nodeId, 'completed', event.output, undefined, event.duration);
                            }
                            else if (event.type === 'node_error') {
                                await executionStore.updateNodeState(exec.id, event.nodeId, 'failed', undefined, event.error);
                            }
                            else if (event.type === 'flow_complete') {
                                await executionStore.updateExecutionStatus(exec.id, 'completed', event.finalState);
                            }
                        }
                    }
                    catch (err) {
                        await executionStore.updateExecutionStatus(exec.id, 'failed', undefined, err instanceof Error ? err.message : String(err));
                    }
                })();
                return { ...exec, startedAt: exec.startedAt.toISOString(), completedAt: null, nodeStates: [] };
            });
        },
        cancelExecution: async (_, args, ctx) => {
            if (!ctx.executionStore)
                return false;
            await ctx.executionStore.updateExecutionStatus(args.executionId, 'cancelled');
            return true;
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
    // ── Flow / Tool resolvers ────────────────────────────────
    // These are merged into Query/Mutation via extend type in type-defs.
    // Apollo merges them automatically.
    Subscription: {
        flowExecutionProgress: {
            subscribe: (_, args) => {
                return pubsub.asyncIterableIterator(FLOW_EXECUTION_PROGRESS);
            },
            resolve: (payload) => payload.flowExecutionProgress
        },
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
function toFlowGQL(flow) {
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
    };
}
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
