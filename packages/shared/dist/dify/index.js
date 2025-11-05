export const DIFY_WORKFLOW_MODES = ['blocking', 'streaming']
export class DifyRequestError extends Error {
  constructor(status, statusText, detail, requestId) {
    super(`Dify request failed (${status} ${statusText}): ${detail ?? 'no detail'}`)
    this.status = status
    this.statusText = statusText
    this.detail = detail
    this.requestId = requestId
    this.name = 'DifyRequestError'
  }
}
export class DifyClient {
  constructor(options) {
    this.options = options
    this.fetchImpl = options.fetchImpl ?? fetch
  }
  async runWorkflow(options) {
    const responseMode = options.responseMode ?? 'blocking'
    const response = await this.fetchImpl(this.resolveUrl('/workflows/run'), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        workflow_id: this.options.appId,
        response_mode: responseMode,
        user: options.user,
        inputs: options.inputs,
        metadata: this.createMetadata(options),
        ...options.extra
      }),
      signal: options.signal
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
    return await response.json()
  }
  resolveUrl(path) {
    return `${this.options.baseUrl.replace(/\/$/, '')}${path}`
  }
  buildHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.options.apiKey}`
    }
    if (this.options.appId) {
      headers['x-app-id'] = this.options.appId
    }
    return headers
  }
  createMetadata(options) {
    const metadata = {}
    if (options.priority) {
      metadata.priority = options.priority
    }
    if (options.metricsTag) {
      metadata.metricsTag = options.metricsTag
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined
  }
}
export async function readErrorDetail(response) {
  const raw = await safeReadText(response)
  if (!raw) return undefined
  try {
    const json = JSON.parse(raw)
    return (json?.error?.message ?? json?.message) ?? raw
  } catch (error) {
    return raw
  }
}
export async function safeReadText(response) {
  try {
    return await response.text()
  } catch (error) {
    return undefined
  }
}
