import { type BaseMessage } from '@langchain/core/messages';
import { BaseChatModel, type BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import type { ChatResult } from '@langchain/core/outputs';
type MockChatOptions = BaseChatModelCallOptions & {
    responseFormat?: 'json';
};
export declare class MockChatModel extends BaseChatModel<MockChatOptions> {
    private readonly defaultResponse;
    static lc_name(): string;
    lc_serializable: boolean;
    lc_namespace: string[];
    constructor(defaultResponse?: string);
    _llmType(): string;
    invocationParams(): {};
    _generate(messages: BaseMessage[], options: MockChatOptions): Promise<ChatResult>;
}
export {};
