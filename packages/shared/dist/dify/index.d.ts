export type DifyWorkflowMode = 'blocking' | 'streaming';
export type DifyPriority = 'low' | 'normal' | 'high';
export type DifyRateLimitIdentifier = 'user' | 'tenant' | 'workflow' | 'ip';
export type DifyRateLimitRule = {
    identifier: DifyRateLimitIdentifier;
    intervalMs: number;
    limit: number;
};
export type DifyQuotaPlan = {
    daily?: number;
    monthly?: number;
};
export type DifyFallbackPlan = {
    workflowId?: string;
    message?: string;
};
export type DifyWorkflowConfig = {
    id: string;
    appId: string;
    apiKey: string;
    mode: DifyWorkflowMode;
    baseUrl?: string;
    description?: string;
    tenantId?: string;
    tags?: string[];
    quota?: DifyQuotaPlan;
    fallback?: DifyFallbackPlan;
    rateLimit?: DifyRateLimitRule[];
    defaultPriority?: DifyPriority;
    auditChannel?: string;
    metadata?: Record<string, string>;
};
export type DifyRetryConfig = {
    attempts: number;
    delayMs?: number;
};
export type DifyWorkflowExecutionRequest = {
    workflowId: string;
    inputs: Record<string, unknown>;
    userId?: string;
    mode?: DifyWorkflowMode;
    stream?: boolean;
    priority?: DifyPriority;
    metricsTag?: string;
    extra?: Record<string, unknown>;
    retry?: DifyRetryConfig;
};
export type DifyBlockingResponse = {
    answer?: string;
    data?: unknown;
    outputs?: Array<{
        text?: string;
        answer?: string;
    }>;
    usage?: {
        total_tokens?: number;
    };
    [key: string]: unknown;
};
export declare class DifyRequestError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly detail?: string | undefined;
    readonly requestId?: string | undefined;
    constructor(status: number, statusText: string, detail?: string | undefined, requestId?: string | undefined);
}
export type DifyClientOptions = {
    baseUrl: string;
    apiKey: string;
    appId?: string;
    fetchImpl?: typeof fetch;
};
export type RunWorkflowOptions = {
    inputs: Record<string, unknown>;
    responseMode?: DifyWorkflowMode;
    user?: string;
    priority?: DifyPriority;
    metricsTag?: string;
    extra?: Record<string, unknown>;
    signal?: AbortSignal;
};
export declare class DifyClient {
    private readonly options;
    private readonly fetchImpl;
    constructor(options: DifyClientOptions);
    runWorkflow(options: RunWorkflowOptions): Promise<DifyBlockingResponse | Response>;
    private resolveUrl;
    private buildHeaders;
    private createMetadata;
}
