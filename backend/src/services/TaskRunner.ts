import { ImportStatus, ImportTask } from '@prisma/client'
import { prisma } from '../prisma'
import { ImportService } from './ImportService'
import { KbService } from './KbService'

const PROCESSING_DELAY_MS = Number(process.env.TASK_RUNNER_DELAY_MS ?? '300')
const FORCE_FAILURE = process.env.TASK_RUNNER_FORCE_FAILURE === 'true'

export class TaskRunner {
  private static timers = new Map<string, NodeJS.Timeout>()

  static enqueue(task: ImportTask) {
    if (this.timers.has(task.id)) return
    const timer = setTimeout(() => {
      void this.process(task.id)
    }, PROCESSING_DELAY_MS)
    this.timers.set(task.id, timer)
  }

  private static async process(taskId: string) {
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
}
