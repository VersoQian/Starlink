export type AuditEvent = {
    action: string;
    userId?: string;
    workflowId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
};
export type AuditLogger = {
    info: (event: AuditEvent) => void;
    warn: (event: AuditEvent) => void;
    error: (event: AuditEvent & {
        error?: unknown;
    }) => void;
};
export declare function createAuditLogger(component: string): AuditLogger;
