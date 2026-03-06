import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import {
  DifyRequestError,
  type DifyRetryConfig,
  type DifyWorkflowExecutionRequest,
  createAuditLogger
} from '@starlink/shared'
import { DifyService } from '../../../services/DifyService'
import { getDifyWorkflow } from '../../../config/dify'

const service = new DifyService()
const auditLogger = createAuditLogger('frontend:api:dify')

type DifyRequestPayload = DifyWorkflowExecutionRequest & {
  stream?: boolean
}

export async function POST(request: Request) {
  const requestId = randomUUID()
  const startedAt = Date.now()
  let payload: DifyRequestPayload

  try {
    payload = (await request.json()) as DifyRequestPayload
  } catch {
    auditLogger.warn({
      action: 'dify.invalidPayload',
      requestId,
      metadata: { reason: 'invalid-json' }
    })
    return NextResponse.json({ message: 'Invalid JSON body', requestId }, { status: 400 })
  }

  if (!payload.workflowId) {
    auditLogger.warn({
      action: 'dify.invalidPayload',
      requestId,
      metadata: { reason: 'missing-workflowId' }
    })
    return NextResponse.json({ message: 'workflowId is required', requestId }, { status: 400 })
  }

  if (!payload.inputs) {
    auditLogger.warn({
      action: 'dify.invalidPayload',
      requestId,
      metadata: { reason: 'missing-inputs', workflowId: payload.workflowId }
    })
    return NextResponse.json({ message: 'inputs is required', requestId }, { status: 400 })
  }

  try {
    const workflow = getDifyWorkflow(payload.workflowId)
    const mode = payload.mode ?? (payload.stream ? 'streaming' : workflow.mode)
    const retry: DifyRetryConfig | undefined = payload.retry
    const rateLimitViolation = evaluateRateLimit(request, workflow, payload.userId)

    if (rateLimitViolation) {
      auditLogger.warn({
        action: 'dify.rateLimited',
        userId: payload.userId,
        workflowId: workflow.id,
        requestId,
        metadata: rateLimitViolation
      })
      return NextResponse.json(
        {
          message: 'Rate limit exceeded, please retry later.',
          retryAfter: Math.ceil(rateLimitViolation.retryAfterMs / 1000),
          requestId
        },
        { status: 429, headers: { 'Retry-After': `${Math.ceil(rateLimitViolation.retryAfterMs / 1000)}` } }
      )
    }

    if (mode === 'streaming') {
      const response = (await service.executeWorkflow({
        workflowId: workflow.id,
        inputs: payload.inputs,
        user: payload.userId,
        responseMode: 'streaming',
        retry,
        priority: payload.priority ?? workflow.defaultPriority,
        metricsTag: payload.metricsTag ?? workflow.metricsTag
      })) as Response

      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-cache')
      headers.set('Connection', 'keep-alive')
      headers.set('Content-Type', 'text/event-stream')
      headers.set('X-Request-Id', requestId)

      auditLogger.info({
        action: 'dify.execute',
        userId: payload.userId,
        workflowId: workflow.id,
        requestId,
        metadata: { mode: 'streaming' },
        durationMs: Date.now() - startedAt
      })

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    }

    const result = await service.executeWorkflow({
      workflowId: workflow.id,
      inputs: payload.inputs,
      user: payload.userId,
      responseMode: 'blocking',
      retry,
      priority: payload.priority ?? workflow.defaultPriority,
      metricsTag: payload.metricsTag ?? workflow.metricsTag
    })

    auditLogger.info({
      action: 'dify.execute',
      userId: payload.userId,
      workflowId: workflow.id,
      requestId,
      metadata: { mode: 'blocking' },
      durationMs: Date.now() - startedAt
    })

    return NextResponse.json({ ...result, requestId })
  } catch (error) {
    auditLogger.error({
      action: 'dify.executeFailed',
      userId: payload?.userId,
      workflowId: payload?.workflowId,
      requestId,
      metadata: { mode: payload?.mode ?? (payload?.stream ? 'streaming' : 'blocking') },
      error
    })

    if (error instanceof DifyRequestError) {
      return NextResponse.json(
        { message: error.detail ?? error.message, requestId },
        { status: error.status }
      )
    }

    return NextResponse.json({ message: 'Unexpected Dify error', requestId }, { status: 500 })
  }
}

type RateLimitViolation = {
  identifier: string
  retryAfterMs: number
}

function evaluateRateLimit(
  request: Request,
  workflow: ReturnType<typeof getDifyWorkflow>,
  userId: string | undefined
): RateLimitViolation | undefined {
  const rules = workflow.rateLimit
  if (!rules || rules.length === 0) {
    return undefined
  }

  for (const rule of rules) {
    const key = createRateLimitKey(rule.identifier, {
      request,
      workflowId: workflow.id,
      tenantId: workflow.tenantId,
      userId
    })
    if (!key) continue
    const result = rateLimiter.consume(key, rule.limit, rule.intervalMs)
    if (!result.allowed) {
      return { identifier: rule.identifier, retryAfterMs: result.retryAfterMs }
    }
  }

  return undefined
}

function createRateLimitKey(
  identifier: string,
  context: { request: Request; workflowId: string; tenantId?: string; userId: string | undefined }
) {
  switch (identifier) {
    case 'user':
      return `user:${context.userId ?? 'anonymous'}`
    case 'workflow':
      return `workflow:${context.workflowId}`
    case 'tenant':
      return `tenant:${context.tenantId ?? context.workflowId}`
    case 'ip': {
      const forwarded = context.request.headers.get('x-forwarded-for')
      const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
      return `ip:${ip}`
    }
    default:
      return undefined
  }
}

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { count: number; expiresAt: number }>()

  consume(
    key: string,
    limit: number,
    intervalMs: number
  ): { allowed: true; retryAfterMs: number } | { allowed: false; retryAfterMs: number } {
    const now = Date.now()
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.expiresAt <= now) {
      this.buckets.set(key, { count: 1, expiresAt: now + intervalMs })
      return { allowed: true, retryAfterMs: intervalMs }
    }

    if (bucket.count >= limit) {
      return { allowed: false, retryAfterMs: bucket.expiresAt - now }
    }

    bucket.count += 1
    return { allowed: true, retryAfterMs: bucket.expiresAt - now }
  }
}

const rateLimiter = new InMemoryRateLimiter()
