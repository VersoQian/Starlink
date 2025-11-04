import { AIMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
export class DeepseekChatModel extends BaseChatModel {
    static lc_name() {
        return 'DeepseekChatModel';
    }
    constructor(fields = {}) {
        super(fields);
        this.lc_serializable = true;
        this.lc_namespace = ['starlink', 'deepseek'];
        this.apiKey = fields.apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
        if (!this.apiKey) {
            throw new Error('DeepseekChatModel requires DEEPSEEK_API_KEY to be set');
        }
        this.model = fields.model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
        this.temperature = fields.temperature ?? Number(process.env.DEEPSEEK_TEMPERATURE ?? '0');
        this.endpoint =
            fields.endpoint ??
                process.env.DEEPSEEK_API_URL ??
                'https://api.deepseek.com/v1/chat/completions';
        this.maxOutputTokens =
            fields.maxOutputTokens ??
                (process.env.DEEPSEEK_MAX_OUTPUT_TOKENS
                    ? Number(process.env.DEEPSEEK_MAX_OUTPUT_TOKENS)
                    : undefined);
        this.timeoutMs = fields.timeoutMs ?? 60000;
    }
    _llmType() {
        return 'deepseek-chat';
    }
    invocationParams() {
        return {
            model: this.model,
            temperature: this.temperature,
            max_output_tokens: this.maxOutputTokens
        };
    }
    toDeepseekMessages(messages) {
        return messages.map((message) => {
            const type = message._getType();
            const content = typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content, (_, value) => value ?? null);
            if (type === 'human') {
                return { role: 'user', content };
            }
            if (type === 'ai') {
                return { role: 'assistant', content };
            }
            if (type === 'system') {
                return { role: 'system', content };
            }
            return {
                role: 'assistant',
                content: `[tool:${message.name ?? 'unknown'}] ${content}`
            };
        });
    }
    extractContent(data) {
        const choice = data.choices?.[0];
        if (!choice)
            return null;
        const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.message?.parts;
        if (!content)
            return null;
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            const text = content
                .map((segment) => {
                if (typeof segment === 'string')
                    return segment;
                if (segment && typeof segment.text === 'string')
                    return segment.text;
                if (segment && typeof segment.content === 'string')
                    return segment.content;
                return '';
            })
                .join('');
            return text || null;
        }
        if (typeof content.text === 'string') {
            return content.text;
        }
        return null;
    }
    sanitizeJsonBlock(text) {
        const trimmed = text.trim();
        const fencedMatch = trimmed.match(/```json([\s\S]*?)```/i);
        if (fencedMatch && fencedMatch[1]) {
            return fencedMatch[1].trim();
        }
        const genericFence = trimmed.match(/```([\s\S]*?)```/);
        if (genericFence && genericFence[1]) {
            return genericFence[1].trim();
        }
        return trimmed;
    }
    async _generate(messages, options) {
        const controller = options?.signal ? undefined : new AbortController();
        const payload = {
            model: this.model,
            messages: this.toDeepseekMessages(messages),
            temperature: this.temperature,
            stream: false
        };
        if (typeof this.maxOutputTokens === 'number') {
            payload.max_output_tokens = this.maxOutputTokens;
        }
        if (options?.responseFormat === 'json') {
            payload.response_format = { type: 'json_object' };
        }
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`
            },
            signal: options?.signal ?? controller?.signal,
            body: JSON.stringify(payload)
        });
        const data = (await response.json());
        if (!response.ok) {
            const reason = data?.error?.message ??
                data?.error?.type ??
                data?.error?.code ??
                `HTTP ${response.status}`;
            throw new Error(`DeepSeek request failed: ${reason}`);
        }
        const content = this.extractContent(data);
        if (!content) {
            throw new Error('DeepSeek response did not include assistant content');
        }
        const finalText = options?.responseFormat === 'json' ? this.sanitizeJsonBlock(content) : content;
        const generation = {
            text: finalText,
            message: new AIMessage(content)
        };
        return {
            generations: [generation],
            llmOutput: { raw: data }
        };
    }
}
