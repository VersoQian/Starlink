import { nanoid } from 'nanoid'
import type { ImportStatus, ImportTaskType } from '@prisma/client'
import { config } from '../config'

type TaskEvent = {
  eventId: string
  eventType: 'kb.task.created' | 'kb.task.processing' | 'kb.task.succeeded' | 'kb.task.failed'
  version: '1.0'
  occurredAt: string
  taskId: string
  kbId: string
  status: ImportStatus
  payload: {
    taskType: ImportTaskType
    error?: string
    metadata?: Record<string, unknown>
  }
}

const STATUS_TO_EVENT_TYPE: Record<ImportStatus, TaskEvent['eventType']> = {
  pending: 'kb.task.created',
  processing: 'kb.task.processing',
  succeeded: 'kb.task.succeeded',
  failed: 'kb.task.failed'
}

const RETRY_DELAYS_MS = [1000, 3000, 10000]

export class TaskEventService {
  static async emitTaskStatus(params: {
    taskId: string
    kbId: string
    taskType: ImportTaskType
    status: ImportStatus
    error?: string | null
    metadata?: Record<string, unknown>
  }) {
    const url = config.gatewayTaskEventUrl
    if (!url) return

    const event: TaskEvent = {
      eventId: nanoid(),
      eventType: STATUS_TO_EVENT_TYPE[params.status],
      version: '1.0',
      occurredAt: new Date().toISOString(),
      taskId: params.taskId,
      kbId: params.kbId,
      status: params.status,
      payload: {
        taskType: params.taskType,
        error: params.error ?? undefined,
        metadata: params.metadata
      }
    }

    const maxRetries = Math.min(Math.max(config.taskEventRetryCount, 0), RETRY_DELAYS_MS.length)
    let attempt = 0
    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.internalServiceToken
              ? { 'x-internal-token': config.internalServiceToken }
              : {})
          },
          body: JSON.stringify(event)
        })

        if (response.ok) {
          return
        }

        throw new Error(`status=${response.status}`)
      } catch (error) {
        if (attempt >= maxRetries) {
          console.error('[TaskEventService] failed to push task event', {
            error: String(error),
            eventType: event.eventType,
            taskId: event.taskId,
            kbId: event.kbId
          })
          return
        }

        const delay = RETRY_DELAYS_MS[attempt] ?? 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        attempt += 1
      }
    }
  }
}
