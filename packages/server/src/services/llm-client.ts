/**
 * Unified LLM Client — wraps OpenAI-compatible chat completion APIs.
 * Supports function calling (tool use), streaming, and configurable providers.
 */

export interface LLMToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: LLMToolCall[]
  tool_call_id?: string
}

export interface LLMResponse {
  content: string | null
  toolCalls: LLMToolCall[]
  finishReason: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
}

export interface LLMChatOptions {
  messages: LLMMessage[]
  tools?: LLMToolSchema[]
  model?: string
  temperature?: number
  maxTokens?: number
}

export class LLMClient {
  private baseURL: string
  private apiKey: string
  private defaultModel: string

  constructor(options?: { baseURL?: string; apiKey?: string; defaultModel?: string }) {
    this.baseURL = options?.baseURL ?? process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1'
    this.apiKey = options?.apiKey ?? process.env.LLM_API_KEY ?? ''
    this.defaultModel = options?.defaultModel ?? process.env.LLM_MODEL ?? 'gpt-4o-mini'
  }

  /**
   * P11.17 · retry envelope.
   *
   * Every LLM call gets:
   *   - per-call timeout (default 60s, configurable LLM_TIMEOUT_MS)
   *   - exponential backoff retry on retryable failures (5xx, 408, 429,
   *     network errors). Default 2 retries → 1s, 3s.
   *   - fail-fast on non-retryable (400 bad request, 401 auth, parse errors)
   *
   * Why retry: DeepSeek (and proxies) intermittently return 502 / connection
   * resets. Before this envelope a single transient failure killed the whole
   * BMC round (9 cell agents → 1 fails → user sees 0 cell). With 2 retries the
   * effective error budget moves from "any one call" to "all 3 attempts fail".
   */
  async chat(options: LLMChatOptions): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.defaultModel,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools
      body.tool_choice = 'auto'
    }

    const maxRetries = Number(process.env.LLM_MAX_RETRIES ?? '2')
    const timeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? '60000')
    let lastError: unknown = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), timeoutMs)
      try {
        const res = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: ac.signal,
        })
        clearTimeout(timer)

        if (!res.ok) {
          const text = await res.text()
          // Retryable HTTP statuses: 408 (timeout), 429 (rate limit), 5xx
          const retryable = res.status === 408 || res.status === 429 || res.status >= 500
          if (retryable && attempt < maxRetries) {
            const backoff = Math.min(15000, 1000 * Math.pow(3, attempt)) + Math.floor(Math.random() * 500)
            console.warn(`[llm-client] HTTP ${res.status} (retryable), attempt ${attempt + 1}/${maxRetries + 1}, retry in ${backoff}ms`)
            await new Promise((r) => setTimeout(r, backoff))
            continue
          }
          throw new Error(`LLM API error ${res.status}: ${text.slice(0, 300)}`)
        }

        const data = (await res.json()) as {
          choices: Array<{
            message: { content: string | null; tool_calls?: LLMToolCall[] }
            finish_reason: string
          }>
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
        }

        const choice = data.choices[0]
        return {
          content: choice.message.content,
          toolCalls: choice.message.tool_calls ?? [],
          finishReason: choice.finish_reason,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        }
      } catch (err) {
        clearTimeout(timer)
        const errStr = err instanceof Error ? err.message : String(err)
        // AbortError (timeout) and connection errors are retryable.
        const isAbort = err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(errStr))
        const isNetwork = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up/i.test(errStr)
        const retryable = isAbort || isNetwork
        if (retryable && attempt < maxRetries) {
          const backoff = Math.min(15000, 1000 * Math.pow(3, attempt)) + Math.floor(Math.random() * 500)
          console.warn(`[llm-client] ${isAbort ? 'timeout' : 'network'} error (retryable), attempt ${attempt + 1}/${maxRetries + 1}, retry in ${backoff}ms — ${errStr.slice(0, 120)}`)
          await new Promise((r) => setTimeout(r, backoff))
          lastError = err
          continue
        }
        throw err
      }
    }
    // Unreachable in practice (loop always either returns or throws), but
    // satisfies TS exhaustiveness.
    throw lastError ?? new Error('LLM client retries exhausted')
  }

  buildToolSchema(
    name: string,
    description: string,
    parameters: Record<string, unknown>,
  ): LLMToolSchema {
    return {
      type: 'function',
      function: { name, description, parameters },
    }
  }
}
