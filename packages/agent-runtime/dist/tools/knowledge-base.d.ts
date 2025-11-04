import type { CanvasGraph } from '@branching-chat/shared';
export type KnowledgeBaseRequest = {
    workspaceId: string;
    query: string;
};
export type KnowledgeBaseResult = {
    entries: Array<{
        id: string;
        title: string;
        summary: string;
        url?: string;
    }>;
};
export interface KnowledgeBaseClient {
    search(input: KnowledgeBaseRequest): Promise<KnowledgeBaseResult>;
}
export declare class MockKnowledgeBaseClient implements KnowledgeBaseClient {
    search({ query }: KnowledgeBaseRequest): Promise<KnowledgeBaseResult>;
}
export declare function hydrateGraphWithKnowledge(graph: CanvasGraph, knowledge: KnowledgeBaseResult): CanvasGraph;
