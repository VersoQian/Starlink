export function createAuditLogger(component) {
  const prefix = `[audit:${component}]`
  return {
    info(event) {
      console.info(prefix, formatEvent('INFO', event))
    },
    warn(event) {
      console.warn(prefix, formatEvent('WARN', event))
    },
    error(event) {
      console.error(prefix, formatEvent('ERROR', event))
    }
  }
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
  }
  return JSON.stringify(removeEmpty(payload))
}
function removeEmpty(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null)
  )
}
function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}
