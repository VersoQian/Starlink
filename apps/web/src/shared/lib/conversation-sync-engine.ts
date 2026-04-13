'use client'

import { createClient } from 'graphql-ws'
import { getCurrentViewerId } from './viewer-identity'
import { getGraphQLWsUrl } from './graphql-client'

export type ConversationProgressEvent = {
  type:
    | 'graph/appended'
    | 'graph/diff'
    | 'status'
    | 'phase.changed'
    | 'seminar.turn.completed'
    | 'seminar.decision.made'
    | 'seminar.decision.requested'
  conversationId: string
  status?: 'idle' | 'running' | 'failed' | 'completed'
  message?: string | null
  payload?: unknown
}

export type ConversationProgressScope = {
  workspaceId: string
  conversationId?: string
}

type EventListener = (event: ConversationProgressEvent) => void

type SubscriptionListener = {
  onEvent: EventListener
  onReconnect?: () => void | Promise<void>
}

type ScopedStream = {
  scope: ConversationProgressScope
  listeners: Set<SubscriptionListener>
  dispose: (() => void) | null
}

type WatchConversationOptions = {
  workspaceId: string
  conversationId: string
  onGraphAppended?: (payload: unknown) => void
  onGraphDiff?: (payload: unknown) => void
  onEvent?: (event: ConversationProgressEvent) => void
  loadLatestGraph?: () => Promise<unknown>
}

const CONVERSATION_PROGRESS_SUBSCRIPTION = /* GraphQL */ `
  subscription ConversationProgress($workspaceId: ID!, $conversationId: ID) {
    conversationProgress(workspaceId: $workspaceId, conversationId: $conversationId) {
      type
      conversationId
      status
      message
      payload
    }
  }
`

class ConversationSyncEngine {
  private readonly streams = new Map<string, ScopedStream>()
  private readonly wsClient = createClient({
    url: getGraphQLWsUrl(),
    lazy: true,
    retryAttempts: 8,
    retryWait: async (retries) => {
      const baseDelayMs = Math.min(1000 * (2 ** retries), 15000)
      const jitterMs = Math.floor(Math.random() * 800)
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs + jitterMs))
    },
    connectionParams: async () => ({
      'x-user-id': getCurrentViewerId()
    }),
    on: {
      connected: (_socket, _payload, retrying) => {
        if (!retrying) return
        for (const stream of this.streams.values()) {
          for (const listener of stream.listeners) {
            void listener.onReconnect?.()
          }
        }
      }
    }
  })

  subscribe(
    scope: ConversationProgressScope,
    listener: EventListener,
    options?: { onReconnect?: () => void | Promise<void> }
  ) {
    const key = buildScopeKey(scope)
    const scopedListener: SubscriptionListener = {
      onEvent: listener,
      onReconnect: options?.onReconnect
    }

    let stream = this.streams.get(key)
    if (!stream) {
      stream = {
        scope,
        listeners: new Set<SubscriptionListener>(),
        dispose: null
      }
      this.streams.set(key, stream)
      this.startStream(stream)
    }

    stream.listeners.add(scopedListener)

    return () => {
      const active = this.streams.get(key)
      if (!active) return
      active.listeners.delete(scopedListener)
      if (active.listeners.size > 0) return
      active.dispose?.()
      this.streams.delete(key)
    }
  }

  private startStream(stream: ScopedStream) {
    stream.dispose = this.wsClient.subscribe(
      {
        query: CONVERSATION_PROGRESS_SUBSCRIPTION,
        variables: {
          workspaceId: stream.scope.workspaceId,
          conversationId: stream.scope.conversationId ?? null
        }
      },
      {
        next: ({ data }) => {
          const event = (data as { conversationProgress?: ConversationProgressEvent })?.conversationProgress
          if (!event || typeof event.type !== 'string') return
          for (const listener of stream.listeners) {
            listener.onEvent(event)
          }
        },
        error: (error) => {
          console.error('[conversation-sync-engine] subscription error', error)
        },
        complete: () => {
          // The graphql-ws client handles socket-level retries itself.
        }
      }
    )
  }
}

const conversationSyncEngine = new ConversationSyncEngine()

export function subscribeConversationProgress(
  scope: ConversationProgressScope,
  listener: EventListener,
  options?: { onReconnect?: () => void | Promise<void> }
) {
  return conversationSyncEngine.subscribe(scope, listener, options)
}

export function watchConversation(options: WatchConversationOptions) {
  let cancel = () => {}

  const done = new Promise<void>((resolve, reject) => {
    cancel = subscribeConversationProgress(
      {
        workspaceId: options.workspaceId,
        conversationId: options.conversationId
      },
      (event) => {
        options.onEvent?.(event)

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
      },
      {
        onReconnect: async () => {
          const latestGraph = await options.loadLatestGraph?.()
          if (latestGraph) {
            options.onGraphAppended?.(latestGraph)
          }
        }
      }
    )
  })

  return {
    done,
    cancel: () => {
      cancel()
    }
  }
}

function buildScopeKey(scope: ConversationProgressScope) {
  return `${scope.workspaceId}:${scope.conversationId ?? '*'}`
}
