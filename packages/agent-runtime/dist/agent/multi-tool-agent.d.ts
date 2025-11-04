import { type AgentExecutor } from 'langchain/agents';
import type { BaseMessage } from '@langchain/core/messages';
import type { CanvasGraph } from '@branching-chat/shared';
import { type KnowledgeBaseClient } from '../tools/knowledge-base.js';
export type StarlinkAgentContext = {
    workspaceId: string;
    question: string;
    graph?: CanvasGraph;
    userId?: string;
    history?: BaseMessage[];
    knowledgeClient?: KnowledgeBaseClient;
};
export declare function createStarlinkAgentExecutor(context: StarlinkAgentContext): Promise<AgentExecutor>;
export declare function runStarlinkAgentTask(context: StarlinkAgentContext, task: string): Promise<import("@langchain/core/utils/types").ChainValues>;
