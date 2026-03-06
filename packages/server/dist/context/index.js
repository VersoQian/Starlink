import { ConversationStore } from '../application/conversation-store.js';
import { TaskEventStore } from '../application/task-event-store.js';
import { createConversationEventBus } from '../application/conversation-event-bus.js';
import { createConversationRuntimeRepository } from '../application/conversation-runtime-repository.js';
const conversationEventBus = createConversationEventBus();
const conversationRuntimeRepository = createConversationRuntimeRepository();
const conversationStore = new ConversationStore({
    eventBus: conversationEventBus,
    runtimeRepository: conversationRuntimeRepository
});
const taskEventStore = new TaskEventStore();
export async function createContext({ req }) {
    const userId = req.headers['x-user-id'] ?? 'anonymous';
    return {
        conversationStore,
        taskEventStore,
        userId
    };
}
export async function createWsContext(connectionParams) {
    const userId = (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous';
    return {
        conversationStore,
        taskEventStore,
        userId
    };
}
export function getTaskEventStore() {
    return taskEventStore;
}
export async function shutdownContextServices() {
    await taskEventStore.close();
    await conversationStore.close();
}
