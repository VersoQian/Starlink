import { DocumentSourceType, ImportStatus, ImportTask } from '@prisma/client'
import { prisma } from '../prisma'
import { UsageService } from './UsageService'
import { TaskRunner } from './TaskRunner'
import { KbService } from './KbService'
import { UploadResult } from '../types'
import { TaskEventService } from './TaskEventService'

export class ImportService {
  static async addSeed(kbId: string, text: string) {
    const seed = await prisma.seed.create({
      data: {
        kbId,
        text,
      },
    })

    const task = await prisma.importTask.create({
      data: {
        kbId,
        type: 'seed',
        payload: { seedId: seed.id, length: text.length },
        status: 'pending',
      },
    })

    await KbService.setStatus(kbId, 'processing')
    await TaskEventService.emitTaskStatus({
      taskId: task.id,
      kbId,
      taskType: task.type,
      status: task.status
    })
    TaskRunner.enqueue(task)
    return task
  }

  static async addFiles(kbId: string, uploads: UploadResult[]) {
    const tasks: ImportTask[] = []
    for (const upload of uploads) {
      const document = await prisma.document.create({
        data: {
          kbId,
          title: upload.title,
          path: upload.path,
          mime: upload.mime,
          size: upload.size,
          sourceType: upload.sourceType,
        },
      })

      const task = await prisma.importTask.create({
        data: {
          kbId,
          type: 'file',
          payload: { documentId: document.id, path: document.path },
          status: 'pending',
        },
      })
      tasks.push(task)
      await TaskEventService.emitTaskStatus({
        taskId: task.id,
        kbId,
        taskType: task.type,
        status: task.status
      })
      TaskRunner.enqueue(task)
    }
    if (tasks.length) {
      await KbService.setStatus(kbId, 'processing')
    }
    return tasks
  }

  static async addUrl(kbId: string, url: string) {
    const task = await prisma.importTask.create({
      data: {
        kbId,
        type: 'url',
        payload: { url },
        status: 'pending',
      },
    })
    await KbService.setStatus(kbId, 'processing')
    await TaskEventService.emitTaskStatus({
      taskId: task.id,
      kbId,
      taskType: task.type,
      status: task.status
    })
    TaskRunner.enqueue(task)
    return task
  }

  static async markTaskStatus(taskId: string, status: ImportStatus, error?: string | null) {
    const task = await prisma.importTask.update({
      where: { id: taskId },
      data: { status, error },
    })
    await TaskEventService.emitTaskStatus({
      taskId: task.id,
      kbId: task.kbId,
      taskType: task.type,
      status: task.status,
      error
    })
    return task
  }

  static async finalizeTask(task: ImportTask) {
    if (task.status !== 'succeeded') return

    // Simulate usage increments
    const tokens = Math.floor(Math.random() * 500) + 200
    await UsageService.incrementTokens(tokens)

    if (task.type === 'url') {
      const url = (task.payload as { url?: string }).url ?? ''
      await prisma.document.create({
        data: {
          kbId: task.kbId,
          title: url,
          path: url,
          mime: 'text/html',
          size: 0,
          sourceType: DocumentSourceType.url,
        },
      })
    }

    // After successful processing, check if outstanding tasks remain
    const outstanding = await prisma.importTask.count({
      where: {
        kbId: task.kbId,
        status: {
          in: ['pending', 'processing'],
        },
      },
    })

    if (outstanding === 0) {
      const kb = await prisma.knowledgeBase.findUnique({ where: { id: task.kbId } })
      if (kb && kb.status !== 'ready') {
        await KbService.setStatus(task.kbId, 'draft')
      }
    }
  }
}
