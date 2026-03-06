'use client'

import { createClient } from 'graphql-ws'
import { getGraphQLWsUrl } from './graphql-client'

export type ConversationProgressEvent = {
  type:
    | 'graph/appended'
    | 'graph/diff'
    | 'status'
    | 'phase.changed'
    | 'seminar.turn.completed'
    | 'seminar.decision.made'
  conversationId: string
  status?: 'idle' | 'running' | 'failed' | 'completed'
  message?: string | null
  payload?: unknown
}

type EventListener = (event: ConversationProgressEvent) => void

type WatchConversationOptions = {
  conversationId: string
  onGraphAppended?: (payload: unknown) => void
  onGraphDiff?: (payload: unknown) => void
}

const CONVERSATION_PROGRESS_SUBSCRIPTION = /* GraphQL */ `
  subscription ConversationProgress {
    conversationProgress {
      type
      conversationId
      status
      message
      payload
    }
  }
`

class ConversationSyncEngine {
  private wsClient: ReturnType<typeof createClient> | null = null
  private streamDispose: (() => void) | null = null
  private readonly listeners = new Set<EventListener>()

  subscribe(listener: EventListener) {
    this.listeners.add(listener)
    this.ensureStream()

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopStream()
      }
    }
  }

  private ensureStream() {
    if (this.streamDispose) return

    if (!this.wsClient) {
      this.wsClient = createClient({
        url: getGraphQLWsUrl(),
        lazy: true
      })
    }

    this.streamDispose = this.wsClient.subscribe(
      { query: CONVERSATION_PROGRESS_SUBSCRIPTION },
      {
        next: ({ data }) => {
          const event = (data as { conversationProgress?: ConversationProgressEvent })?.conversationProgress
          if (!event || typeof event.type !== 'string') return

          for (const listener of this.listeners) {
            listener(event)
          }
        },
        error: () => {
          this.stopStream()
          if (this.listeners.size > 0) {
            setTimeout(() => this.ensureStream(), 1000)
          }
        },
        complete: () => {
          this.stopStream()
          if (this.listeners.size > 0) {
            setTimeout(() => this.ensureStream(), 1000)
          }
        }
      }
    )
  }

  private stopStream() {
    if (!this.streamDispose) return
    this.streamDispose()
    this.streamDispose = null
  }
}

const conversationSyncEngine = new ConversationSyncEngine()

export function subscribeConversationProgress(listener: EventListener) {
  return conversationSyncEngine.subscribe(listener)
}

export function watchConversation(options: WatchConversationOptions) {
  let cancel = () => {}

  const done = new Promise<void>((resolve, reject) => {
    cancel = subscribeConversationProgress((event) => {
      if (event.conversationId !== options.conversationId) return

      if (event.type === 'graph/appended' && event.payload) {
        options.onGraphAppended?.(event.payload)
      }

      if (event.type === 'graph/diff' && event.payload) {
        options.onGraphDiff?.(event.payload)
      }

      if (event.type === 'status') {
        if (event.status === 'completed') {
          cancel()
          resolve()
        }
        if (event.status === 'failed') {
          cancel()
          reject(new Error(event.message ?? 'conversation failed'))
        }
      }
    })
  })

  return {
    done,
    cancel: () => {
      cancel()
    }
  }
}
