import { Redis } from 'ioredis'
import type {
  CanvasGraph,
  ConversationMetadata,
  KnowledgeEvidence
} from '@starlink/shared'

export type ConversationRecord = {
  metadata: ConversationMetadata
  graph: CanvasGraph
  knowledgeEvidence: KnowledgeEvidence[]
}

export type ConversationRuntimeRepository = {
  createConversation: (id: string, record: ConversationRecord) => Promise<void>
  updateConversation: (id: string, record: ConversationRecord) => Promise<void>
  touchConversation: (id: string) => Promise<void>
  getConversation: (id: string) => Promise<ConversationRecord | null>
  getConversationsByWorkspace: (workspaceId: string) => Promise<Array<{ id: string; record: ConversationRecord }>>
  setWorkspaceGraph: (workspaceId: string, graph: CanvasGraph) => Promise<void>
  getWorkspaceGraph: (workspaceId: string) => Promise<CanvasGraph | null>
  close: () => Promise<void>
}

type SerializableConversationRecord = {
  metadata: Omit<ConversationMetadata, 'createdAt' | 'updatedAt'> & {
    createdAt: string
    updatedAt: string
  }
  graph: CanvasGraph
  knowledgeEvidence: KnowledgeEvidence[]
}

type RepositoryConfig = {
  maxConversations: number
  conversationTtlMs: number
}

class InMemoryConversationRuntimeRepository implements ConversationRuntimeRepository {
  private readonly conversations = new Map<string, ConversationRecord>()
  private readonly touchedAt = new Map<string, number>()
  private readonly workspaceGraphs = new Map<string, CanvasGraph>()
  private readonly maxConversations: number
  private readonly conversationTtlMs: number

  constructor(config: RepositoryConfig) {
    this.maxConversations = config.maxConversations
    this.conversationTtlMs = config.conversationTtlMs
  }

  async createConversation(id: string, record: ConversationRecord) {
    this.conversations.set(id, cloneRecord(record))
    this.touch(id)
    this.cleanup()
  }

  async updateConversation(id: string, record: ConversationRecord) {
    this.conversations.set(id, cloneRecord(record))
    this.touch(id)
    this.cleanup()
  }

  async touchConversation(id: string) {
    if (!this.conversations.has(id)) return
    this.touch(id)
  }

  async getConversation(id: string) {
    const record = this.conversations.get(id)
    if (!record) return null
    this.touch(id)
    return cloneRecord(record)
  }

  async getConversationsByWorkspace(workspaceId: string) {
    const results: Array<{ id: string; record: ConversationRecord }> = []
    for (const [id, record] of this.conversations.entries()) {
      if (record.graph.workspaceId !== workspaceId) continue
      results.push({ id, record: cloneRecord(record) })
    }
    return results
  }

  async setWorkspaceGraph(workspaceId: string, graph: CanvasGraph) {
    this.workspaceGraphs.set(workspaceId, cloneGraph(graph))
  }

  async getWorkspaceGraph(workspaceId: string) {
    const graph = this.workspaceGraphs.get(workspaceId)
    if (!graph) return null
    return cloneGraph(graph)
  }

  async close() {}

  private touch(id: string) {
    this.touchedAt.set(id, Date.now())
  }

  private cleanup() {
    const now = Date.now()

    for (const [id, record] of this.conversations.entries()) {
      const touched = this.touchedAt.get(id) ?? record.metadata.updatedAt.getTime()
      const expired = now - touched > this.conversationTtlMs
      const finished = record.metadata.status !== 'running'
      if (!expired || !finished) continue

      this.conversations.delete(id)
      this.touchedAt.delete(id)
    }

    if (this.conversations.size <= this.maxConversations) return

    const candidates = [...this.conversations.entries()]
      .map(([id, record]) => ({
        id,
        status: record.metadata.status,
        touched: this.touchedAt.get(id) ?? record.metadata.updatedAt.getTime()
      }))
      .sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return 1
        if (a.status !== 'running' && b.status === 'running') return -1
        return a.touched - b.touched
      })

    const overflow = this.conversations.size - this.maxConversations
    for (let index = 0; index < overflow; index += 1) {
      const target = candidates[index]
      if (!target) break
      this.conversations.delete(target.id)
      this.touchedAt.delete(target.id)
    }
  }
}

