import { type DifyPriority, type DifyRetryConfig, type DifyWorkflowMode } from '@starlink/shared';
type RunWorkflowOptions = {
    workflowId?: string;
    inputs: Record<string, unknown>;
    user?: string;
    responseMode?: DifyWorkflowMode;
    signal?: AbortSignal;
    priority?: DifyPriority;
    metricsTag?: string;
    retry?: DifyRetryConfig;
};
type BlockingResult = {
    answer?: string;
    outputs?: Array<{
        text?: string;
        answer?: string;
    }>;
    data?: unknown;
    [key: string]: unknown;
};
export declare class DifyServerService {
    private readonly config;
    constructor(config?: {
        baseUrl?: string;
        workflowId?: string;
        apiKey?: string;
    });
    isConfigured(): boolean;
    runWorkflow(options: RunWorkflowOptions): Promise<BlockingResult | Response>;
    generateSummary(question: string, user?: string): Promise<string>;
    private resolveBaseUrl;
    private resolveWorkflowId;
    private resolveApiKey;
}
export {};
