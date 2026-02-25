import { Router } from 'express'

const DEFAULT_TASK_SERVICE_BASE_URL = 'http://localhost:4001'

const router = Router()

router.post('/:kbId/import/file', async (req, res) => {
  const { kbId } = req.params
  const baseUrl = process.env.KB_TASK_SERVICE_URL ?? DEFAULT_TASK_SERVICE_BASE_URL
  const endpoint = new URL(`/kb/${kbId}/import/file`, baseUrl)

  const contentType = req.headers['content-type']
  if (!contentType) {
    return res.status(400).json({
      ok: false,
      error: {
        code: 'MISSING_CONTENT_TYPE',
        message: 'content-type is required'
      }
    })
  }

  try {
    const upstream = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: {
        'content-type': contentType
      },
      body: req as unknown as BodyInit,
      duplex: 'half'
    } as RequestInit)

    const payload = await upstream.text()
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) {
      res.setHeader('content-type', upstreamContentType)
    }

    return res.status(upstream.status).send(payload)
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'failed to proxy file import request',
        details: { error: String(error) }
      }
    })
  }
})

export { router as kbProxyRouter }
