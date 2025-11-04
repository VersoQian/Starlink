import { type BaseMessage } from '@langchain/core/messages';
import { BaseChatModel, type BaseChatModelCallOptions, type BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import type { ChatResult } from '@langchain/core/outputs';
type DeepseekChatFields = BaseChatModelParams & {
    apiKey?: string;
    model?: string;
    temperature?: number;
    endpoint?: string;
    maxOutputTokens?: number;
    timeoutMs?: number;
};
export type DeepseekChatCallOptions = BaseChatModelCallOptions & {
    responseFormat?: 'text' | 'json';
};
export declare class DeepseekChatModel extends BaseChatModel<DeepseekChatCallOptions> {
    static lc_name(): string;
    lc_serializable: boolean;
    lc_namespace: string[];
    private readonly apiKey;
    private readonly model;
    private readonly temperature;
    private readonly endpoint;
    private readonly maxOutputTokens?;
    private readonly timeoutMs;
    constructor(fields?: DeepseekChatFields);
    _llmType(): string;
    invocationParams(): {
        model: string;
        temperature: number;
        max_output_tokens: number | undefined;
    };
    private toDeepseekMessages;
    private extractContent;
    private sanitizeJsonBlock;
    _generate(messages: BaseMessage[], options: DeepseekChatCallOptions): Promise<ChatResult>;
}
export {};
