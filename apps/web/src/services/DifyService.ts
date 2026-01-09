import {
  DifyRequestError,
  type DifyPriority,
  type DifyRetryConfig
} from '@starlink/shared'
import { getDifyBaseUrl, getDifyWorkflow } from '../config/dify'

export type ExecuteWorkflowOptions = {
  workflowId: string
  inputs: Record<string, unknown>
  user?: string
  extra?: Record<string, unknown>
  responseMode?: 'blocking' | 'streaming'
  signal?: AbortSignal
  timeoutMs?: number
  retry?: DifyRetryConfig
  priority?: DifyPriority
  metricsTag?: string
}

export type DifyBlockingResult = {
  data: unknown
  usage?: {
    total_tokens?: number
  }
  [key: string]: unknown
}

const DEFAULT_TIMEOUT = 60_000
const DEFAULT_RETRY_DELAY = 1_000

export class DifyService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async executeWorkflow(options: ExecuteWorkflowOptions): Promise<DifyBlockingResult | Response> {
    const workflow = getDifyWorkflow(options.workflowId)
    const responseMode = options.responseMode ?? workflow.mode
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT)
    const attempts = Math.max(options.retry?.attempts ?? 1, 1)
    const priority = options.priority ?? workflow.defaultPriority
    const metricsTag = options.metricsTag ?? workflow.metricsTag

    try {
      let lastError: unknown
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const response = await this.fetchImpl(`${resolveBaseUrl(workflow.baseUrl)}/workflows/run`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${workflow.apiKey}`,
              'x-app-id': workflow.appId
            },
            body: JSON.stringify({
              workflow_id: workflow.appId,
              response_mode: responseMode,
              user: options.user,
              inputs: options.inputs,
              metadata: buildMetadata(priority, metricsTag),
              ...options.extra
            }),
            signal: mergeSignals(options.signal, controller.signal)
          })

          if (!response.ok) {
            const detail = await readErrorDetail(response)
            throw new DifyRequestError(
              response.status,
              response.statusText,
              detail,
              response.headers.get('x-request-id') ?? undefined
            )
          }

          if (responseMode === 'streaming') {
            return response
          }

          return (await response.json()) as DifyBlockingResult
        } catch (error) {
          lastError = error
          if (!shouldRetry(error) || attempt === attempts) {
            throw error
          }
          await delay(options.retry?.delayMs ?? DEFAULT_RETRY_DELAY)
        }
      }

      throw lastError ?? new Error('Dify workflow execution failed')
    } finally {
      clearTimeout(timeout)
    }
  }
}

function mergeSignals(signalA?: AbortSignal, signalB?: AbortSignal) {
  if (!signalA) return signalB
  if (!signalB) return signalA

  const controller = new AbortController()
  const onAbort = (event: Event) => {
    if ((event.target as AbortSignal).aborted) {
      controller.abort()
    }
  }
  signalA.addEventListener('abort', onAbort, { once: true })
  signalB.addEventListener('abort', onAbort, { once: true })
  return controller.signal
}

async function safeReadText(response: Response) {
  try {
    return await response.text()
  } catch (error) {
    console.warn('[dify] Failed to read error body', error)
    return null
  }
}

function removeTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function resolveBaseUrl(baseUrl?: string) {
  const resolved = baseUrl ?? getDifyBaseUrl()
  return removeTrailingSlash(resolved)
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

async function readErrorDetail(response: Response) {
  const raw = await safeReadText(response)
  if (!raw) return undefined
  try {
    const data = JSON.parse(raw) as { error?: { message?: string }; message?: string }
    return data.error?.message ?? data.message ?? raw
  } catch {
    return raw
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: unknown }
  return typeof candidate.name === 'string' && candidate.name === 'AbortError'
}
