export type AuditEvent = {
  action: string
  userId?: string
  workflowId?: string
  requestId?: string
  metadata?: Record<string, unknown>
  durationMs?: number
}

export type AuditLogger = {
  info: (event: AuditEvent) => void
  warn: (event: AuditEvent) => void
  error: (event: AuditEvent & { error?: unknown }) => void
}

export function createAuditLogger(component: string): AuditLogger {
  const prefix = `[audit:${component}]`
  return {
    info: (event) => console.info(prefix, formatEvent('INFO', event)),
    warn: (event) => console.warn(prefix, formatEvent('WARN', event)),
    error: (event) => console.error(prefix, formatEvent('ERROR', event))
  }
}

function formatEvent(level: string, event: AuditEvent & { error?: unknown }) {
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
  }
  return JSON.stringify(removeEmpty(payload))
}

function removeEmpty<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  ) as Partial<T>
}

function serializeError(error: unknown): Record<string, unknown> | string {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}
