import { Router } from 'express'
import { KbService } from '../services/KbService'
import { ImportService } from '../services/ImportService'
import { UsageService } from '../services/UsageService'
import { upload, mapUploadedFiles } from '../utils/upload'
import { prisma } from '../prisma'
import { RagService } from '../services/RagService'

export const kbRouter = Router()

function readWorkspaceId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function serializeKnowledgeBase(
  kb: Record<string, unknown>,
  fallbackWorkspaceId?: string
) {
  return {
    ...kb,
    workspaceId:
      (typeof kb.workspaceId === 'string' && kb.workspaceId.trim().length > 0
        ? kb.workspaceId
        : fallbackWorkspaceId) ?? 'global'
  }
}

function serializeImportTask(
  task: Record<string, unknown>,
  workspaceId?: string
) {
  return {
    ...task,
    workspaceId: workspaceId ?? 'global'
  }
}

kbRouter.get('/kb', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const list = await KbService.list(workspaceId)
    res.json({
      knowledgeBases: list.map((kb) => serializeKnowledgeBase(kb, workspaceId))
    })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId((req.body as { workspaceId?: string } | undefined)?.workspaceId)
    const kb = await KbService.create({ workspaceId })
    res.status(201).json(serializeKnowledgeBase(kb, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/kb/:id', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const kb = await KbService.getById(req.params.id, workspaceId)
    res.json(serializeKnowledgeBase(kb, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.put('/kb/:id', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const kb = await KbService.update(req.params.id, req.body, workspaceId)
    res.json(serializeKnowledgeBase(kb, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/seed', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId((req.body as { workspaceId?: string } | undefined)?.workspaceId)
    const { text } = req.body as { text?: string }
    if (!text || !text.trim()) {
      res.status(400).json({ code: 400, message: '文本不能为空' })
      return
    }
    const kb = await KbService.getById(req.params.id, workspaceId)
    const task = await ImportService.addSeed(kb.id, text.trim())
    res.status(202).json(serializeImportTask(task, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/import/file', upload.array('files'), async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      res.status(400).json({ code: 400, message: '未选择文件' })
      return
    }
    const mapped = mapUploadedFiles(files)
    const kb = await KbService.getById(req.params.id, workspaceId)
    const tasks = await ImportService.addFiles(kb.id, mapped)
    res.status(202).json({
      tasks: tasks.map((task) => serializeImportTask(task, workspaceId))
    })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/import/url', async (req, res, next) => {
  try {
    const { url, workspaceId: workspaceIdInput } = req.body as { url?: string; workspaceId?: string }
    const workspaceId = readWorkspaceId(workspaceIdInput)
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ code: 400, message: 'URL 不合法' })
      return
    }
    const kb = await KbService.getById(req.params.id, workspaceId)
    const task = await ImportService.addUrl(kb.id, url)
    res.status(202).json(serializeImportTask(task, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/kb/:id/search', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : ''
    const topK = Math.min(Math.max(Number(req.query.topK) || 5, 1), 20)

    if (!query) {
      res.status(400).json({ code: 400, message: 'query 参数不能为空' })
      return
    }

    const kb = await KbService.getById(req.params.id, workspaceId)
    const ragResults = await RagService.search(kb.id, query, topK)
    if (ragResults.length > 0) {
      res.json({ results: ragResults })
      return
    }

    const keywords = query
      .split(/[\s,，。、；;！!？?\-_/]+/)
      .map((k) => k.trim())
      .filter((k) => k.length >= 2)

    if (keywords.length === 0) {
      res.json({ results: [] })
      return
    }

    const seedWhere = keywords.map((kw) => ({
      text: { contains: kw, mode: 'insensitive' as const }
    }))

    const seeds = await prisma.seed.findMany({
      where: {
        kbId: kb.id,
        OR: seedWhere
      },
      take: topK * 2,
      orderBy: { createdAt: 'desc' }
    })

    const documents = await prisma.document.findMany({
      where: {
        kbId: kb.id,
        OR: keywords.map((kw) => ({
          title: { contains: kw, mode: 'insensitive' as const }
        }))
      },
      take: topK,
      orderBy: { createdAt: 'desc' }
    })

    type ScoredResult = { docId: string; snippet: string; score: number; metadata: Record<string, unknown> }
    const results: ScoredResult[] = []

    for (const seed of seeds) {
      const matchCount = keywords.filter((kw) =>
        seed.text.toLowerCase().includes(kw.toLowerCase())
      ).length
      const score = matchCount / keywords.length
      const snippet = seed.text.length > 300 ? seed.text.substring(0, 300) + '...' : seed.text
      results.push({
        docId: seed.id,
        snippet,
        score,
        metadata: { type: 'seed', kbId: kb.id }
      })
    }

    for (const doc of documents) {
      const matchCount = keywords.filter((kw) =>
        doc.title.toLowerCase().includes(kw.toLowerCase())
      ).length
      const score = (matchCount / keywords.length) * 0.8
      results.push({
        docId: doc.id,
        snippet: `[文档] ${doc.title}`,
        score,
        metadata: { type: 'document', kbId: kb.id, path: doc.path, mime: doc.mime }
      })
    }

    results.sort((a, b) => b.score - a.score)

    res.json({ results: results.slice(0, topK) })
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/kb/:id/status', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const kb = await KbService.getById(req.params.id, workspaceId)
    const tasks = await prisma.importTask.findMany({
      where: { kbId: kb.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      knowledgeBase: serializeKnowledgeBase(kb, workspaceId),
      tasks: tasks.map((task) => serializeImportTask(task, workspaceId))
    })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/publish', async (req, res, next) => {
  try {
    const workspaceId = readWorkspaceId(req.query.workspaceId)
    const kb = await KbService.publish(req.params.id, workspaceId)
    res.json(serializeKnowledgeBase(kb, workspaceId))
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/usage', async (_req, res, next) => {
  try {
    const usage = await UsageService.getUsage()
    res.json(usage)
  } catch (error) {
    next(error)
  }
})
