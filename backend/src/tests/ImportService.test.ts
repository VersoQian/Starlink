import { ImportService } from '../services/ImportService'
import { prisma } from '../prisma'
import { TaskRunner } from '../services/TaskRunner'
import { KbService } from '../services/KbService'
import { TaskEventService } from '../services/TaskEventService'

jest.mock('../prisma', () => ({
  prisma: {
    seed: { create: jest.fn() },
    importTask: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    document: { create: jest.fn() },
    knowledgeBase: { findUnique: jest.fn(), update: jest.fn() },
  },
}))

jest.mock('../services/TaskRunner', () => ({
  TaskRunner: {
    enqueue: jest.fn(),
  },
}))

jest.mock('../services/UsageService', () => ({
  UsageService: {
    incrementTokens: jest.fn(),
  },
}))

jest.mock('../services/KbService', () => ({
  KbService: {
    setStatus: jest.fn(),
  },
}))

jest.mock('../services/TaskEventService', () => ({
  TaskEventService: {
    emitTaskStatus: jest.fn(),
  },
}))

const prismaMock = prisma as any
const taskRunnerMock = TaskRunner as jest.Mocked<typeof TaskRunner>
const kbServiceMock = KbService as jest.Mocked<typeof KbService>
const taskEventServiceMock = TaskEventService as jest.Mocked<typeof TaskEventService>

beforeEach(() => {
  jest.clearAllMocks()
})

describe('ImportService.addSeed', () => {
  it('creates seed and enqueues task', async () => {
    ;(prismaMock.seed.create as jest.Mock).mockResolvedValue({ id: 'seed-1', kbId: 'kb-1', text: 'hello', createdAt: new Date() })
    ;(prismaMock.importTask.create as jest.Mock).mockResolvedValue({ id: 'task-1', kbId: 'kb-1', status: 'pending' })

    await ImportService.addSeed('kb-1', 'hello')

    expect(prismaMock.seed.create).toHaveBeenCalled()
    expect(prismaMock.importTask.create).toHaveBeenCalled()
    expect(kbServiceMock.setStatus).toHaveBeenCalledWith('kb-1', 'processing')
    expect(taskEventServiceMock.emitTaskStatus).toHaveBeenCalled()
    expect(taskRunnerMock.enqueue).toHaveBeenCalled()
  })
})

describe('ImportService.addFiles', () => {
  it('persists documents and tasks', async () => {
    ;(prismaMock.document.create as jest.Mock).mockResolvedValue({ id: 'doc-1' })
    ;(prismaMock.importTask.create as jest.Mock).mockResolvedValue({ id: 'task-2', kbId: 'kb-1', status: 'pending' })

    const uploads = [
      { path: 'uploads/a.pdf', title: 'a.pdf', mime: 'application/pdf', size: 123, sourceType: 'file' as const },
    ]

    await ImportService.addFiles('kb-1', uploads)

    expect(prismaMock.document.create).toHaveBeenCalledTimes(1)
    expect(taskEventServiceMock.emitTaskStatus).toHaveBeenCalled()
    expect(taskRunnerMock.enqueue).toHaveBeenCalled()
    expect(kbServiceMock.setStatus).toHaveBeenCalledWith('kb-1', 'processing')
  })
})

describe('ImportService.claimPendingTask', () => {
  it('claims pending task and emits processing event', async () => {
    ;(prismaMock.importTask.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prismaMock.importTask.findUnique as jest.Mock).mockResolvedValue({
      id: 'task-9',
      kbId: 'kb-9',
      type: 'seed',
      status: 'processing'
    })

    const claimed = await ImportService.claimPendingTask('task-9')

    expect(prismaMock.importTask.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-9', status: 'pending' },
      data: { status: 'processing', error: null }
    })
    expect(taskEventServiceMock.emitTaskStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-9',
        kbId: 'kb-9',
        status: 'processing'
      })
    )
    expect(claimed).toEqual(expect.objectContaining({ id: 'task-9' }))
  })
})
