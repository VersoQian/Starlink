import { type BaseMessage } from '@langchain/core/messages';
import { BaseChatModel, type BaseChatModelCallOptions, type BaseChatModelParams } from '@langchain/core/language_models/chat_models';
import type { ChatResult } from '@langchain/core/outputs';
type TongyiChatFields = BaseChatModelParams & {
    apiKey?: string;
    model?: string;
    temperature?: number;
    endpoint?: string;
    timeoutMs?: number;
};
export type TongyiChatCallOptions = BaseChatModelCallOptions & {
    responseFormat?: 'text' | 'json';
};
export declare class TongyiChatModel extends BaseChatModel<TongyiChatCallOptions> {
    static lc_name(): string;
    lc_serializable: boolean;
    lc_namespace: string[];
    private readonly apiKey;
    private readonly model;
    private readonly temperature;
    private readonly endpoint;
    private readonly timeoutMs;
    constructor(fields?: TongyiChatFields);
    _llmType(): string;
    invocationParams(): {
        model: string;
        temperature: number;
    };
    private toTongyiMessages;
    private extractContent;
    private sanitizeJsonBlock;
    _generate(messages: BaseMessage[], options: TongyiChatCallOptions): Promise<ChatResult>;
}
export {};
