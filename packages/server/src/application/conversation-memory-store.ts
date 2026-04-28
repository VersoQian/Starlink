import { nanoid } from 'nanoid'
import type {
  CanvasGraph,
  ConversationMessage,
  ConversationMessageRole,
  ConversationSession,
  MemoryItem,
  MemoryKind,
  MemoryScope
} from '@starlink/shared'
import {
  conversationMessageSchema,
  conversationSessionSchema,
  memoryItemSchema
} from '@starlink/shared'
import { pool } from '../infrastructure/db/pool.js'
import { embedText, toPgVector } from '../services/embedding-service.js'
import {
  encryptIfConfigured,
  decryptIfNeeded,
  encryptUserSkillMetadata,
  decryptUserSkillMetadata
} from '../services/user-skill-crypto.js'

type JsonRecord = Record<string, unknown>

type CreateSessionInput = {
  id: string
  workspaceId: string
  userId: string
  title: string
  status: ConversationSession['status']
  latestQuestion?: string | null
  contextSnapshot?: JsonRecord
}

export type AppendMessageInput = {
  conversationId: string
  workspaceId: string
  userId?: string | null
  role: ConversationMessageRole
  content: string
  metadata?: JsonRecord
}

export type UpsertMemoryInput = {
  id?: string
  workspaceId: string
  userId?: string | null
  scope?: MemoryScope
  kind?: MemoryKind
  title: string
  content: string
  sourceType?: string
  sourceId?: string | null
  importance?: number
  confidence?: number
  tags?: string[]
  metadata?: JsonRecord
}

type MemorySearchOptions = {
  query?: string
  scope?: MemoryScope
  kind?: MemoryKind
  limit?: number
  /**
   * Filter by user. When set, queries restrict to rows where
   * `user_id = userId`. Required when reading `kind === 'user-skill'` rows.
   */
  userId?: string
  /**
   * When true, the workspace_id filter widens to "matches workspaceId OR is
   * NULL" — returns both workspace-scoped and global (cross-workspace) rows.
   * Used by user-skill reads which want both per-idea and per-user traits.
   */
  includeGlobalUser?: boolean
}

type CaptureConversationOutcomeInput = {
  workspaceId: string
  userId: string
  conversationId: string
  question?: string | null
  graph: CanvasGraph
  decision?: string
  evidenceCount?: number
}

const runtimeDdlEnabled = process.env.CONVERSATION_MEMORY_RUNTIME_DDL === 'true'

const initTables = runtimeDdlEnabled ? pool.query(`
  CREATE TABLE IF NOT EXISTS conversation_sessions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    latest_question TEXT,
    context_snapshot JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_conversation_sessions_workspace_updated
    ON conversation_sessions (workspace_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
    ON conversation_messages (conversation_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT,
    scope TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    embedding_model TEXT,
    embedding_dimensions INTEGER,
    source_type TEXT NOT NULL,
    source_id TEXT,
    importance DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
  );

  ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);
  ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS embedding_model TEXT;
  ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER;

  CREATE INDEX IF NOT EXISTS idx_memory_items_workspace_updated
    ON memory_items (workspace_id, updated_at DESC);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_items_source_unique
    ON memory_items (workspace_id, source_type, source_id, kind, title)
    WHERE source_id IS NOT NULL AND archived_at IS NULL;

  CREATE INDEX IF NOT EXISTS idx_memory_items_embedding
    ON memory_items
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    WHERE embedding IS NOT NULL AND archived_at IS NULL;
`) : Promise.resolve()

export class ConversationMemoryStore {
  private ready: Promise<void> | null = null

