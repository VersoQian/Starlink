import { TaskRunner } from '../services/TaskRunner'
import { prisma } from '../prisma'
import { ImportService } from '../services/ImportService'
import { KbService } from '../services/KbService'

jest.mock('../prisma', () => ({
  prisma: {
    importTask: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('../services/ImportService', () => ({
  ImportService: {
    markTaskStatus: jest.fn(),
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
})

afterEach(() => {
  jest.useRealTimers()
})

describe('TaskRunner.enqueue', () => {
  it('processes task lifecycle', async () => {
    const task = { id: 'task-1', kbId: 'kb-1', status: 'pending', type: 'seed' } as any
    ;(prismaMock.importTask.findUnique as jest.Mock).mockResolvedValueOnce(task)
    importServiceMock.markTaskStatus
      .mockResolvedValueOnce({ ...task, status: 'processing' })
      .mockResolvedValueOnce({ ...task, status: 'succeeded' })

    TaskRunner.enqueue(task)

    jest.runOnlyPendingTimers()
    await Promise.resolve()
    jest.runOnlyPendingTimers()
    await Promise.resolve()

    expect(prismaMock.importTask.findUnique).toHaveBeenCalledWith({ where: { id: 'task-1' } })
    expect(importServiceMock.markTaskStatus).toHaveBeenCalledWith('task-1', 'processing')
  })
})
