import { nanoid } from 'nanoid';
import { canvasNodeSchema, conversationMetadataSchema } from '@branching-chat/shared';
import { runCanvasPipeline } from '@branching-chat/agent-runtime';
const EVENT_TOPIC = 'conversation-progress';
export class ConversationStore {
    constructor({ pubSub }) {
        this.conversations = new Map();
        this.workspaceGraphs = new Map();
        this.pubSub = pubSub;
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
        const execution = await runCanvasPipeline({ workspaceId, userId, question });
        const record = {
            metadata,
            graph: execution.graph
        };
        this.conversations.set(id, record);
        this.workspaceGraphs.set(workspaceId, execution.graph);
        const baseEvent = {
            type: 'graph/appended',
            conversationId: id,
            payload: execution.graph
        };
        await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: baseEvent });
        for (const delta of execution.deltas) {
            const deltaEvent = {
                type: 'graph/diff',
                conversationId: id,
                payload: {
                    nodes: delta.nodes,
                    edges: delta.edges
                }
            };
            await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: deltaEvent });
        }
        const completeEvent = {
            type: 'status',
            conversationId: id,
            status: 'completed'
        };
        await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: completeEvent });
        record.metadata = {
            ...record.metadata,
            status: 'completed',
            updatedAt: new Date()
        };
        return record;
    }
    getConversation(id) {
        const record = this.conversations.get(id);
        return record ? { ...record, metadata: conversationMetadataSchema.parse(record.metadata) } : null;
    }
    getGraph(workspaceId) {
        const manualGraph = this.workspaceGraphs.get(workspaceId);
        if (manualGraph) {
            return {
                workspaceId: manualGraph.workspaceId,
                nodes: [...manualGraph.nodes],
                edges: [...manualGraph.edges]
            };
        }
        const existing = [...this.conversations.values()].find((conv) => conv.graph.workspaceId === workspaceId);
        if (existing) {
            this.workspaceGraphs.set(workspaceId, existing.graph);
            return {
                workspaceId,
                nodes: [...existing.graph.nodes],
                edges: [...existing.graph.edges]
            };
        }
        const emptyGraph = {
            workspaceId,
            nodes: [],
            edges: []
        };
        this.workspaceGraphs.set(workspaceId, emptyGraph);
        return emptyGraph;
    }
    addNode(workspaceId, input) {
        const id = input.id ?? nanoid();
        const parsed = canvasNodeSchema.parse({
            id,
            type: input.type,
            position: input.position,
            data: input.data
        });
        const graph = this.workspaceGraphs.get(workspaceId) ?? {
            workspaceId,
            nodes: [],
            edges: []
        };
        const updatedNodes = [...graph.nodes.filter((node) => node.id !== parsed.id), parsed];
        const updatedGraph = {
            workspaceId,
            nodes: updatedNodes,
            edges: graph.edges
        };
        this.workspaceGraphs.set(workspaceId, updatedGraph);
        // Also update any conversation record referencing this workspace
        for (const record of this.conversations.values()) {
            if (record.graph.workspaceId === workspaceId) {
                record.graph = {
                    ...record.graph,
                    nodes: updatedNodes
                };
            }
        }
        return parsed;
    }
    getEventIterator() {
        return this.pubSub.asyncIterableIterator(EVENT_TOPIC);
    }
}
