import { PubSub } from 'graphql-subscriptions';
import { ConversationStore } from '../application/conversation-store.js';
const pubSub = new PubSub();
const conversationStore = new ConversationStore({ pubSub });
export async function createContext({ req }) {
    const userId = req.headers['x-user-id'] ?? 'anonymous';
    return {
        conversationStore,
        pubSub,
        userId
    };
}
export async function createWsContext(connectionParams) {
    const userId = (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous';
    return {
        conversationStore,
        pubSub,
        userId
    };
}