class RedisConversationRuntimeRepository implements ConversationRuntimeRepository {
  private readonly fallback: InMemoryConversationRuntimeRepository
  private readonly redis: Redis
  private readonly keyPrefix: string
  private readonly ttlSeconds: number
  private available = true

  constructor(config: RepositoryConfig) {
    this.fallback = new InMemoryConversationRuntimeRepository(config)
    const url = process.env.CONVERSATION_RUNTIME_STORE_REDIS_URL
      ?? process.env.REDIS_URL
      ?? 'redis://localhost:6379'
    this.redis = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null
    })
    this.keyPrefix = process.env.CONVERSATION_RUNTIME_STORE_REDIS_PREFIX ?? 'conversation'
    this.ttlSeconds = Math.max(1, Math.floor(config.conversationTtlMs / 1000))

    this.redis.on('error', (error: unknown) => {
      this.available = false
      console.error('[conversation-runtime-repository] redis error, fallback to memory', {
        error: String(error)
      })
    })
  }

  async createConversation(id: string, record: ConversationRecord) {
    await this.fallback.createConversation(id, record)
    await this.tryWrite(async () => {
      const serialized = serializeRecord(record)
      await this.redis
        .multi()
        .set(this.recordKey(id), JSON.stringify(serialized), 'EX', this.ttlSeconds)
        .sadd(this.workspaceConversationSetKey(record.graph.workspaceId), id)
        .expire(this.workspaceConversationSetKey(record.graph.workspaceId), this.ttlSeconds)
        .zadd(this.touchedSetKey(), Date.now(), id)
        .exec()
    })
  }

  async updateConversation(id: string, record: ConversationRecord) {
    await this.fallback.updateConversation(id, record)
    await this.tryWrite(async () => {
      const serialized = serializeRecord(record)
      await this.redis
        .multi()
        .set(this.recordKey(id), JSON.stringify(serialized), 'EX', this.ttlSeconds)
        .sadd(this.workspaceConversationSetKey(record.graph.workspaceId), id)
        .expire(this.workspaceConversationSetKey(record.graph.workspaceId), this.ttlSeconds)
        .zadd(this.touchedSetKey(), Date.now(), id)
        .exec()
    })
  }

  async touchConversation(id: string) {
    await this.fallback.touchConversation(id)
    await this.tryWrite(async () => {
      await this.redis
        .multi()
        .expire(this.recordKey(id), this.ttlSeconds)
        .zadd(this.touchedSetKey(), Date.now(), id)
        .exec()
    })
  }

  async getConversation(id: string) {
    const record = await this.tryRead(async () => {
      const payload = await this.redis.get(this.recordKey(id))
      if (!payload) return null
      const parsed = deserializeRecord(payload)
      await this.fallback.updateConversation(id, parsed)
      return parsed
    })
    return record ?? this.fallback.getConversation(id)
  }

  async getConversationsByWorkspace(workspaceId: string) {
    const records = await this.tryRead(async () => {
      const ids = await this.redis.smembers(this.workspaceConversationSetKey(workspaceId))
      if (ids.length === 0) return null

      const pipeline = this.redis.pipeline()
      ids.forEach((id: string) => {
        pipeline.get(this.recordKey(id))
      })
      const responses = await pipeline.exec()
      if (!responses) return []

      const result: Array<{ id: string; record: ConversationRecord }> = []
      for (let index = 0; index < ids.length; index += 1) {
        const id = ids[index]
        const item = responses[index]
        if (!item || item[0]) continue
        const payload = item[1]
        if (typeof payload !== 'string') continue
        try {
          const record = deserializeRecord(payload)
          await this.fallback.updateConversation(id, record)
          result.push({ id, record })
        } catch (error) {
          console.error('[conversation-runtime-repository] invalid redis record payload', {
            id,
            error: String(error)
          })
        }
      }
      return result
    })

    return records ?? this.fallback.getConversationsByWorkspace(workspaceId)
  }

  async setWorkspaceGraph(workspaceId: string, graph: CanvasGraph) {
    await this.fallback.setWorkspaceGraph(workspaceId, graph)
    await this.tryWrite(async () => {
      await this.redis.set(
        this.workspaceGraphKey(workspaceId),
        JSON.stringify(graph),
        'EX',
        this.ttlSeconds
      )
    })
  }

  async getWorkspaceGraph(workspaceId: string) {
    const graph = await this.tryRead(async () => {
      const payload = await this.redis.get(this.workspaceGraphKey(workspaceId))
      if (!payload) return null
      const parsed = JSON.parse(payload) as CanvasGraph
      await this.fallback.setWorkspaceGraph(workspaceId, parsed)
      return parsed
    })
    return graph ?? this.fallback.getWorkspaceGraph(workspaceId)
  }

  async close() {
    await this.fallback.close()
    await this.redis.quit().catch(() => {
      // no-op
    })
  }

  private async ensureConnected() {
    if (this.redis.status === 'ready' || this.redis.status === 'connect') return
    await this.redis.connect()
  }

  private async tryWrite(write: () => Promise<void>) {
    if (!this.available) return

    try {
      await this.ensureConnected()
      await write()
    } catch (error) {
      this.available = false
      console.error('[conversation-runtime-repository] redis write failed, fallback to memory', {
        error: String(error)
      })
    }
  }

  private async tryRead<T>(read: () => Promise<T | null>): Promise<T | null> {
    if (!this.available) return null

    try {
      await this.ensureConnected()
      return await read()
    } catch (error) {
      this.available = false
      console.error('[conversation-runtime-repository] redis read failed, fallback to memory', {
        error: String(error)
      })
      return null
    }
  }

  private recordKey(id: string) {
    return `${this.keyPrefix}:record:${id}`
  }

  private workspaceGraphKey(workspaceId: string) {
    return `${this.keyPrefix}:workspace:${workspaceId}:graph`
  }

  private workspaceConversationSetKey(workspaceId: string) {
    return `${this.keyPrefix}:workspace:${workspaceId}:conversations`
  }

  private touchedSetKey() {
    return `${this.keyPrefix}:touched`
  }
}

