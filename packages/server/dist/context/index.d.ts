import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { ConversationStore } from '../application/conversation-store.js';
import { TaskEventStore } from '../application/task-event-store.js';
export type GraphQLContext = {
    conversationStore: ConversationStore;
    taskEventStore: TaskEventStore;
    userId: string;
};
export declare function createContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext>;
export declare function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext>;
export declare function getTaskEventStore(): TaskEventStore;
export declare function shutdownContextServices(): Promise<void>;
