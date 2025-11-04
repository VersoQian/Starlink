import {
  AIMessage,
  type BaseMessage
} from '@langchain/core/messages'
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams
} from '@langchain/core/language_models/chat_models'
import type { ChatResult, ChatGeneration } from '@langchain/core/outputs'

type TongyiChatFields = BaseChatModelParams & {
  apiKey?: string
  model?: string
  temperature?: number
  endpoint?: string
  timeoutMs?: number
}

export type TongyiChatCallOptions = BaseChatModelCallOptions & {
  responseFormat?: 'text' | 'json'
}

type TongyiResponse = {
  output?: {
    text?: string
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>
      }
    }>
  }
  message?: string
  msg?: string
  code?: number | string
}

export class TongyiChatModel extends BaseChatModel<TongyiChatCallOptions> {
  static lc_name() {
    return 'TongyiChatModel'
  }

  lc_serializable = true
  lc_namespace = ['starlink', 'tongyi']

  private readonly apiKey: string
  private readonly model: string
  private readonly temperature: number
  private readonly endpoint: string
  private readonly timeoutMs: number

  constructor(fields: TongyiChatFields = {}) {
    super(fields)
    this.apiKey =
      fields.apiKey ??
      process.env.DASHSCOPE_API_KEY ??
      process.env.TONGYI_API_KEY ??
      process.env.QWEN_API_KEY ??
      ''

    if (!this.apiKey) {
      throw new Error(
        'TongyiChatModel requires DASHSCOPE_API_KEY (or TONGYI_API_KEY / QWEN_API_KEY) to be set'
      )
    }

    this.model =
      fields.model ??
      process.env.TONGYI_MODEL ??
      process.env.DASHSCOPE_MODEL ??
      process.env.QWEN_MODEL ??
      'qwen-plus'

    this.temperature = fields.temperature ?? Number(process.env.TONGYI_TEMPERATURE ?? '0')
    this.endpoint =
      fields.endpoint ??
      process.env.TONGYI_API_URL ??
      process.env.DASHSCOPE_API_URL ??
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
    this.timeoutMs = fields.timeoutMs ?? 60000
  }

  _llmType() {
    return 'tongyi-qianwen'
  }

  invocationParams() {
    return {
      model: this.model,
      temperature: this.temperature
    }
  }

  private toTongyiMessages(messages: BaseMessage[]) {
    return messages.map((message) => {
      const type = message._getType()
      const content =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content, (_, value) => value ?? null)

      if (type === 'human') {
        return { role: 'user', content }
      }
      if (type === 'ai') {
        return { role: 'assistant', content }
      }
      if (type === 'system') {
        return { role: 'system', content }
      }
      // Tool & other message types are passed back to the assistant role with metadata.
      return {
        role: 'assistant',
        content: `[tool:${message.name ?? 'unknown'}] ${content}`
      }
    })
  }

  private extractContent(payload: TongyiResponse) {
    const choice = payload.output?.choices?.[0]
    const choiceContent = choice?.message?.content

    if (typeof choiceContent === 'string') {
      return choiceContent
    }

    if (Array.isArray(choiceContent)) {
      const text = choiceContent
        .map((segment) => segment?.text)
        .filter((segment): segment is string => typeof segment === 'string')
        .join('')
      if (text) return text
    }

    if (typeof payload.output?.text === 'string') {
      return payload.output.text
    }

    return null
  }

  private sanitizeJsonBlock(text: string) {
    const trimmed = text.trim()
    const fencedMatch = trimmed.match(/```json([\s\S]*?)```/i)
    if (fencedMatch && fencedMatch[1]) {
      return fencedMatch[1].trim()
    }
    const genericFence = trimmed.match(/```([\s\S]*?)```/)
    if (genericFence && genericFence[1]) {
      return genericFence[1].trim()
    }
    return trimmed
  }

  async _generate(messages: BaseMessage[], options: TongyiChatCallOptions): Promise<ChatResult> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      signal: options?.signal,
      body: JSON.stringify({
        model: this.model,
        input: {
          messages: this.toTongyiMessages(messages)
        },
        parameters: {
          result_format: options?.responseFormat === 'json' ? 'json_object' : 'message',
          temperature: this.temperature
        }
      })
    })

    const data = (await response.json()) as TongyiResponse

    if (!response.ok) {
      const reason = data?.message ?? data?.msg ?? 'Unknown Tongyi Qianwen error'
      throw new Error(`Tongyi Qianwen request failed (${response.status}): ${reason}`)
    }

    const content = this.extractContent(data)
    if (!content) {
      throw new Error('Tongyi Qianwen response did not include assistant content')
    }

    const message = new AIMessage(content)
    const generation: ChatGeneration = {
      text: options?.responseFormat === 'json' ? this.sanitizeJsonBlock(content) : content,
      message
    }

    return {
      generations: [generation],
      llmOutput: { raw: data }
    }
  }
}
