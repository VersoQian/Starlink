/**
 * Knowledge-Base Store (2026-04-28).
 *
 * Replaces the external task-service the previous `kb-task-service.ts` was
 * a thin HTTP client of. Implementation lives entirely in-repo: pgvector
 * for chunk embeddings (reuses the same pool + the same `embedText` helper
 * already used by `ConversationMemoryStore`), simple paragraph-based
 * chunker, single-table-per-concern schema.
 *
 * Two tables, both auto-DDL'd on first use (mirrors `ensureTables` pattern
 * from ConversationMemoryStore):
 *
 *   kb_documents — one row per ingested document
 *     id, workspace_id, kb_id, title, content, content_type, source_url,
 *     metadata, created_at, updated_at
 *
 *   kb_chunks    — chunked + embedded segments of a document
 *     id, kb_id, doc_id (FK → kb_documents.id), chunk_index, content,
 *     embedding VECTOR(1536), metadata, created_at
 *
 * Public surface used by `kb-task-service.ts`:
 *
 *   - addDocument({ kbId, workspaceId, title, content, ... })
 *       → chunks, embeds, inserts; returns { docId, chunkCount }
 *   - searchChunks(kbId, query, topK?)
 *       → vector cosine search; returns KnowledgeSearchResult[]
 *   - listDocuments(kbId, workspaceId)
 *       → admin listing
 *   - removeDocument(docId)
 *       → cascades to chunks via FK
 *
 * Knowledge-base lifecycle (`createKnowledgeBase`, `publishKnowledgeBase`,
 * etc) is intentionally NOT modelled here — those map to a separate
 * lightweight `kb_definitions` table managed elsewhere when needed. For
 * the RAG path the `kbId` is just a partition key on these two tables;
 * documents can be inserted without any prior "create KB" step.
 */

import { nanoid } from 'nanoid'
import { pool } from '../infrastructure/db/pool.js'
import { embedText, toPgVector } from '../services/embedding-service.js'
import type { KnowledgeSearchResult } from '@starlink/shared'

// =============================================================================
// Schema (auto-DDL)
// =============================================================================

const KB_DDL = `
  CREATE TABLE IF NOT EXISTS kb_documents (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    kb_id        TEXT NOT NULL,
    title        TEXT NOT NULL,
    content      TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text/plain',
    source_url   TEXT,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_kb_documents_kb_id ON kb_documents(kb_id);
  CREATE INDEX IF NOT EXISTS idx_kb_documents_workspace_id ON kb_documents(workspace_id);

  CREATE TABLE IF NOT EXISTS kb_chunks (
    id          TEXT PRIMARY KEY,
    kb_id       TEXT NOT NULL,
    doc_id      TEXT NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb_id ON kb_chunks(kb_id);
  CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc_id ON kb_chunks(doc_id);
  CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding
    ON kb_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    WHERE embedding IS NOT NULL;
`

// =============================================================================
// Chunking
// =============================================================================

/**
 * Lightweight paragraph + length chunker. Splits on double newlines first
 * (paragraphs), then merges adjacent paragraphs until each chunk is roughly
 * `targetChars` long, with `overlapChars` carryover at the boundary so
 * cross-paragraph context isn't lost on retrieval.
 *
 * Char-based instead of token-based intentionally — token counting per LLM
 * provider varies; chars are a stable proxy for Chinese + English mixed
 * input. ~600 chars ≈ 200-400 tokens depending on language.
 */
export function chunkText(
  text: string,
  options: { targetChars?: number; overlapChars?: number } = {}
): string[] {
  const targetChars = Math.max(200, options.targetChars ?? 600)
  const overlapChars = Math.max(0, options.overlapChars ?? 80)

  const cleaned = text.trim()
  if (cleaned.length === 0) return []
  if (cleaned.length <= targetChars) return [cleaned]

  const paragraphs = cleaned.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let buf = ''

  for (const p of paragraphs) {
    if (buf.length === 0) {
      buf = p
      continue
    }
    if (buf.length + 1 + p.length <= targetChars) {
      buf = `${buf}\n\n${p}`
    } else {
      chunks.push(buf)
      // Carry over the tail of the previous chunk for overlap.
      const carry = overlapChars > 0 ? buf.slice(Math.max(0, buf.length - overlapChars)) : ''
      buf = carry ? `${carry}\n\n${p}` : p
    }
  }
  if (buf) chunks.push(buf)

  // If a single paragraph is bigger than target, hard-split it.
  const final: string[] = []
  for (const c of chunks) {
    if (c.length <= targetChars * 1.5) {
      final.push(c)
      continue
    }
    for (let i = 0; i < c.length; i += targetChars) {
      const piece = c.slice(i, i + targetChars)
      if (piece.trim()) final.push(piece)
    }
  }
  return final
}

// =============================================================================
// Store
// =============================================================================

export interface AddDocumentInput {
  kbId: string
  workspaceId: string
  title: string
  content: string
  contentType?: string
  sourceUrl?: string | null
  metadata?: Record<string, unknown>
  /** Optional. When provided, upserts (replaces existing chunks). */
  docId?: string
}

export interface AddDocumentResult {
  docId: string
  chunkCount: number
}

