import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { PubSub } from 'graphql-subscriptions';
import { ConversationStore } from '../application/conversation-store.js';
export type GraphQLContext = {
    conversationStore: ConversationStore;
    pubSub: PubSub;
    userId: string;
};
export declare function createContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext>;
export declare function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext>;
