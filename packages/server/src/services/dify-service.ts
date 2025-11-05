import {
  DifyRequestError,
  type DifyPriority,
  type DifyRetryConfig,
  type DifyWorkflowMode
} from '@branching-chat/shared'
import { createAuditLogger } from '@branching-chat/shared'

const DEFAULT_BASE_URL = (process.env.DIFY_API_BASE_URL ?? 'https://api.dify.ai/v1').replace(/\/$/, '')
const DEFAULT_WORKFLOW_ID = process.env.DIFY_DEFAULT_WORKFLOW_ID ?? process.env.DIFY_CONTENT_APP_ID ?? ''
const DEFAULT_API_KEY =
  process.env.DIFY_SERVER_API_KEY ??
  process.env.DIFY_CONTENT_API_KEY ??
  process.env.DIFY_API_KEY ??
  ''

type RunWorkflowOptions = {
  workflowId?: string
  inputs: Record<string, unknown>
  user?: string
  responseMode?: DifyWorkflowMode
  signal?: AbortSignal
  priority?: DifyPriority
  metricsTag?: string
  retry?: DifyRetryConfig
}

type BlockingResult = {
  answer?: string
  outputs?: Array<{ text?: string; answer?: string }>
  data?: unknown
  [key: string]: unknown
}

const auditLogger = createAuditLogger('packages/server:dify-service')

export class DifyServerService {
  constructor(
    private readonly config: {
      baseUrl?: string
      workflowId?: string
      apiKey?: string
    } = {}
  ) {}

  isConfigured(): boolean {
    return Boolean(this.resolveApiKey() && this.resolveWorkflowId())
  }

  async runWorkflow(options: RunWorkflowOptions): Promise<BlockingResult | Response> {
    const apiKey = this.resolveApiKey()
    const workflowId = options.workflowId ?? this.resolveWorkflowId()
    if (!apiKey || !workflowId) {
      throw new Error('Dify workflow is not configured on the server')
    }

    const attempts = Math.max(options.retry?.attempts ?? 1, 1)
    const responseMode = options.responseMode ?? 'blocking'
    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetch(`${this.resolveBaseUrl()}/workflows/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            workflow_id: workflowId,
            response_mode: responseMode,
            user: options.user ?? 'server',
            inputs: options.inputs,
            metadata: buildMetadata(options.priority, options.metricsTag)
          }),
          signal: options.signal
        })

        if (!response.ok) {
          const detail = await safeReadText(response)
          throw new DifyRequestError(
            response.status,
            response.statusText,
            detail ?? undefined,
            response.headers.get('x-request-id') ?? undefined
          )
        }

        if (responseMode === 'streaming') {
          return response
        }

        return (await response.json()) as BlockingResult
      } catch (error) {
        lastError = error
        if (!shouldRetry(error) || attempt === attempts) {
          auditLogger.error({
            action: 'dify.runWorkflow',
            userId: options.user ?? 'server',
            workflowId,
            metadata: { attempt }
          })
          throw error
        }
        await delay(options.retry?.delayMs ?? 1_000)
      }
    }

    throw lastError ?? new Error('Failed to execute Dify workflow')
  }

  async generateSummary(question: string, user?: string): Promise<string> {
    if (!this.isConfigured()) {
      return `针对「${question}」的分析摘要将在配置 Dify 凭据后生成。`
    }

    try {
      const result = (await this.runWorkflow({
        inputs: { question },
        user,
        responseMode: 'blocking'
      })) as BlockingResult

      const candidates = [
        result.answer,
        result.outputs?.find((item) => item?.answer || item?.text)?.answer,
        result.outputs?.find((item) => item?.answer || item?.text)?.text,
        typeof result.data === 'string' ? (result.data as string) : null
      ].filter((value): value is string => Boolean(value && value.trim()))

      return candidates[0] ?? `Dify 未返回内容，请检查工作流设置。`
    } catch (error) {
      auditLogger.error({
        action: 'dify.generateSummary',
        userId: user ?? 'server',
        metadata: { question }
      })
      return `Dify 工作流执行失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  private resolveBaseUrl() {
    return (this.config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  private resolveWorkflowId() {
    return this.config.workflowId ?? DEFAULT_WORKFLOW_ID
  }

  private resolveApiKey() {
    return this.config.apiKey ?? DEFAULT_API_KEY
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text()
  } catch {
    return null
  }
}

function buildMetadata(priority?: DifyPriority, metricsTag?: string) {
  const metadata: Record<string, string> = {}
  if (priority) metadata.priority = priority
  if (metricsTag) metadata.metricsTag = metricsTag
  return Object.keys(metadata).length > 0 ? metadata : undefined
}

function shouldRetry(error: unknown) {
  if (error instanceof DifyRequestError) {
    return error.status >= 500
  }
  if (isAbortError(error)) {
    return false
  }
  return true
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: unknown }
  return typeof candidate.name === 'string' && candidate.name === 'AbortError'
}