export interface KbDocumentRow {
  id: string
  workspaceId: string
  kbId: string
  title: string
  content: string
  contentType: string
  sourceUrl: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export class KbStore {
  private ddlPromise: Promise<void> | null = null

  private ensureTables(): Promise<void> {
    if (!this.ddlPromise) {
      this.ddlPromise = pool.query(KB_DDL).then(
        () => undefined,
        (err: unknown) => {
          // If the pgvector extension isn't installed, surface a clear
          // message instead of the cryptic "type \"vector\" does not exist".
          throw new Error(
            `kb-store: schema setup failed (${err instanceof Error ? err.message : String(err)}). ` +
              'Verify the pgvector extension is installed: CREATE EXTENSION vector;'
          )
        }
      )
    }
    return this.ddlPromise as Promise<void>
  }

  /**
   * Insert (or replace, when `docId` is provided) a document. Chunks the
   * content, embeds each chunk, and persists both rows + chunk vectors in
   * a single transaction.
   */
  async addDocument(input: AddDocumentInput): Promise<AddDocumentResult> {
    await this.ensureTables()
    const docId = input.docId ?? nanoid()
    const chunks = chunkText(input.content)
    if (chunks.length === 0) {
      throw new Error('kb-store.addDocument: empty content after chunking')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Upsert document row.
      await client.query(
        `INSERT INTO kb_documents (
           id, workspace_id, kb_id, title, content, content_type,
           source_url, metadata, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           content_type = EXCLUDED.content_type,
           source_url = EXCLUDED.source_url,
           metadata = EXCLUDED.metadata,
           updated_at = now()`,
        [
          docId,
          input.workspaceId,
          input.kbId,
          input.title,
          input.content,
          input.contentType ?? 'text/plain',
          input.sourceUrl ?? null,
          JSON.stringify(input.metadata ?? {})
        ]
      )

      // Drop pre-existing chunks for upsert path. ON DELETE CASCADE on
      // kb_chunks.doc_id is the schema-level guarantee, but explicit DELETE
      // here matches the "replace all chunks" semantics callers expect.
      await client.query('DELETE FROM kb_chunks WHERE doc_id = $1', [docId])

      // Embed each chunk. We embed sequentially rather than in parallel —
      // most embedding providers rate-limit at ~3000 RPM, and a typical
      // document fits in 1-20 chunks; sequential is simpler and well within
      // the budget. If profiling shows it matters, switch to Promise.all.
      for (let i = 0; i < chunks.length; i++) {
        const chunkContent = chunks[i]
        const embedding = await embedText(chunkContent)
        await client.query(
          `INSERT INTO kb_chunks (
             id, kb_id, doc_id, chunk_index, content,
             embedding, metadata, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb, now())`,
          [
            nanoid(),
            input.kbId,
            docId,
            i,
            chunkContent,
            toPgVector(embedding.vector),
            JSON.stringify({
              embeddingProvider: embedding.provider,
              embeddingModel: embedding.model,
              chunkIndex: i,
              ...(input.metadata ?? {})
            })
          ]
        )
      }

      await client.query('COMMIT')
      return { docId, chunkCount: chunks.length }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }

  /**
   * Vector cosine search across this KB's chunks. Returns top-K results
   * shaped to match `KnowledgeSearchResult` from @starlink/shared so
   * callers downstream (BMC generator's knowledgeContext renderer, etc)
   * don't need adapter code.
   */
  async searchChunks(
    kbId: string,
    query: string,
    topK = 5
  ): Promise<KnowledgeSearchResult[]> {
    await this.ensureTables()
    const trimmed = query.trim()
    if (!trimmed) return []

    const embedding = await embedText(trimmed)
    const limit = Math.max(1, Math.min(50, Math.floor(topK)))

    // Cosine distance: lower is closer; 1 - distance ≈ similarity.
    const result = await pool.query(
      `SELECT doc_id,
              content,
              chunk_index,
              embedding <=> $2::vector AS distance,
              metadata
       FROM kb_chunks
       WHERE kb_id = $1 AND embedding IS NOT NULL
       ORDER BY embedding <=> $2::vector ASC
       LIMIT $3`,
      [kbId, toPgVector(embedding.vector), limit]
    )

    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      docId: row.doc_id as string,
      snippet: row.content as string,
      score: 1 - Number(row.distance ?? 1),
      metadata: {
        ...(((row.metadata as Record<string, unknown>) ?? {})),
        chunkIndex: row.chunk_index as number
      }
    }))
  }

  async listDocuments(
    kbId: string,
    workspaceId?: string
  ): Promise<KbDocumentRow[]> {
    await this.ensureTables()
    const filters = ['kb_id = $1']
    const params: unknown[] = [kbId]
    if (workspaceId) {
      params.push(workspaceId)
      filters.push(`workspace_id = $${params.length}`)
    }
    const result = await pool.query(
      `SELECT * FROM kb_documents
       WHERE ${filters.join(' AND ')}
       ORDER BY updated_at DESC
       LIMIT 200`,
      params
    )
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      kbId: row.kb_id as string,
      title: row.title as string,
      content: row.content as string,
      contentType: row.content_type as string,
      sourceUrl: (row.source_url as string | null) ?? null,
      metadata: ((row.metadata as Record<string, unknown>) ?? {}),
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString()
    }))
  }

  async removeDocument(docId: string): Promise<void> {
    await this.ensureTables()
    await pool.query('DELETE FROM kb_documents WHERE id = $1', [docId])
  }

  /** Test-only / admin: drop both tables. NOT used by production paths. */
  async dropAll(): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS kb_chunks CASCADE')
    await pool.query('DROP TABLE IF EXISTS kb_documents CASCADE')
    this.ddlPromise = null
  }
}

let cachedStore: KbStore | null = null
export function getKbStore(): KbStore {
  if (!cachedStore) cachedStore = new KbStore()
  return cachedStore
}
