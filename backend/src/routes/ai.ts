import { Router } from 'express'
import { LangChainService } from '../services/LangChainService'
import { listIterations, getIteration } from '../store/timelineStore'

export const aiRouter = Router()

aiRouter.post('/ai/analyze', async (req, res, next) => {
  try {
    const { tenantId, userId, question, taskId, timeline, edges } = req.body as {
      tenantId?: string
      userId?: string
      question?: string
      taskId?: string
      timeline?: Array<{
        id: string
        type: string
        position: { x: number; y: number }
        data: Record<string, unknown>
      }>
      edges?: Array<{ id: string; source: string; target: string; label?: string | null }>
    }

    if (!tenantId || !userId || !question) {
      res.status(400).json({ code: 400, message: 'tenantId、userId、question 均为必填' })
      return
    }

    const taskIdentifier = taskId ?? 'default-task'

    const result = await LangChainService.analyzeTask({
      tenantId,
      userId,
      question,
      taskId: taskIdentifier,
      timeline: timeline ?? [],
      edges: edges ?? []
    })

    res.json(result)
  } catch (error) {
    next(error)
  }
})

aiRouter.get('/ai/tasks/:taskId/iterations', (req, res) => {
  const { tenantId } = req.query as { tenantId?: string }
  const { taskId } = req.params

  if (!tenantId) {
    res.status(400).json({ code: 400, message: 'tenantId 必填' })
    return
  }

  const iterations = listIterations(tenantId, taskId)
  res.json({ iterations })
})

aiRouter.get('/ai/tasks/:taskId/iterations/:iterationId', (req, res) => {
  const { tenantId } = req.query as { tenantId?: string }
  const { taskId, iterationId } = req.params

  if (!tenantId) {
    res.status(400).json({ code: 400, message: 'tenantId 必填' })
    return
  }

  const iteration = getIteration(tenantId, taskId, iterationId)
  if (!iteration) {
    res.status(404).json({ code: 404, message: '未找到迭代' })
    return
  }

  res.json({ iteration })
})
