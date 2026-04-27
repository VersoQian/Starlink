import type { Handoff, HandoffLogger } from './handoff-types.js'

class InMemoryHandoffLogger implements HandoffLogger {
  private events: Handoff[] = []
  private subs = new Set<(h: Handoff) => void>()
  private startTime: number

  constructor() {
    this.startTime = Date.now()
  }

  record(event: Omit<Handoff, 't'>): void {
    const enriched: Handoff = {
      ...event,
      t: Date.now() - this.startTime
    }
    this.events.push(enriched)
    for (const sub of this.subs) {
      try {
        sub(enriched)
      } catch {
        /* swallow */
      }
    }
  }

  dump(): Handoff[] {
    return [...this.events]
  }

  subscribe(cb: (h: Handoff) => void): () => void {
    this.subs.add(cb)
    return () => {
      this.subs.delete(cb)
    }
  }

  clear(): void {
    this.events = []
    this.subs.clear()
    this.startTime = Date.now()
  }

  get size(): number {
    return this.events.length
  }
}

const loggersByThread = new Map<string, InMemoryHandoffLogger>()

export function getHandoffLogger(threadId: string): HandoffLogger {
  let logger = loggersByThread.get(threadId)
  if (!logger) {
    logger = new InMemoryHandoffLogger()
    loggersByThread.set(threadId, logger)
  }
  return logger
}

export function releaseHandoffLogger(threadId: string): Handoff[] {
  const logger = loggersByThread.get(threadId)
  if (!logger) return []
  const events = logger.dump()
  loggersByThread.delete(threadId)
  return events
}

export function __resetAllLoggersForTest(): void {
  for (const l of loggersByThread.values()) l.clear()
  loggersByThread.clear()
}

export function activeLoggerCount(): number {
  return loggersByThread.size
}
