import { Router } from 'express'
import { KbService } from '../services/KbService'
import { ImportService } from '../services/ImportService'
import { UsageService } from '../services/UsageService'
import { upload, mapUploadedFiles } from '../utils/upload'
import { prisma } from '../prisma'

export const kbRouter = Router()

kbRouter.get('/kb', async (_req, res, next) => {
  try {
    const list = await KbService.list()
    res.json({ knowledgeBases: list })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb', async (_req, res, next) => {
  try {
    const kb = await KbService.create()
    res.status(201).json(kb)
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/kb/:id', async (req, res, next) => {
  try {
    const kb = await KbService.getById(req.params.id)
    res.json(kb)
  } catch (error) {
    next(error)
  }
})

kbRouter.put('/kb/:id', async (req, res, next) => {
  try {
    const kb = await KbService.update(req.params.id, req.body)
    res.json(kb)
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/seed', async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string }
    if (!text || !text.trim()) {
      res.status(400).json({ code: 400, message: '文本不能为空' })
      return
    }
    const task = await ImportService.addSeed(req.params.id, text.trim())
    res.status(202).json(task)
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/import/file', upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      res.status(400).json({ code: 400, message: '未选择文件' })
      return
    }
    const mapped = mapUploadedFiles(files)
    const tasks = await ImportService.addFiles(req.params.id, mapped)
    res.status(202).json({ tasks })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/import/url', async (req, res, next) => {
  try {
    const { url } = req.body as { url?: string }
    if (!url || !/^https?:\/\//i.test(url)) {
      res.status(400).json({ code: 400, message: 'URL 不合法' })
      return
    }
    const task = await ImportService.addUrl(req.params.id, url)
    res.status(202).json(task)
  } catch (error) {
    next(error)
  }
})

kbRouter.get('/kb/:id/status', async (req, res, next) => {
  try {
    const kb = await KbService.getById(req.params.id)
    const tasks = await prisma.importTask.findMany({
      where: { kbId: kb.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ knowledgeBase: kb, tasks })
  } catch (error) {
    next(error)
  }
})

kbRouter.post('/kb/:id/publish', async (req, res, next) => {
  try {
    const kb = await KbService.publish(req.params.id)
    res.json(kb)
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
