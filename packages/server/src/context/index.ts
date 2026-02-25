import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { PubSub } from 'graphql-subscriptions'
import { ConversationStore } from '../application/conversation-store.js'
import { TaskEventStore } from '../application/task-event-store.js'

export type GraphQLContext = {
  conversationStore: ConversationStore
  taskEventStore: TaskEventStore
  pubSub: PubSub
  userId: string
}

const pubSub = new PubSub()
const conversationStore = new ConversationStore({ pubSub })
const taskEventStore = new TaskEventStore()

export async function createContext(
  { req }: ExpressContextFunctionArgument
): Promise<GraphQLContext> {
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    pubSub,
    userId
  }
}

export async function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext> {
  const userId =
    (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    pubSub,
    userId
  }
}

export function getTaskEventStore() {
  return taskEventStore
}
