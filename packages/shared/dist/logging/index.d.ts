export type AuditEvent = {
    action: string;
    userId?: string;
    workflowId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
    durationMs?: number;
};
export type AuditLevel = 'INFO' | 'WARN' | 'ERROR';
export type AuditLogger = {
    info: (event: AuditEvent) => void;
    warn: (event: AuditEvent) => void;
    error: (event: AuditEvent & {
        error?: unknown;
    }) => void;
};
/**
 * P11.18 · audit-event sink for cross-cutting observers.
 *
 * Receives every audit emission process-wide so that:
 *   - error-aggregator can dedup-and-count WARN/ERROR by fingerprint
 *   - SLO trackers can pick up agent-level signals without coupling
 *     directly to business-langgraph
 *
 * Sinks must be cheap + non-throwing — they run synchronously inside
 * the logger call. We catch sink exceptions defensively so a buggy
 * sink can never crash the producing call site.
 */
export type AuditSink = (level: AuditLevel, component: string, event: AuditEvent & {
    error?: unknown;
}) => void;
export declare function registerAuditSink(sink: AuditSink): () => void;
export declare function clearAuditSinksForTest(): void;
export declare function createAuditLogger(component: string): AuditLogger;
