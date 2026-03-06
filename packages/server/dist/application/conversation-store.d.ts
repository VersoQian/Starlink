import type { CanvasEdge, CanvasGraph, CanvasNode, ConversationEvent } from '@starlink/shared';
import type { ConversationEventBus } from './conversation-event-bus.js';
import type { ConversationRecord, ConversationRuntimeRepository } from './conversation-runtime-repository.js';
export type ConversationStoreDeps = {
    eventBus: ConversationEventBus;
    runtimeRepository: ConversationRuntimeRepository;
};
export declare class ConversationStore {
    private readonly eventBus;
    private readonly runtimeRepository;
    private readonly pendingDecisionApprovals;
    private readonly hitlEnabled;
    private readonly hitlApprovalTimeoutMs;
    constructor({ eventBus, runtimeRepository }: ConversationStoreDeps);
    startConversation(workspaceId: string, userId: string, question: string): Promise<ConversationRecord>;
    getConversation(id: string): Promise<ConversationRecord | null>;
    getGraph(workspaceId: string): Promise<CanvasGraph>;
    addNode(workspaceId: string, input: {
        id?: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: unknown;
    }): Promise<CanvasNode>;
    connectNodes(workspaceId: string, input: {
        id?: string;
        source: string;
        target: string;
        label?: string | null;
    }): Promise<CanvasEdge>;
    private persistGraphState;
    getEventIterator(): AsyncIterable<{
        conversationProgress: ConversationEvent;
    }>;
    close(): Promise<void>;
    approveDecision(conversationId: string, decision?: string): Promise<boolean>;
    private runConversationStream;
    private publishEvent;
    private waitForDecisionApproval;
}