  private ensureTables() {
    if (!this.ready) {
      this.ready = initTables.then(() => undefined)
    }
    return this.ready
  }

  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    await this.ensureTables()
    const result = await pool.query(
      `INSERT INTO conversation_sessions (
        id, workspace_id, user_id, title, status, latest_question, context_snapshot
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        workspace_id = EXCLUDED.workspace_id,
        user_id = EXCLUDED.user_id,
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        latest_question = EXCLUDED.latest_question,
        context_snapshot = EXCLUDED.context_snapshot,
        updated_at = now()
      RETURNING *`,
      [
        input.id,
        input.workspaceId,
        input.userId,
        input.title,
        input.status,
        input.latestQuestion ?? null,
        JSON.stringify(input.contextSnapshot ?? {})
      ]
    )
    return rowToSession(result.rows[0])
  }

  async updateSessionStatus(
    conversationId: string,
    status: ConversationSession['status'],
    options?: { latestQuestion?: string | null; contextSnapshot?: JsonRecord; completed?: boolean }
  ): Promise<ConversationSession | null> {
    await this.ensureTables()
    const result = await pool.query(
      `UPDATE conversation_sessions
       SET status = $2,
           latest_question = COALESCE($3, latest_question),
           context_snapshot = COALESCE($4::jsonb, context_snapshot),
           completed_at = CASE WHEN $5 THEN now() ELSE completed_at END,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        conversationId,
        status,
        options?.latestQuestion ?? null,
        options?.contextSnapshot ? JSON.stringify(options.contextSnapshot) : null,
        Boolean(options?.completed)
      ]
    )
    return result.rowCount ? rowToSession(result.rows[0]) : null
  }

  async getSession(conversationId: string): Promise<ConversationSession | null> {
    await this.ensureTables()
    const result = await pool.query(
      'SELECT * FROM conversation_sessions WHERE id = $1',
      [conversationId]
    )
    return result.rowCount ? rowToSession(result.rows[0]) : null
  }

  async listSessions(workspaceId: string, limit = 20): Promise<ConversationSession[]> {
    await this.ensureTables()
    const result = await pool.query(
      `SELECT * FROM conversation_sessions
       WHERE workspace_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [workspaceId, clampLimit(limit, 1, 100)]
    )
    return result.rows.map(rowToSession)
  }

  async appendMessage(input: AppendMessageInput): Promise<ConversationMessage> {
    await this.ensureTables()
    const result = await pool.query(
      `INSERT INTO conversation_messages (
        id, conversation_id, workspace_id, user_id, role, content, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING *`,
      [
        nanoid(),
        input.conversationId,
        input.workspaceId,
        input.userId ?? null,
        input.role,
        input.content,
        JSON.stringify(input.metadata ?? {})
      ]
    )
    await pool.query(
      `UPDATE conversation_sessions
       SET updated_at = now()
       WHERE id = $1`,
      [input.conversationId]
    )
    return rowToMessage(result.rows[0])
  }

  async listMessages(conversationId: string, limit = 20): Promise<ConversationMessage[]> {
    await this.ensureTables()
    const result = await pool.query(
      `SELECT * FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, clampLimit(limit, 1, 200)]
    )
    return result.rows.map(rowToMessage).reverse()
  }

  async upsertMemory(input: UpsertMemoryInput): Promise<MemoryItem> {
    await this.ensureTables()
    const id = input.id ?? await this.findMemoryIdBySource(input) ?? nanoid()
    // Embedding is computed BEFORE encryption — embeddings are never
    // encrypted (they need to be queryable for `<=>` similarity). This
    // means the embedding vector itself can leak content via inversion
    // attacks (Pan et al. 2020+); user-skill-crypto.ts documents this as
    // residual risk. For non-user-skill rows, plaintext is stored anyway,
    // so the embedding is no extra leak.
    const embedding = await embedText(renderMemoryEmbeddingInput(input))
    const isUserSkill = (input.kind ?? 'insight') === 'user-skill'
    // For user-skill rows, encrypt sensitive fields (title, content,
    // metadata.revisionTrend nested fields) at the storage boundary.
    // No-op when USER_SKILL_ENCRYPTION_KEY is unset → plaintext fallthrough.
    const storedTitle = isUserSkill ? encryptIfConfigured(input.title) : input.title
    const storedContent = isUserSkill ? encryptIfConfigured(input.content) : input.content
    const storedMetadata = {
      ...(isUserSkill
        ? (encryptUserSkillMetadata(input.metadata ?? {}) as Record<string, unknown>)
        : (input.metadata ?? {})),
      embeddingProvider: embedding.provider
    }
    const result = await pool.query(
      `INSERT INTO memory_items (
        id, workspace_id, user_id, scope, kind, title, content, source_type,
        source_id, importance, confidence, tags, metadata,
        embedding, embedding_model, embedding_dimensions
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[], $13::jsonb,
        $14::vector, $15, $16
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        importance = EXCLUDED.importance,
        confidence = EXCLUDED.confidence,
        tags = EXCLUDED.tags,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        embedding_model = EXCLUDED.embedding_model,
        embedding_dimensions = EXCLUDED.embedding_dimensions,
        updated_at = now(),
        archived_at = NULL
      RETURNING *`,
      [
        id,
        input.workspaceId,
        input.userId ?? null,
        input.scope ?? 'workspace',
        input.kind ?? 'insight',
        storedTitle,
        storedContent,
        input.sourceType ?? 'manual',
        input.sourceId ?? null,
        clampScore(input.importance ?? 0.5),
        clampScore(input.confidence ?? 0.7),
        input.tags ?? [],
        JSON.stringify(storedMetadata),
        toPgVector(embedding.vector),
        embedding.model,
        embedding.dimensions
      ]
    )

    const stored = rowToMemory(result.rows[0])
    if (!input.sourceId) return stored

    return await this.mergeMemoryBySource(stored, {
      embeddingVector: toPgVector(embedding.vector),
      embeddingModel: embedding.model,
      embeddingDimensions: embedding.dimensions
    })
  }

  async listMemories(
    workspaceId: string,
    options: MemorySearchOptions = {}
  ): Promise<MemoryItem[]> {
    await this.ensureTables()
    const limit = clampLimit(options.limit ?? 30, 1, 100)
    if (options.query?.trim()) {
      return await this.searchMemories(workspaceId, options.query, limit, {
        scope: options.scope,
        kind: options.kind
      })
    }

    const { filters, params } = buildMemoryFilters(workspaceId, options)
    params.push(limit)
    const result = await pool.query(
      `SELECT * FROM memory_items
       WHERE ${filters.join(' AND ')}
       ORDER BY importance DESC, updated_at DESC
       LIMIT $${params.length}`,
      params
    )

    return result.rows.map(rowToMemory)
  }

  async searchMemories(
    workspaceId: string,
    query: string,
    limit = 8,
    options: Pick<MemorySearchOptions, 'scope' | 'kind' | 'userId' | 'includeGlobalUser'> = {}
  ): Promise<MemoryItem[]> {
    await this.ensureTables()
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []

    const semantic = await this.searchMemoriesByVector(workspaceId, normalizedQuery, limit, options)
    if (semantic.length > 0) return semantic

    const { filters, params } = buildMemoryFilters(workspaceId, options)
    params.push(200)
    const result = await pool.query(
      `SELECT * FROM memory_items
       WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT $${params.length}`,
      params
    )
    const scored = scoreMemories(result.rows.map(rowToMemory), normalizedQuery).slice(0, clampLimit(limit, 1, 30))
    await this.touchMemories(scored.map((item) => item.id))
    return scored
  }

  private async searchMemoriesByVector(
    workspaceId: string,
    query: string,
    limit: number,
    options: Pick<MemorySearchOptions, 'scope' | 'kind' | 'userId' | 'includeGlobalUser'>
  ): Promise<MemoryItem[]> {
    try {
      const embedding = await embedText(query)
      const { filters, params } = buildMemoryFilters(workspaceId, options)
      filters.push('embedding IS NOT NULL')
      params.push(toPgVector(embedding.vector))
      const vectorParamIndex = params.length
      params.push(clampLimit(limit, 1, 30))

      const result = await pool.query(
        `SELECT * FROM memory_items
         WHERE ${filters.join(' AND ')}
         ORDER BY embedding <=> $${vectorParamIndex}::vector ASC,
                  importance DESC,
                  updated_at DESC
         LIMIT $${params.length}`,
        params
      )

      const memories: MemoryItem[] = result.rows.map(rowToMemory)
      await this.touchMemories(memories.map((item) => item.id))
      return memories
    } catch (error) {
      console.warn('[conversation-memory-store] vector memory search failed, falling back to lexical search', {
        error: String(error)
      })
      return []
    }
  }

  /**
   * User-skill specific helper. Two layers in one query:
   *   - workspace-scoped skills for this idea (scope='workspace', workspace_id=$W)
   *   - global user skills across ideas (scope='user', workspace_id IS NULL)
   *
   * Both filtered by userId. If `query` is empty/missing, falls back to a
   * recency-ordered list (no embedding required) — useful for the extractor
   * which wants to see all of a user's skills regardless of similarity to
   * any current query.
   *
   * Confidence threshold: callers should filter `confidence < 0.5` items
   * themselves at render time; this method returns all rows so the
   * extractor can also see low-confidence items it might want to reinforce.
   */
  async searchUserSkills(
    userId: string,
    workspaceId: string,
    options: { query?: string; limit?: number } = {}
  ): Promise<MemoryItem[]> {
    await this.ensureTables()
    const limit = clampLimit(options.limit ?? 20, 1, 50)
    const query = options.query?.trim()

    if (query) {
      return this.searchMemories(workspaceId, query, limit, {
        kind: 'user-skill',
        userId,
        includeGlobalUser: true
      })
    }

    // Recency fallback (no embedding cost).
    const { filters, params } = buildMemoryFilters(workspaceId, {
      kind: 'user-skill',
      userId,
      includeGlobalUser: true
    })
    params.push(limit)
    const result = await pool.query(
      `SELECT * FROM memory_items
       WHERE ${filters.join(' AND ')}
       ORDER BY confidence DESC, updated_at DESC
       LIMIT $${params.length}`,
      params
    )
    return result.rows.map(rowToMemory)
  }

  /**
   * Read recent conversation summaries for a single user across ALL their
   * workspaces — used by `UserSkillExtractor` to look at cross-idea patterns
   * before deciding which traits are durable enough to promote to user-skill.
   *
   * Pulls rows where kind='summary' (the kind written by
   * writeConversationSummary in business-langgraph.ts). Bypasses
   * workspace_id filter intentionally — this is the one query in the store
   * that is per-USER not per-WORKSPACE.
   */
  async listUserSummaries(userId: string, limit = 10): Promise<MemoryItem[]> {
    await this.ensureTables()
    const clamped = clampLimit(limit, 1, 30)
    const result = await pool.query(
      `SELECT * FROM memory_items
       WHERE user_id = $1 AND kind = 'summary' AND archived_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, clamped]
    )
    return result.rows.map(rowToMemory)
  }

  async captureConversationOutcome(input: CaptureConversationOutcomeInput): Promise<MemoryItem[]> {
    const memories: MemoryItem[] = []
    const question = input.question?.trim() || '未命名会话'
    const graphSummary = summarizeGraphForMemory(input.graph)

    if (input.decision?.trim()) {
      memories.push(await this.upsertMemory({
        workspaceId: input.workspaceId,
        userId: input.userId,
        scope: 'workspace',
        kind: 'decision',
        title: `最终决策：${truncate(question, 32)}`,
        content: input.decision.trim(),
        sourceType: 'conversation',
        sourceId: input.conversationId,
        importance: 0.9,
        confidence: 0.82,
        tags: ['decision', 'agent-output'],
        metadata: {
          question,
          evidenceCount: input.evidenceCount ?? 0
        }
      }))
    }

    if (graphSummary) {
      memories.push(await this.upsertMemory({
        workspaceId: input.workspaceId,
        userId: input.userId,
        scope: 'workspace',
        kind: 'canvas',
        title: `画布摘要：${truncate(question, 32)}`,
        content: graphSummary,
        sourceType: 'canvas',
        sourceId: input.conversationId,
        importance: 0.78,
        confidence: 0.74,
        tags: ['canvas', 'summary'],
        metadata: {
          question,
          nodeCount: input.graph.nodes.length,
          edgeCount: input.graph.edges.length
        }
      }))
    }

    return memories
  }

  private async findMemoryIdBySource(input: UpsertMemoryInput): Promise<string | null> {
    if (!input.sourceId) return null
    const result = await pool.query(
      `SELECT id FROM memory_items
       WHERE workspace_id = $1
         AND source_type = $2
         AND source_id = $3
         AND kind = $4
         AND title = $5
         AND archived_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 1`,
      [
        input.workspaceId,
        input.sourceType ?? 'manual',
        input.sourceId,
        input.kind ?? 'insight',
        input.title
      ]
    )
    return result.rowCount ? result.rows[0].id as string : null
  }

  private async mergeMemoryBySource(
    memory: MemoryItem,
    vector: { embeddingVector: string; embeddingModel: string; embeddingDimensions: number }
  ): Promise<MemoryItem> {
    if (!memory.sourceId) return memory
    const result = await pool.query(
      `SELECT * FROM memory_items
       WHERE workspace_id = $1
         AND source_type = $2
         AND source_id = $3
         AND kind = $4
         AND title = $5
         AND archived_at IS NULL
       ORDER BY updated_at ASC`,
      [memory.workspaceId, memory.sourceType, memory.sourceId, memory.kind, memory.title]
    )
    if (result.rowCount <= 1) return memory

    const [keeper, ...duplicates] = result.rows.map(rowToMemory)
    await pool.query(
      `UPDATE memory_items
       SET content = $2,
           importance = $3,
           confidence = $4,
           tags = $5::text[],
           metadata = $6::jsonb,
           embedding = $7::vector,
           embedding_model = $8,
           embedding_dimensions = $9,
           updated_at = now()
       WHERE id = $1`,
      [
        keeper.id,
        memory.content,
        memory.importance,
        memory.confidence,
        memory.tags,
        JSON.stringify(memory.metadata),
        vector.embeddingVector,
        vector.embeddingModel,
        vector.embeddingDimensions
      ]
    )
    await pool.query(
      'UPDATE memory_items SET archived_at = now() WHERE id = ANY($1::text[])',
      [duplicates.map((item: MemoryItem) => item.id).concat(memory.id).filter((id: string) => id !== keeper.id)]
    )
    const merged = await pool.query('SELECT * FROM memory_items WHERE id = $1', [keeper.id])
    return rowToMemory(merged.rows[0])
  }

  private async touchMemories(ids: string[]) {
    if (ids.length === 0) return
    await pool.query(
      'UPDATE memory_items SET last_used_at = now() WHERE id = ANY($1::text[])',
      [ids]
    )
  }

  /**
   * Soft-archive a memory row. Sets `archived_at = now()` so subsequent
   * filters (which include `archived_at IS NULL`) skip it. Used by
   * `UserSkillExtractor` to retire stale / contradicted skills without
   * losing the audit trail.
   */
  async archiveMemory(id: string): Promise<void> {
    await this.ensureTables()
    await pool.query(
      'UPDATE memory_items SET archived_at = now() WHERE id = $1 AND archived_at IS NULL',
      [id]
    )
  }
}

