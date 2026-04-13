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

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LLM API error ${res.status}: ${text}`)
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
