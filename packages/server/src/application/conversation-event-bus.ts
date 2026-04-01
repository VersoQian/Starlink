import { PubSub } from 'graphql-subscriptions'
import { nanoid } from 'nanoid'
import pg from 'pg'
import type { ConversationEvent } from '@starlink/shared'

const { Client } = pg

const EVENT_TOPIC = 'conversation-progress'
const DEFAULT_PG_CHANNEL = 'conversation_progress'

type PgNotifyEnvelope = {
  sourceId: string
  event: ConversationEvent
}

export type ConversationEventBus = {
  publish: (event: ConversationEvent) => Promise<void>
  getEventIterator: () => AsyncIterable<{ conversationProgress: ConversationEvent }>
  close: () => Promise<void>
}

class InMemoryConversationEventBus implements ConversationEventBus {
  protected readonly pubSub = new PubSub()

  async publish(event: ConversationEvent) {
    await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: event })
  }

  getEventIterator() {
    return this.pubSub.asyncIterableIterator<{ conversationProgress: ConversationEvent }>(EVENT_TOPIC)
  }

  async close() {}
}

class PgNotifyConversationEventBus extends InMemoryConversationEventBus {
  private readonly sourceId = nanoid(8)
  private readonly connectionString: string
  private readonly channel: string
  private readonly listenClient: InstanceType<typeof Client>
  private readonly publishClient: InstanceType<typeof Client>
  private readonly ready: Promise<void>
  private initialized = false
  private available = false

  constructor(connectionString: string, channel: string) {
    super()
    this.connectionString = connectionString
    this.channel = isValidChannel(channel) ? channel : DEFAULT_PG_CHANNEL
    this.listenClient = new Client({ connectionString: this.connectionString })
    this.publishClient = new Client({ connectionString: this.connectionString })
    this.ready = this.initialize()
  }

  async publish(event: ConversationEvent) {
    await super.publish(event)

    await this.ready
    if (!this.available) return

    const envelope: PgNotifyEnvelope = {
      sourceId: this.sourceId,
      event
    }

    try {
      await this.publishClient.query('SELECT pg_notify($1, $2)', [
        this.channel,
        JSON.stringify(envelope)
      ])
    } catch (error) {
      console.error('[conversation-event-bus] failed to publish PG notification', {
        error: String(error)
      })
      this.available = false
    }
  }

  async close() {
    await this.ready
    if (!this.initialized) return

    await Promise.allSettled([this.listenClient.end(), this.publishClient.end()])
    this.available = false
  }

  private async initialize() {
    if (this.initialized) return
    this.initialized = true

    try {
      await this.listenClient.connect()
      await this.publishClient.connect()

      this.listenClient.on('notification', (message: { payload?: string | null }) => {
        const payload = message.payload
        if (!payload) return

        try {
          const envelope = JSON.parse(payload) as PgNotifyEnvelope
          if (!envelope || envelope.sourceId === this.sourceId) return
          void super.publish(envelope.event)
        } catch (error) {
          console.error('[conversation-event-bus] invalid PG notification payload', {
            error: String(error)
          })
        }
      })

      await this.listenClient.query(`LISTEN "${this.channel}"`)
      this.available = true
    } catch (error) {
      console.error('[conversation-event-bus] failed to initialize pg_notify driver, fallback to local only', {
        error: String(error)
      })
      this.available = false
    }
  }
}

export function createConversationEventBus(): ConversationEventBus {
  const driver = process.env.CONVERSATION_EVENT_BUS_DRIVER ?? 'memory'

  if (driver === 'pg_notify') {
    const connectionString = process.env.CONVERSATION_EVENT_BUS_PG_URL
      ?? process.env.DATABASE_URL
      ?? ''
    if (!connectionString) {
      console.warn('[conversation-event-bus] pg_notify driver requested but no connection string found, fallback to memory')
      return new InMemoryConversationEventBus()
    }

    const channel = process.env.CONVERSATION_EVENT_BUS_PG_CHANNEL ?? DEFAULT_PG_CHANNEL
    return new PgNotifyConversationEventBus(connectionString, channel)
  }

  return new InMemoryConversationEventBus()
}

function isValidChannel(channel: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(channel)
}
