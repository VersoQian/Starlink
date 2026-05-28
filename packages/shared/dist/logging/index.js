const auditSinks = [];
export function registerAuditSink(sink) {
    auditSinks.push(sink);
    return () => {
        const i = auditSinks.indexOf(sink);
        if (i >= 0)
            auditSinks.splice(i, 1);
    };
}
export function clearAuditSinksForTest() {
    auditSinks.length = 0;
}
function notifySinks(level, component, event) {
    for (const sink of auditSinks) {
        try {
            sink(level, component, event);
        }
        catch {
            // Defensive: a sink failure must never crash the producing call.
        }
    }
}
export function createAuditLogger(component) {
    const prefix = `[audit:${component}]`;
    return {
        info: (event) => {
            console.info(prefix, formatEvent('INFO', event));
            notifySinks('INFO', component, event);
        },
        warn: (event) => {
            console.warn(prefix, formatEvent('WARN', event));
            notifySinks('WARN', component, event);
        },
        error: (event) => {
            console.error(prefix, formatEvent('ERROR', event));
            notifySinks('ERROR', component, event);
        }
    };
}
function formatEvent(level, event) {
    const payload = {
        level,
        action: event.action,
        userId: event.userId,
        workflowId: event.workflowId,
        requestId: event.requestId,
        durationMs: event.durationMs,
        metadata: event.metadata,
        error: event.error ? serializeError(event.error) : undefined,
        timestamp: new Date().toISOString()
    };
    return JSON.stringify(removeEmpty(payload));
}
function removeEmpty(value) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null));
}
function serializeError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    return typeof error === 'string' ? error : JSON.stringify(error);
}
