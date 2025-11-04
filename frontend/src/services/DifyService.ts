import { getDifyWorkflow } from '../config/dify'

export type ExecuteWorkflowOptions = {
  workflowId: string
  inputs: Record<string, unknown>
  user?: string
  extra?: Record<string, unknown>
  responseMode?: 'blocking' | 'streaming'
  signal?: AbortSignal
  timeoutMs?: number
}

export type DifyBlockingResult = {
  data: unknown
  usage?: {
    total_tokens?: number
  }
  [key: string]: unknown
}

const DEFAULT_TIMEOUT = 60_000

export class DifyService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async executeWorkflow(options: ExecuteWorkflowOptions): Promise<DifyBlockingResult | Response> {
    const workflow = getDifyWorkflow(options.workflowId)
    const responseMode = options.responseMode ?? workflow.mode
    const controller = new AbortController()

    const timeout = setTimeout(() => {
      controller.abort()
    }, options.timeoutMs ?? DEFAULT_TIMEOUT)

    try {
      const baseUrl = removeTrailingSlash(workflow.baseUrl ?? '')
      const response = await this.fetchImpl(`${baseUrl}/workflows/run`, {
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
          ...options.extra
        }),
        signal: mergeSignals(options.signal, controller.signal)
      })

      if (!response.ok) {
        const detail = await safeReadText(response)
        throw new Error(
          `Dify request failed (${response.status} ${response.statusText}): ${detail ?? 'no body'}`
        )
      }

      if (responseMode === 'streaming') {
        return response
      }

      return (await response.json()) as DifyBlockingResult
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