export function createConversationRuntimeRepository(): ConversationRuntimeRepository {
  const config: RepositoryConfig = {
    maxConversations: Number(process.env.CONVERSATION_STORE_MAX_ITEMS ?? '200'),
    conversationTtlMs: Number(process.env.CONVERSATION_STORE_TTL_MS ?? '1800000')
  }
  const driver = process.env.CONVERSATION_RUNTIME_STORE_DRIVER ?? 'memory'

  if (driver === 'redis') {
    return new RedisConversationRuntimeRepository(config)
  }

  return new InMemoryConversationRuntimeRepository(config)
}

function serializeRecord(record: ConversationRecord): SerializableConversationRecord {
  return {
    metadata: {
      ...record.metadata,
      createdAt: record.metadata.createdAt.toISOString(),
      updatedAt: record.metadata.updatedAt.toISOString()
    },
    graph: cloneGraph(record.graph),
    knowledgeEvidence: cloneKnowledgeEvidence(record.knowledgeEvidence)
  }
}

function deserializeRecord(payload: string): ConversationRecord {
  const parsed = JSON.parse(payload) as SerializableConversationRecord
  return {
    metadata: {
      ...parsed.metadata,
      createdAt: new Date(parsed.metadata.createdAt),
      updatedAt: new Date(parsed.metadata.updatedAt)
    },
    graph: cloneGraph(parsed.graph),
    knowledgeEvidence: cloneKnowledgeEvidence(parsed.knowledgeEvidence ?? [])
  }
}

function cloneRecord(record: ConversationRecord): ConversationRecord {
  return {
    metadata: {
      ...record.metadata,
      createdAt: new Date(record.metadata.createdAt),
      updatedAt: new Date(record.metadata.updatedAt)
    },
    graph: cloneGraph(record.graph),
    knowledgeEvidence: cloneKnowledgeEvidence(record.knowledgeEvidence)
  }
}

function cloneGraph(graph: CanvasGraph): CanvasGraph {
  return {
    workspaceId: graph.workspaceId,
    nodes: [...graph.nodes],
    edges: [...graph.edges]
  }
}

function cloneKnowledgeEvidence(knowledgeEvidence: KnowledgeEvidence[]) {
  return knowledgeEvidence.map((item) => ({
    ...item,
    metadata: item.metadata ? { ...item.metadata } : undefined
  }))
}