function buildMemoryFilters(
  workspaceId: string,
  options: Pick<MemorySearchOptions, 'scope' | 'kind' | 'userId' | 'includeGlobalUser'> = {}
) {
  const params: unknown[] = [workspaceId]
  // includeGlobalUser widens the workspace match to also include cross-user
  // global rows (workspace_id IS NULL). Used by user-skill reads which want
  // both per-idea (scope='workspace') AND per-user (scope='user') in the
  // same query.
  const workspaceFilter = options.includeGlobalUser
    ? '(workspace_id = $1 OR workspace_id IS NULL)'
    : 'workspace_id = $1'
  const filters = [workspaceFilter, 'archived_at IS NULL']

  if (options.scope) {
    params.push(options.scope)
    filters.push(`scope = $${params.length}`)
  }
  if (options.kind) {
    params.push(options.kind)
    filters.push(`kind = $${params.length}`)
  }
  if (options.userId) {
    params.push(options.userId)
    filters.push(`user_id = $${params.length}`)
  }

  return { filters, params }
}

function renderMemoryEmbeddingInput(input: UpsertMemoryInput) {
  return [
    input.title,
    input.content,
    input.kind ?? 'insight',
    input.scope ?? 'workspace',
    ...(input.tags ?? [])
  ]
    .filter(Boolean)
    .join('\n')
}

