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
  responseMode?: 'blocking' | 'streaming'
  signal?: AbortSignal
}

type BlockingResult = {
  answer?: string
  outputs?: Array<{ text?: string; answer?: string }>
  data?: unknown
  [key: string]: unknown
}

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

    const responseMode = options.responseMode ?? 'blocking'
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
        inputs: options.inputs
      }),
      signal: options.signal
    })

    if (!response.ok) {
      const detail = await safeReadText(response)
      throw new Error(
        `Dify request failed (${response.status} ${response.statusText}): ${detail ?? 'no message'}`
      )
    }

    if (responseMode === 'streaming') {
      return response
    }

    return (await response.json()) as BlockingResult
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
      console.warn('[dify-server] workflow failed, fallback to placeholder', error)
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
