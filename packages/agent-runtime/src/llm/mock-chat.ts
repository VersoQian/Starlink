import { AIMessage, type BaseMessage } from '@langchain/core/messages'
import {
  BaseChatModel,
  type BaseChatModelCallOptions
} from '@langchain/core/language_models/chat_models'
import type { ChatGeneration, ChatResult } from '@langchain/core/outputs'

type MockChatOptions = BaseChatModelCallOptions & {
  responseFormat?: 'json'
}

export class MockChatModel extends BaseChatModel<MockChatOptions> {
  static lc_name() {
    return 'MockChatModel'
  }

  lc_serializable = false
  lc_namespace = ['starlink', 'mock']

  constructor(private readonly defaultResponse = 'Mock response from Starlink fallback model.') {
    super({})
  }

  _llmType() {
    return 'mock-chat'
  }

  invocationParams() {
    return {}
  }

  async _generate(messages: BaseMessage[], options: MockChatOptions): Promise<ChatResult> {
    const lastUser = [...messages].reverse().find((message) => message._getType() === 'human')
    let text: string

    if (options?.responseFormat === 'json') {
      text = JSON.stringify(
        {
          charts: [],
          insights: [
            '模拟模型未执行真实分析，请在配置有效的 LLM 凭证后重试。',
            lastUser ? `最近的指令: ${(lastUser.content as string).slice(0, 120)}` : ''
          ].filter(Boolean),
          narrative: '当前为离线模式，未生成可视化规划。',
          followUpActions: ['配置 DEEPSEEK_API_KEY 或 DASHSCOPE_API_KEY 以启用真实分析。'],
          checks: []
        },
        null,
        2
      )
    } else {
      text =
        this.defaultResponse +
        (lastUser ? ` 最近的提问是：「${(lastUser.content as string).slice(0, 60)}」` : '')
    }

    const message = new AIMessage(text)
    const generation: ChatGeneration = {
      text,
      message
    }

    return {
      generations: [generation],
      llmOutput: { mock: true }
    }
  }
}