function rowToSession(row: Record<string, unknown>): ConversationSession {
  return conversationSessionSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    latestQuestion: row.latest_question ?? null,
    contextSnapshot: parseJsonRecord(row.context_snapshot),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : null
  })
}

function rowToMessage(row: Record<string, unknown>): ConversationMessage {
  return conversationMessageSchema.parse({
    id: row.id,
    conversationId: row.conversation_id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? null,
    role: row.role,
    content: row.content,
    metadata: parseJsonRecord(row.metadata),
    createdAt: toIso(row.created_at)
  })
}

function rowToMemory(row: Record<string, unknown>): MemoryItem {
  // For user-skill rows, decrypt the sensitive fields at the storage
  // boundary so the rest of the codebase sees plaintext. Non-user-skill
  // rows pass through `decryptIfNeeded` which is a no-op for non-prefixed
  // values — zero overhead for the common case.
  const isUserSkill = row.kind === 'user-skill'
  const rawMetadata = parseJsonRecord(row.metadata)
  return memoryItemSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? null,
    scope: row.scope,
    kind: row.kind,
    title: isUserSkill ? decryptIfNeeded(row.title as string) : row.title,
    content: isUserSkill ? decryptIfNeeded(row.content as string) : row.content,
    sourceType: row.source_type,
    sourceId: row.source_id ?? null,
    importance: Number(row.importance ?? 0.5),
    confidence: Number(row.confidence ?? 0.7),
    tags: Array.isArray(row.tags) ? row.tags : [],
    metadata: isUserSkill
      ? (decryptUserSkillMetadata(rawMetadata) as JsonRecord)
      : rawMetadata,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : null,
    archivedAt: row.archived_at ? toIso(row.archived_at) : null
  })
}

