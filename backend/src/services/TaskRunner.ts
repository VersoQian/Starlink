import { ImportStatus, ImportTask } from '@prisma/client'
import { prisma } from '../prisma'
import { ImportService } from './ImportService'
import { KbService } from './KbService'

const PROCESSING_DELAY_RANGE = [1000, 2000]
const FAILURE_CHANCE = 0.1

export class TaskRunner {
  private static timers = new Map<string, NodeJS.Timeout>()

  static enqueue(task: ImportTask) {
    if (this.timers.has(task.id)) return
    const delay = this.randomDelay()
    const timer = setTimeout(() => {
      void this.process(task.id)
    }, delay)
    this.timers.set(task.id, timer)
  }

  private static async process(taskId: string) {
    this.timers.delete(taskId)
    let task = await prisma.importTask.findUnique({ where: { id: taskId } })
    if (!task) return

    if (task.status !== 'pending') return

    task = await ImportService.markTaskStatus(taskId, 'processing')

    const success = Math.random() > FAILURE_CHANCE
    const delay = this.randomDelay()
    setTimeout(async () => {
      if (success) {
        const updated = await ImportService.markTaskStatus(taskId, 'succeeded')
        await ImportService.finalizeTask(updated)
      } else {
        await ImportService.markTaskStatus(taskId, 'failed', '模拟处理失败，请重试')
        await KbService.setStatus(task.kbId, 'draft')
      }
    }, delay)
  }

  private static randomDelay() {
    const [min, max] = PROCESSING_DELAY_RANGE
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
}
