import { PubSub } from 'graphql-subscriptions';
import type { CanvasGraph, CanvasNode, ConversationEvent, ConversationMetadata } from '@branching-chat/shared';
export type ConversationStoreDeps = {
    pubSub: PubSub;
};
type ConversationRecord = {
    metadata: ConversationMetadata;
    graph: CanvasGraph;
};
export declare class ConversationStore {
    private readonly conversations;
    private readonly workspaceGraphs;
    private readonly pubSub;
    constructor({ pubSub }: ConversationStoreDeps);
    startConversation(workspaceId: string, userId: string, question: string): Promise<ConversationRecord>;
    getConversation(id: string): ConversationRecord | null;
    getGraph(workspaceId: string): CanvasGraph;
    addNode(workspaceId: string, input: {
        id?: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: unknown;
    }): CanvasNode;
    getEventIterator(): import("graphql-subscriptions/dist/pubsub-async-iterable-iterator.js").PubSubAsyncIterableIterator<{
        conversationProgress: ConversationEvent;
    }>;
}
export {};
