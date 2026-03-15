import { nanoid } from 'nanoid';
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@starlink/shared';
import { BusinessLangGraphService } from '../services/business-langgraph.js';
import { loadPersistedGraph, persistCanvasGraph } from './canvas-persistence.js';
import { getWorkspaceMetadata, listWorkspaceMetadata, listWorkspaceMetadataHistory, resolveViewerPermissions, updateWorkspaceMetadata } from './workspace-metadata-store.js';
const businessLangGraphService = new BusinessLangGraphService();
export class ConversationStore {
    constructor({ eventBus, runtimeRepository }) {
        this.pendingDecisionApprovals = new Map();
        this.hitlEnabled = process.env.HITL_ENABLED === 'true';
        this.hitlApprovalTimeoutMs = Number(process.env.HITL_APPROVAL_TIMEOUT_MS ?? '600000');
        this.eventBus = eventBus;
        this.runtimeRepository = runtimeRepository;
    }
    async startConversation(workspaceId, userId, question) {
        const id = nanoid();
        const startedAt = new Date();
        const metadata = {
            id,
            createdAt: startedAt,
            updatedAt: startedAt,
            status: 'running',
            latestQuestion: question
        };
        const record = {
            metadata,
            graph: {
                workspaceId,
                nodes: [],
                edges: []
            },
            knowledgeEvidence: []
        };
        await this.runtimeRepository.createConversation(id, record);
        await this.runtimeRepository.setWorkspaceGraph(workspaceId, record.graph);
        const stream = businessLangGraphService.streamConversation({
            workspaceId,
            userId,
            question,
            traceId: id
        });
        let initialized = false;
        try {
            const initResult = await stream.next();
            if (!initResult.done && initResult.value?.type === 'init') {
                initialized = true;
                const currentGraph = initResult.value.graph;
                record.graph = currentGraph;
                await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph);
                await this.runtimeRepository.updateConversation(id, record);
                await this.persistGraphState(currentGraph);
                const baseEvent = {
                    type: 'graph/appended',
                    conversationId: id,
                    payload: currentGraph
                };
                await this.publishEvent(baseEvent);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const failedEvent = {
                type: 'status',
                conversationId: id,
                status: 'failed',
                message
            };
            await this.publishEvent(failedEvent);
            record.metadata = {
                ...record.metadata,
                status: 'failed',
                updatedAt: new Date()
            };
            await this.runtimeRepository.updateConversation(id, record);
            return record;
        }
        setTimeout(() => {
            void this.runConversationStream({
                stream,
                record,
                workspaceId,
                conversationId: id,
                initialized
            });
        }, 0);
        return record;
    }
    async getConversation(id) {
        const record = await this.runtimeRepository.getConversation(id);
        if (!record)
            return null;
        const metadata = conversationMetadataSchema.parse(record.metadata);
        return {
            ...record,
            metadata
        };
    }
    async getGraph(workspaceId) {
        const manualGraph = await this.runtimeRepository.getWorkspaceGraph(workspaceId);
        if (manualGraph) {
            return {
                workspaceId: manualGraph.workspaceId,
                nodes: [...manualGraph.nodes],
                edges: [...manualGraph.edges]
            };
        }
        const workspaceConversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId);
        const existing = workspaceConversations[0]?.record;
        if (existing) {
            await this.runtimeRepository.setWorkspaceGraph(workspaceId, existing.graph);
            return {
                workspaceId,
                nodes: [...existing.graph.nodes],
                edges: [...existing.graph.edges]
            };
        }
        const persistedGraph = await loadPersistedGraph(workspaceId);
        if (persistedGraph) {
            await this.runtimeRepository.setWorkspaceGraph(workspaceId, persistedGraph);
            return {
                workspaceId,
                nodes: [...persistedGraph.nodes],
                edges: [...persistedGraph.edges]
            };
        }
        const emptyGraph = {
            workspaceId,
            nodes: [],
            edges: []
        };
        await this.runtimeRepository.setWorkspaceGraph(workspaceId, emptyGraph);
        return emptyGraph;
    }
    async listWorkspaces(userId) {
        const workspaces = await this.runtimeRepository.listWorkspaces();
        const metadataRecords = await listWorkspaceMetadata();
        const runtimeById = new Map(workspaces.map((workspace) => [workspace.workspaceId, workspace]));
        const knownIds = new Set([
            ...metadataRecords.map((item) => item.workspaceId),
            ...workspaces.map((item) => item.workspaceId)
        ]);
        return await Promise.all([...knownIds].map(async (workspaceId) => {
            const metadata = await getWorkspaceMetadata(workspaceId);
            const runtime = runtimeById.get(workspaceId);
            const viewerPermissions = resolveViewerPermissions(userId, metadata.members);
            return {
                workspaceId,
                name: metadata.name,
                type: metadata.type,
                focus: metadata.focus,
                ownerId: metadata.ownerId,
                ownerName: metadata.ownerName,
                members: metadata.members,
                viewerPermissions,
                canManage: viewerPermissions.includes('workspace.manage'),
                status: runtime?.status ?? 'draft',
                updatedAt: runtime?.updatedAt ?? new Date().toISOString()
            };
        }));
    }
    async listWorkspaceHistory(workspaceId) {
        return await listWorkspaceMetadataHistory(workspaceId);
    }
    async updateWorkspace(input, userId) {
        const currentMetadata = await getWorkspaceMetadata(input.workspaceId);
        const viewerPermissions = resolveViewerPermissions(userId, currentMetadata.members);
        if (!viewerPermissions.includes('workspace.manage')) {
            throw new Error('FORBIDDEN_WORKSPACE_METADATA');
        }
        const { workspace: metadata } = await updateWorkspaceMetadata(input, userId);
        const runtime = (await this.runtimeRepository.listWorkspaces()).find((workspace) => workspace.workspaceId === input.workspaceId);
        const nextViewerPermissions = resolveViewerPermissions(userId, metadata.members);
        return {
            workspaceId: metadata.workspaceId,
            name: metadata.name,
            type: metadata.type,
            focus: metadata.focus,
            ownerId: metadata.ownerId,
            ownerName: metadata.ownerName,
            members: metadata.members,
            viewerPermissions: nextViewerPermissions,
            canManage: nextViewerPermissions.includes('workspace.manage'),
            status: runtime?.status ?? 'draft',
            updatedAt: runtime?.updatedAt ?? new Date().toISOString()
        };
    }
    async listWorkspaceAssets(workspaceId) {
        return await this.runtimeRepository.listWorkspaceAssets(workspaceId);
    }
    async saveCommunityPost(input, userId) {
        const createdAt = new Date().toISOString();
        const postId = nanoid();
        const asset = {
            assetId: `community:${postId}`,
            workspaceId: input.workspaceId,
            assetType: 'community-post',
            title: input.title,
            sourceModule: 'community',
            sourceTaskId: null,
            metadata: {
                tags: input.tags,
                authorName: input.authorName,
                authorRole: input.authorRole ?? null
            },
            content: {
                id: postId,
                workspaceId: input.workspaceId,
                title: input.title,
                body: input.body,
                tags: input.tags,
                authorName: input.authorName,
                authorRole: input.authorRole ?? null,
                createdAt
            },
            version: 1,
            status: 'published',
            createdBy: userId,
            createdAt,
            updatedAt: createdAt
        };
        await this.runtimeRepository.upsertWorkspaceAsset(asset);
        return asset;
    }
    async savePracticeSession(input, userId) {
        const updatedAt = input.lastUpdated ?? new Date().toISOString();
        const assetId = `practice:${input.workspaceId}:${input.scenarioId}`;
        const current = (await this.runtimeRepository.listWorkspaceAssets(input.workspaceId))
            .find((asset) => asset.assetId === assetId);
        const asset = {
            assetId,
            workspaceId: input.workspaceId,
            assetType: 'practice-output',
            title: input.scenarioTitle?.trim() ? `Practice Session · ${input.scenarioTitle}` : `Practice Session · ${input.scenarioId}`,
            sourceModule: 'practice',
            sourceTaskId: null,
            metadata: {
                scenarioId: input.scenarioId,
                messageCount: input.messages.length,
                insightCount: input.insights.length,
                resourceCount: input.resources.length
            },
            content: {
                scenarioId: input.scenarioId,
                scenarioTitle: input.scenarioTitle ?? null,
                messages: input.messages,
                insights: input.insights,
                resources: input.resources,
                quickReplies: input.quickReplies,
                lastUpdated: updatedAt
            },
            version: Math.max(current?.version ?? 0, input.messages.length),
            status: input.messages.length > 1 ? 'ready' : 'draft',
            createdBy: current?.createdBy ?? userId,
            createdAt: current?.createdAt ?? updatedAt,
            updatedAt
        };
        await this.runtimeRepository.upsertWorkspaceAsset(asset);
        return asset;
    }
    async addNode(workspaceId, input) {
        const id = input.id ?? nanoid();
        const parsed = canvasNodeSchema.parse({
            id,
            type: input.type,
            position: input.position,
            data: input.data
        });
        const baseGraph = await this.getGraph(workspaceId);
        const updatedNodes = [...baseGraph.nodes.filter((node) => node.id !== parsed.id), parsed];
        const updatedGraph = {
            workspaceId,
            nodes: updatedNodes,
            edges: baseGraph.edges
        };
        await this.runtimeRepository.setWorkspaceGraph(workspaceId, updatedGraph);
        await this.persistGraphState(updatedGraph);
        const conversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId);
        for (const item of conversations) {
            const nextRecord = {
                ...item.record,
                graph: {
                    ...item.record.graph,
                    nodes: updatedNodes
                }
            };
            await this.runtimeRepository.updateConversation(item.id, nextRecord);
        }
        return parsed;
    }
    async connectNodes(workspaceId, input) {
        const id = input.id ?? nanoid();
        const parsed = canvasEdgeSchema.parse({
            id,
            source: input.source,
            target: input.target,
            label: input.label ?? null
        });
        const baseGraph = await this.getGraph(workspaceId);
        const updatedEdges = [...baseGraph.edges.filter((edge) => edge.id !== parsed.id), parsed];
        const updatedGraph = {
            workspaceId,
            nodes: baseGraph.nodes,
            edges: updatedEdges
        };
        await this.runtimeRepository.setWorkspaceGraph(workspaceId, updatedGraph);
        await this.persistGraphState(updatedGraph);
        const conversations = await this.runtimeRepository.getConversationsByWorkspace(workspaceId);
        for (const item of conversations) {
            const nextRecord = {
                ...item.record,
                graph: {
                    ...item.record.graph,
                    edges: updatedEdges
                }
            };
            await this.runtimeRepository.updateConversation(item.id, nextRecord);
        }
        return parsed;
    }
    async persistGraphState(graph) {
        try {
            await persistCanvasGraph(graph);
        }
        catch (error) {
            console.error('Failed to persist canvas graph', error);
        }
    }
    getEventIterator() {
        return this.eventBus.getEventIterator();
    }
    async close() {
        for (const approval of this.pendingDecisionApprovals.values()) {
            if (approval.timeout) {
                clearTimeout(approval.timeout);
            }
        }
        this.pendingDecisionApprovals.clear();
        await this.runtimeRepository.close();
        await this.eventBus.close();
    }
    async approveDecision(conversationId, decision) {
        const pending = this.pendingDecisionApprovals.get(conversationId);
        if (!pending) {
            return false;
        }
        const nextDecision = (decision ?? '').trim() || pending.decision;
        pending.resolve(nextDecision);
        return true;
    }
    async runConversationStream(options) {
        console.log('🎬 [runConversationStream] Starting background stream processing...');
        let { stream, record, workspaceId, conversationId, initialized } = options;
        let currentGraph = record.graph;
        const emittedTurnNodeIds = new Set();
        let currentPhase = null;
        let latestDecision = '';
        const publishEvent = async (event) => {
            await this.publishEvent(event);
        };
        const publishPhaseChanged = async (phase, reason) => {
            if (currentPhase === phase)
                return;
            currentPhase = phase;
            await publishEvent({
                type: 'phase.changed',
                conversationId,
                payload: {
                    workspaceId,
                    phase,
                    reason: reason ?? null,
                    occurredAt: new Date().toISOString()
                }
            });
        };
        const publishSeminarTurn = async (payload) => {
            await publishEvent({
                type: 'seminar.turn.completed',
                conversationId,
                payload: {
                    workspaceId,
                    phase: payload.phase,
                    agentId: payload.agentId,
                    agentName: payload.agentName,
                    nodeId: payload.nodeId,
                    title: payload.title,
                    summary: payload.summary,
                    occurredAt: new Date().toISOString()
                }
            });
        };
        await publishPhaseChanged('planning', 'conversation.started');
        try {
            console.log('🔄 [runConversationStream] Iterating stream updates...');
            for await (const update of stream) {
                if (update.type === 'init') {
                    currentGraph = update.graph;
                    record.graph = currentGraph;
                    await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph);
                    await this.persistGraphState(currentGraph);
                    record.knowledgeEvidence = update.knowledgeEvidence ?? [];
                    await this.runtimeRepository.updateConversation(conversationId, record);
                    if (!initialized) {
                        initialized = true;
                        const appendedEvent = {
                            type: 'graph/appended',
                            conversationId,
                            payload: currentGraph
                        };
                        await this.publishEvent(appendedEvent);
                    }
                    continue;
                }
                if (update.type === 'delta') {
                    currentGraph = applyGraphDelta(currentGraph, update.delta);
                    record.graph = currentGraph;
                    await this.runtimeRepository.setWorkspaceGraph(workspaceId, currentGraph);
                    await this.runtimeRepository.updateConversation(conversationId, record);
                    await this.persistGraphState(currentGraph);
                    const event = initialized
                        ? {
                            type: 'graph/diff',
                            conversationId,
                            payload: { nodes: update.delta.nodes, edges: update.delta.edges }
                        }
                        : {
                            type: 'graph/appended',
                            conversationId,
                            payload: currentGraph
                        };
                    await publishEvent(event);
                    initialized = true;
                    const deltaNodes = update.delta.nodes ?? [];
                    for (const node of deltaNodes) {
                        const info = extractRuntimeInfo(node);
                        if (!info)
                            continue;
                        await publishPhaseChanged(info.stage, `from.${info.agentName}`);
                        if (!emittedTurnNodeIds.has(node.id)) {
                            emittedTurnNodeIds.add(node.id);
                            await publishSeminarTurn({
                                phase: info.stage,
                                agentId: info.agentId,
                                agentName: info.agentName,
                                nodeId: node.id,
                                title: info.title,
                                summary: info.summary
                            });
                        }
                        if (info.stage === 'decision' && info.summary.trim().length > 0) {
                            latestDecision = info.summary;
                        }
                    }
                    continue;
                }
                if (update.type === 'status') {
                    continue;
                }
            }
            if (!latestDecision) {
                latestDecision = findLatestDecision(currentGraph);
            }
            if (latestDecision) {
                if (this.hitlEnabled) {
                    latestDecision = await this.waitForDecisionApproval({
                        conversationId,
                        workspaceId,
                        decision: latestDecision,
                        record
                    });
                }
                await publishPhaseChanged('decision', 'seminar.final-decision');
                await publishEvent({
                    type: 'seminar.decision.made',
                    conversationId,
                    payload: {
                        workspaceId,
                        phase: 'decision',
                        decision: latestDecision,
                        occurredAt: new Date().toISOString()
                    }
                });
            }
            const completeEvent = {
                type: 'status',
                conversationId,
                status: 'completed'
            };
            await publishEvent(completeEvent);
            record.metadata = {
                ...record.metadata,
                status: 'completed',
                updatedAt: new Date()
            };
            await this.runtimeRepository.updateConversation(conversationId, record);
            console.log('✅ [runConversationStream] Stream completed successfully');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            console.error('❌ [runConversationStream] Stream failed:', message);
            if (stack) {
                console.error('Stack trace:', stack);
            }
            const failedEvent = {
                type: 'status',
                conversationId,
                status: 'failed',
                message
            };
            await publishEvent(failedEvent);
            record.metadata = {
                ...record.metadata,
                status: 'failed',
                updatedAt: new Date()
            };
            await this.runtimeRepository.updateConversation(conversationId, record);
        }
    }
    async publishEvent(event) {
        await this.eventBus.publish(event);
    }
    async waitForDecisionApproval(options) {
        const { conversationId, workspaceId, decision, record } = options;
        await this.publishEvent({
            type: 'seminar.decision.requested',
            conversationId,
            payload: {
                workspaceId,
                phase: 'decision',
                decision,
                occurredAt: new Date().toISOString()
            }
        });
        record.metadata = {
            ...record.metadata,
            status: 'paused',
            updatedAt: new Date()
        };
        await this.runtimeRepository.updateConversation(conversationId, record);
        return await new Promise((resolve) => {
            const finalize = (nextDecision) => {
                const existing = this.pendingDecisionApprovals.get(conversationId);
                if (existing?.timeout) {
                    clearTimeout(existing.timeout);
                }
                this.pendingDecisionApprovals.delete(conversationId);
                resolve(nextDecision);
            };
            const timeout = setTimeout(() => {
                finalize(decision);
            }, this.hitlApprovalTimeoutMs);
            this.pendingDecisionApprovals.set(conversationId, {
                decision,
                timeout,
                resolve: finalize
            });
        });
    }
}
const AGENT_NAME_MAP = {
    Market_Agent: 'Market Agent',
    Product_Agent: 'Product Agent',
    Finance_Agent: 'Finance Agent',
    Adversarial_Critic: 'Critic Agent',
    Orchestrator: 'Orchestrator'
};
function extractRuntimeInfo(node) {
    const data = (node.data ?? {});
    const meta = data.meta;
    const agentId = meta?.metadata?.agent_signature ?? meta?.agentType;
    if (!agentId)
        return null;
    const title = (typeof data.title === 'string' && data.title.trim()) || node.id;
    const summary = typeof data.content === 'string' ? data.content : '';
    const stage = inferPhase(agentId, meta?.macraType, title, summary);
    return {
        stage,
        agentId,
        agentName: AGENT_NAME_MAP[agentId] ?? agentId,
        nodeId: node.id,
        title,
        summary
    };
}
function inferPhase(agentId, macraType, title = '', content = '') {
    const corpus = `${title}\n${content}`;
    if (agentId === 'Adversarial_Critic' || macraType === 'conflict-alert') {
        return 'review';
    }
    if (agentId === 'Orchestrator') {
        if (/规划|计划|路线|拆解|阶段|里程碑/.test(corpus)) {
            return 'planning';
        }
        return 'decision';
    }
    return 'execution';
}
function findLatestDecision(graph) {
    const decisionNodes = graph.nodes
        .map((node) => extractRuntimeInfo(node))
        .filter((item) => item !== null)
        .filter((item) => item.stage === 'decision');
    return decisionNodes[decisionNodes.length - 1]?.summary ?? '';
}
function applyGraphDelta(graph, delta) {
    return {
        workspaceId: graph.workspaceId,
        nodes: mergeById(graph.nodes, delta.nodes),
        edges: mergeById(graph.edges, delta.edges)
    };
}
function mergeById(current, updates) {
    if (!updates || updates.length === 0)
        return current;
    const merged = new Map(current.map((item) => [item.id, item]));
    for (const item of updates) {
        merged.set(item.id, item);
    }
    return [...merged.values()];
}
