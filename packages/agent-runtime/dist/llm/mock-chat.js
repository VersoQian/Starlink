import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
export class MockChatModel extends BaseChatModel {
    static lc_name() {
        return 'MockChatModel';
    }
    constructor(defaultResponse = 'Mock response from Starlink fallback model.') {
        super({});
        this.defaultResponse = defaultResponse;
        this.lc_serializable = false;
        this.lc_namespace = ['starlink', 'mock'];
    }
    _llmType() {
        return 'mock-chat';
    }
    invocationParams() {
        return {};
    }
    async _generate(messages, options) {
        const lastUser = [...messages].reverse().find((message) => message._getType() === 'human');
        let text;
        if (options?.responseFormat === 'json') {
            text = JSON.stringify({
                charts: [],
                insights: [
                    '模拟模型未执行真实分析，请在配置有效的 LLM 凭证后重试。',
                    lastUser ? `最近的指令: ${lastUser.content.slice(0, 120)}` : ''
                ].filter(Boolean),
                narrative: '当前为离线模式，未生成可视化规划。',
                followUpActions: ['配置 DEEPSEEK_API_KEY 或 DASHSCOPE_API_KEY 以启用真实分析。'],
                checks: []
            }, null, 2);
        }
        else {
            text =
                this.defaultResponse +
                    (lastUser ? ` 最近的提问是：「${lastUser.content.slice(0, 60)}」` : '');
        }
        const message = new AIMessage(text);
        const generation = {
            text,
            message
        };
        return {
            generations: [generation],
            llmOutput: { mock: true }
        };
    }
}
