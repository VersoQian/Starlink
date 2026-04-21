import { TaskRunner } from '../services/TaskRunner'
import { prisma } from '../prisma'
import { ImportService } from '../services/ImportService'
import { KbService } from '../services/KbService'

jest.mock('../prisma', () => ({
  prisma: {
    importTask: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('../services/ImportService', () => ({
  ImportService: {
    claimPendingTask: jest.fn(),
    markTaskStatus: jest.fn(),
    processTask: jest.fn(),
    finalizeTask: jest.fn(),
  },
}))

jest.mock('../services/KbService', () => ({
  KbService: {
    setStatus: jest.fn(),
  },
}))

const prismaMock = prisma as any
const importServiceMock = ImportService as jest.Mocked<typeof ImportService>

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  process.env.TASK_QUEUE_DRIVER = 'legacy'
  ;(prismaMock.importTask.findMany as jest.Mock).mockResolvedValue([])
  ;(prismaMock.importTask.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
})

afterEach(() => {
  TaskRunner.stop()
  jest.useRealTimers()
})

describe('TaskRunner.enqueue', () => {
  it('processes task lifecycle in legacy mode', async () => {
    const task = { id: 'task-1', kbId: 'kb-1', status: 'pending', type: 'seed' } as any
    const processingTask = { ...task, status: 'processing' }
    ;(prismaMock.importTask.findUnique as jest.Mock).mockResolvedValueOnce(task)
    importServiceMock.markTaskStatus
      .mockResolvedValueOnce(processingTask)
      .mockResolvedValueOnce({ ...task, status: 'succeeded' })

    TaskRunner.enqueue(task)

    await jest.runOnlyPendingTimersAsync()
    await jest.runOnlyPendingTimersAsync()

    expect(prismaMock.importTask.findUnique).toHaveBeenCalledWith({ where: { id: 'task-1' } })
    expect(importServiceMock.markTaskStatus).toHaveBeenCalledWith('task-1', 'processing')
    expect(importServiceMock.processTask).toHaveBeenCalledWith(processingTask)
    expect(importServiceMock.markTaskStatus).toHaveBeenCalledWith('task-1', 'succeeded')
    expect(importServiceMock.finalizeTask).toHaveBeenCalled()
  })

  it('claims and completes task in db mode', async () => {
    process.env.TASK_QUEUE_DRIVER = 'db'
    const task = { id: 'task-2', kbId: 'kb-2', status: 'processing', type: 'url' } as any

    importServiceMock.claimPendingTask.mockResolvedValueOnce(task)
    importServiceMock.markTaskStatus.mockResolvedValueOnce({ ...task, status: 'succeeded' })

    TaskRunner.enqueue({ id: 'task-2' } as any)
    await jest.runOnlyPendingTimersAsync()
    await jest.runOnlyPendingTimersAsync()

    expect(importServiceMock.claimPendingTask).toHaveBeenCalledWith('task-2')
    expect(importServiceMock.processTask).toHaveBeenCalledWith(task)
    expect(importServiceMock.markTaskStatus).toHaveBeenCalledWith('task-2', 'succeeded')
    expect(importServiceMock.finalizeTask).toHaveBeenCalled()
  })
})
