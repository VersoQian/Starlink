import type { Request, Response, NextFunction } from 'express'
import { kbRouter } from '../routes/kb'
import { KbService } from '../services/KbService'
import { UsageService } from '../services/UsageService'
import { ImportService } from '../services/ImportService'
import { prisma } from '../prisma'

jest.mock('../services/KbService', () => ({
  KbService: {
    list: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    publish: jest.fn(),
    setStatus: jest.fn(),
  },
}))

jest.mock('../services/UsageService', () => ({
  UsageService: {
    getUsage: jest.fn(),
  },
}))

jest.mock('../services/ImportService', () => ({
  ImportService: {
    addSeed: jest.fn(),
    addFiles: jest.fn(),
    addUrl: jest.fn(),
  },
}))

jest.mock('../prisma', () => ({
  prisma: {
    importTask: {
      findMany: jest.fn(),
    },
  },
}))

type Handler = (req: Request, res: Response, next: NextFunction) => any

declare module 'express-serve-static-core' {
  interface Router {
    stack: Array<{
      route?: {
        path: string
        stack: Array<{ handle: Handler }>
        methods: Record<string, boolean>
      }
    }>
  }
}

const kbServiceMock = KbService as any
const usageServiceMock = UsageService as any
const importServiceMock = ImportService as any
const prismaMock = prisma as any

function createMockRes() {
  const res: Partial<Response> = {}
  res.status = jest.fn().mockImplementation(function (this: Response, code: number) {
    ;(this as any).statusCode = code
    return this
  })
  res.json = jest.fn().mockReturnValue(res)
  return res as Response & { statusCode?: number }
}

function getHandler(method: string, path: string): Handler {
  const layer = kbRouter.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method.toLowerCase()]
  )
  if (!layer || !layer.route || layer.route.stack.length === 0) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`)
  }
  return layer.route.stack[0].handle
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('kb routes (unit)', () => {
  it('GET /kb should return knowledge base list', async () => {
    const handler = getHandler('get', '/kb')
    const res = createMockRes()
    ;(kbServiceMock.list as jest.Mock).mockResolvedValue([
      { id: 'kb-1', workspaceId: 'demo', name: 'KB1' },
      { id: 'kb-2', workspaceId: 'demo', name: 'KB2' }
    ])

    await handler({ query: { workspaceId: 'demo' } } as unknown as Request, res, jest.fn())

    expect(kbServiceMock.list).toHaveBeenCalledWith('demo')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeBases: expect.arrayContaining([
          expect.objectContaining({ id: 'kb-1', workspaceId: 'demo' }),
          expect.objectContaining({ id: 'kb-2', workspaceId: 'demo' })
        ])
      })
    )
  })

  it('POST /kb should create knowledge base', async () => {
    const handler = getHandler('post', '/kb')
    const res = createMockRes()
    ;(kbServiceMock.create as jest.Mock).mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'demo',
      name: '新建 Knowledge Base'
    })

    await handler({ body: { workspaceId: 'demo' } } as unknown as Request, res, jest.fn())

    expect(kbServiceMock.create).toHaveBeenCalledWith({ workspaceId: 'demo' })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'kb-1', workspaceId: 'demo' }))
  })

  it('GET /kb/:id/status should return kb and tasks', async () => {
    const handler = getHandler('get', '/kb/:id/status')
    const res = createMockRes()
    ;(kbServiceMock.getById as jest.Mock).mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'demo',
      name: 'KB',
      status: 'draft',
      aiChunkingEnabled: true
    })
    ;(prismaMock.importTask.findMany as jest.Mock).mockResolvedValue([{ id: 'task-1', status: 'succeeded' }])

    await handler(
      { params: { id: 'kb-1' }, query: { workspaceId: 'demo' } } as unknown as Request,
      res,
      jest.fn()
    )

    expect(kbServiceMock.getById).toHaveBeenCalledWith('kb-1', 'demo')
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeBase: expect.objectContaining({ id: 'kb-1', workspaceId: 'demo' }),
        tasks: expect.arrayContaining([expect.objectContaining({ id: 'task-1', workspaceId: 'demo' })]),
      })
    )
  })

  it('POST /kb/:id/seed delegates to ImportService', async () => {
    const handler = getHandler('post', '/kb/:id/seed')
    const res = createMockRes()
    ;(importServiceMock.addSeed as jest.Mock).mockResolvedValue({ id: 'task-1' })
    ;(kbServiceMock.getById as jest.Mock).mockResolvedValue({ id: 'kb-1', workspaceId: 'demo' })

    await handler(
      { params: { id: 'kb-1' }, body: { text: 'Hello', workspaceId: 'demo' } } as unknown as Request,
      res,
      jest.fn()
    )

    expect(kbServiceMock.getById).toHaveBeenCalledWith('kb-1', 'demo')
    expect(importServiceMock.addSeed).toHaveBeenCalledWith('kb-1', 'Hello')
    expect(res.status).toHaveBeenCalledWith(202)
  })

  it('GET /usage returns usage payload', async () => {
    const handler = getHandler('get', '/usage')
    const res = createMockRes()
    ;(usageServiceMock.getUsage as jest.Mock).mockResolvedValue({ usedTokens: 0, limitTokens: 100 })

    await handler({} as Request, res, jest.fn())

    expect(res.json).toHaveBeenCalledWith({ usedTokens: 0, limitTokens: 100 })
  })
})
