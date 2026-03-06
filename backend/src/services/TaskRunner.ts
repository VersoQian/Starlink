import { ImportTask } from '@prisma/client'
import { prisma } from '../prisma'
import { ImportService } from './ImportService'
import { KbService } from './KbService'

const PROCESSING_DELAY_MS = Number(process.env.TASK_RUNNER_DELAY_MS ?? '300')
const POLL_INTERVAL_MS = Number(process.env.TASK_QUEUE_POLL_INTERVAL_MS ?? '2000')
const POLL_BATCH_SIZE = Number(process.env.TASK_QUEUE_BATCH_SIZE ?? '20')
const STALE_TASK_MS = Number(process.env.TASK_QUEUE_STALE_TASK_MS ?? '60000')
const FORCE_FAILURE = process.env.TASK_RUNNER_FORCE_FAILURE === 'true'

export class TaskRunner {
  private static started = false
  private static timers = new Map<string, NodeJS.Timeout>()
  private static poller: NodeJS.Timeout | null = null
  private static processing = new Set<string>()

  static start() {
    if (this.started) return
    this.started = true

    if (this.getDriver() !== 'db') return

    void this.recoverStaleTasks()
    void this.dispatchPendingTasks()
    this.poller = setInterval(() => {
      void this.recoverStaleTasks()
      void this.dispatchPendingTasks()
    }, POLL_INTERVAL_MS)
  }

  static stop() {
    this.started = false
    if (this.poller) {
      clearInterval(this.poller)
      this.poller = null
    }
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
    this.processing.clear()
  }

  static enqueue(task: ImportTask) {
    if (this.getDriver() === 'legacy') {
      this.enqueueLegacy(task.id)
      return
    }

    if (!this.started) {
      this.start()
    }
    void this.processDurable(task.id)
  }

  private static getDriver(): 'legacy' | 'db' {
    return process.env.TASK_QUEUE_DRIVER === 'legacy' ? 'legacy' : 'db'
  }

  private static enqueueLegacy(taskId: string) {
    if (this.timers.has(taskId)) return
    const timer = setTimeout(() => {
      void this.processLegacy(taskId)
    }, PROCESSING_DELAY_MS)
    this.timers.set(taskId, timer)
  }

  private static async processLegacy(taskId: string) {
    this.timers.delete(taskId)
    let task = await prisma.importTask.findUnique({ where: { id: taskId } })
    if (!task) return

    if (task.status !== 'pending') return

    task = await ImportService.markTaskStatus(taskId, 'processing')

    const success = !FORCE_FAILURE
    setTimeout(async () => {
      if (success) {
        const updated = await ImportService.markTaskStatus(taskId, 'succeeded')
        await ImportService.finalizeTask(updated)
      } else {
        await ImportService.markTaskStatus(taskId, 'failed', '任务处理失败')
        await KbService.setStatus(task.kbId, 'draft')
      }
    }, PROCESSING_DELAY_MS)
  }

  private static async processDurable(taskId: string) {
    if (this.processing.has(taskId)) return
    this.processing.add(taskId)

    let task = null as Awaited<ReturnType<typeof ImportService.claimPendingTask>> | null
    try {
      task = await ImportService.claimPendingTask(taskId)
      if (!task) return

      await delay(PROCESSING_DELAY_MS)
      if (!FORCE_FAILURE) {
        const updated = await ImportService.markTaskStatus(taskId, 'succeeded')
        await ImportService.finalizeTask(updated)
      } else {
        await ImportService.markTaskStatus(taskId, 'failed', '任务处理失败')
        await KbService.setStatus(task.kbId, 'draft')
      }
    } catch (error) {
      console.error('[TaskRunner] durable processing failed', { taskId, error: String(error) })
      if (task) {
        await ImportService.markTaskStatus(task.id, 'failed', '任务处理异常')
        await KbService.setStatus(task.kbId, 'draft')
      }
    } finally {
      this.processing.delete(taskId)
    }
  }

  private static async dispatchPendingTasks() {
    if (this.getDriver() !== 'db') return

    const pendingTasks = await prisma.importTask.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: POLL_BATCH_SIZE,
      select: { id: true }
    })

    for (const task of pendingTasks) {
      void this.processDurable(task.id)
    }
  }

  private static async recoverStaleTasks() {
    if (this.getDriver() !== 'db') return

    const staleBefore = new Date(Date.now() - STALE_TASK_MS)
    const staleTasks = await prisma.importTask.findMany({
      where: {
        status: 'processing',
        updatedAt: { lt: staleBefore }
      },
      select: { id: true }
    })

    if (staleTasks.length === 0) return

    await prisma.importTask.updateMany({
      where: {
        id: { in: staleTasks.map((task) => task.id) },
        status: 'processing'
      },
      data: {
        status: 'pending',
        error: 'Recovered from stale processing task'
      }
    })
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
