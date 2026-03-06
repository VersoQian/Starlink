import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { ConversationStore } from '../application/conversation-store.js'
import { TaskEventStore } from '../application/task-event-store.js'
import { createConversationEventBus } from '../application/conversation-event-bus.js'
import { createConversationRuntimeRepository } from '../application/conversation-runtime-repository.js'

export type GraphQLContext = {
  conversationStore: ConversationStore
  taskEventStore: TaskEventStore
  userId: string
}

const conversationEventBus = createConversationEventBus()
const conversationRuntimeRepository = createConversationRuntimeRepository()
const conversationStore = new ConversationStore({
  eventBus: conversationEventBus,
  runtimeRepository: conversationRuntimeRepository
})
const taskEventStore = new TaskEventStore()

export async function createContext(
  { req }: ExpressContextFunctionArgument
): Promise<GraphQLContext> {
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    userId
  }
}

export async function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext> {
  const userId =
    (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    userId
  }
}

export function getTaskEventStore() {
  return taskEventStore
}

export async function shutdownContextServices() {
  await taskEventStore.close()
  await conversationStore.close()
}
