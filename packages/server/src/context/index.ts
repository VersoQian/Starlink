import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { PubSub } from 'graphql-subscriptions'
import { ConversationStore } from '../application/conversation-store.js'

export type GraphQLContext = {
  conversationStore: ConversationStore
  pubSub: PubSub
  userId: string
}

const pubSub = new PubSub()
const conversationStore = new ConversationStore({ pubSub })

export async function createContext(
  { req }: ExpressContextFunctionArgument
): Promise<GraphQLContext> {
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous'
  return {
    conversationStore,
    pubSub,
    userId
  }
}

export async function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext> {
  const userId =
    (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous'
  return {
    conversationStore,
    pubSub,
    userId
  }
}
