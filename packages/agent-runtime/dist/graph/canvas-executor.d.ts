import type { AgentContext, CanvasExecutionResult } from './types.js';
import { type KnowledgeBaseClient } from '../tools/knowledge-base.js';
export type CanvasPipelineOptions = {
    knowledgeClient?: KnowledgeBaseClient;
};
export declare function runCanvasPipeline(context: AgentContext, options?: CanvasPipelineOptions): Promise<CanvasExecutionResult>;
