import { taskEventSchema, type TaskEvent } from '@starlink/shared'

export type TaskStatusSnapshot = {
  taskId: string
  kbId: string
  status: TaskEvent['status']
  taskType: TaskEvent['payload']['taskType']
  error?: string
  updatedAt: string
  lastEventId: string
}

export class TaskEventStore {
  private readonly processedEventIds = new Set<string>()
  private readonly tasksByKb = new Map<string, Map<string, TaskStatusSnapshot>>()

  ingest(rawEvent: unknown) {
    const event = taskEventSchema.parse(rawEvent)
    if (this.processedEventIds.has(event.eventId)) {
      return { duplicate: true as const }
    }

    this.processedEventIds.add(event.eventId)

    const currentByKb = this.tasksByKb.get(event.kbId) ?? new Map<string, TaskStatusSnapshot>()
    const nextSnapshot: TaskStatusSnapshot = {
      taskId: event.taskId,
      kbId: event.kbId,
      status: event.status,
      taskType: event.payload.taskType,
      error: event.payload.error,
      updatedAt: event.occurredAt,
      lastEventId: event.eventId
    }

    currentByKb.set(event.taskId, nextSnapshot)
    this.tasksByKb.set(event.kbId, currentByKb)

    return { duplicate: false as const, event }
  }

  getTaskStatuses(kbId: string): TaskStatusSnapshot[] {
    const byTask = this.tasksByKb.get(kbId)
    if (!byTask) return []

    return [...byTask.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}