function parseJsonRecord(value: unknown): JsonRecord {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as JsonRecord
    } catch {
      return {}
    }
  }
  return value as JsonRecord
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date().toISOString()
}

function clampLimit(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value))
}

function scoreMemories(memories: MemoryItem[], query: string): MemoryItem[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return memories

  return memories
    .map((memory) => {
      const haystack = `${memory.title} ${memory.content} ${memory.tags.join(' ')}`.toLowerCase()
      const matches = tokens.filter((token) => haystack.includes(token)).length
      const score = matches / tokens.length + memory.importance * 0.25 + memory.confidence * 0.1
      return { memory, score }
    })
    .filter((item) => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.memory)
}

function tokenize(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1)
  )]
}

function summarizeGraphForMemory(graph: CanvasGraph): string {
  const highlights = graph.nodes
    .map((node) => {
      const data = node.data as { title?: string; content?: string; summary?: string; meta?: JsonRecord }
      const title = data.title ?? node.id
      const content = data.content ?? data.summary ?? ''
      const domain = typeof data.meta?.domain === 'string' ? `（${data.meta.domain}）` : ''
      return `- ${title}${domain}: ${truncate(content.replace(/\s+/g, ' '), 140)}`
    })
    .filter((line) => !line.endsWith(': '))
    .slice(0, 12)

  if (highlights.length === 0) return ''
  return [
    `节点数：${graph.nodes.length}，连线数：${graph.edges.length}`,
    ...highlights
  ].join('\n')
}

function truncate(text: string, max: number) {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}
