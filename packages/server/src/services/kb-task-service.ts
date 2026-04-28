/**
 * Knowledge-Base service (2026-04-28).
 *
 * Was a thin HTTP client to an external `task-service` that didn't exist
 * in this repo. Replaced with direct calls into the local `KbStore`
 * (pgvector + chunker + embedder, all in-process). Public function
 * signatures unchanged so callers (resolvers, BMC pipeline) don't move.
 *
 * KB metadata (the "knowledge base" entity itself — name, status,
 * timestamps) is now backed by a small `kb_definitions` table that's
 * auto-DDL'd on first use. Document chunks live in `kb_documents` +
 * `kb_chunks` (managed by `KbStore`).
 *
 * Removed env: `KB_TASK_SERVICE_URL` no longer consulted.
 */

import { nanoid } from 'nanoid'
import {
  createAuditLogger,
  type KnowledgeBase,
  type KnowledgeSearchResult as SharedKnowledgeSearchResult,
  type KnowledgeTask
} from '@starlink/shared'
import { pool } from '../infrastructure/db/pool.js'
import { getKbStore } from '../application/kb-store.js'

const auditLogger = createAuditLogger('packages/server:services:kb-task-service')

export type GatewayKnowledgeBase = {
  id: KnowledgeBase['id']
  workspaceId: KnowledgeBase['workspaceId']
  name: KnowledgeBase['name']
  status: KnowledgeBase['status']
  createdAt: KnowledgeBase['createdAt']
  updatedAt: KnowledgeBase['updatedAt']
  publishedAt?: KnowledgeBase['publishedAt']
}

export type GatewayKbTask = {
  id: KnowledgeTask['id']
  workspaceId: KnowledgeTask['workspaceId']
  kbId: KnowledgeTask['kbId']
  type: KnowledgeTask['type']
  status: KnowledgeTask['status']
  payload: Record<string, unknown>
  error?: KnowledgeTask['error']
  createdAt: KnowledgeTask['createdAt']
  updatedAt: KnowledgeTask['updatedAt']
}

export type KnowledgeSearchResult = SharedKnowledgeSearchResult

// =============================================================================
// kb_definitions table (lightweight metadata for KB entities themselves)
// =============================================================================

const KB_DEFINITIONS_DDL = `
  CREATE TABLE IF NOT EXISTS kb_definitions (
    id           TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'draft',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_kb_definitions_workspace_id
    ON kb_definitions(workspace_id);
`

let kbDefDdlPromise: Promise<void> | null = null
function ensureKbDefinitionsTable(): Promise<void> {
  if (!kbDefDdlPromise) {
    kbDefDdlPromise = pool
      .query(KB_DEFINITIONS_DDL)
      .then(
        () => undefined,
        (err: unknown) => {
          kbDefDdlPromise = null
          throw err
        }
      )
  }
  return kbDefDdlPromise as Promise<void>
}

function rowToKb(row: Record<string, unknown>): GatewayKnowledgeBase {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    status: row.status as KnowledgeBase['status'],
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    publishedAt: row.published_at
      ? new Date(row.published_at as string).toISOString()
      : null
  }
}

// =============================================================================
// Public API (signatures unchanged)
// =============================================================================

export async function listKnowledgeBases(
  workspaceId: string
): Promise<GatewayKnowledgeBase[]> {
  try {
    await ensureKbDefinitionsTable()
    const result = await pool.query(
      `SELECT * FROM kb_definitions WHERE workspace_id = $1 ORDER BY updated_at DESC`,
      [workspaceId]
    )
    return result.rows.map(rowToKb)
  } catch (error) {
    auditLogger.warn({
      action: 'kb-task-service.listKnowledgeBases.failed',
      workflowId: workspaceId,
      metadata: { message: error instanceof Error ? error.message : String(error) }
    })
    return []
  }
}

export async function createKnowledgeBase(
  workspaceId: string,
  options: { name?: string } = {}
): Promise<GatewayKnowledgeBase> {
  await ensureKbDefinitionsTable()
  const id = nanoid()
  const name = options.name ?? `kb-${id.slice(0, 6)}`
  const result = await pool.query(
    `INSERT INTO kb_definitions (id, workspace_id, name, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'draft', now(), now())
     RETURNING *`,
    [id, workspaceId, name]
  )
  return rowToKb(result.rows[0])
}

export async function publishKnowledgeBase(
  workspaceId: string,
  kbId: string
): Promise<GatewayKnowledgeBase> {
  await ensureKbDefinitionsTable()
  const result = await pool.query(
    `UPDATE kb_definitions
     SET status = 'ready', published_at = now(), updated_at = now()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [kbId, workspaceId]
  )
  if (result.rows.length === 0) {
    throw new Error(`Knowledge base ${kbId} not found in workspace ${workspaceId}`)
  }
  return rowToKb(result.rows[0])
}

/**
 * Add a single text seed (paragraph-or-larger) to the KB. Internally this
 * calls KbStore.addDocument with a synthetic title, which chunks + embeds
 * the seed and persists into `kb_documents` + `kb_chunks`.
 *
 * Returns a Task-shaped object so the GraphQL response surface (which
 * was modelled on the old async task-service) keeps compiling. Status
 * is reported as 'completed' immediately because ingestion is synchronous
 * in this implementation; if KbStore embedding fails, status='failed'
 * with the error message.
 */
export async function addKnowledgeSeed(
  workspaceId: string,
  kbId: string,
  text: string
): Promise<GatewayKbTask> {
  const taskId = nanoid()
  const now = new Date().toISOString()
  const title = `seed-${taskId.slice(0, 6)}`
  try {
    const { docId, chunkCount } = await getKbStore().addDocument({
      kbId,
      workspaceId,
      title,
      content: text,
      metadata: { kind: 'seed' }
    })
    auditLogger.info({
      action: 'kb-task-service.addKnowledgeSeed.completed',
      workflowId: workspaceId,
      metadata: { kbId, taskId, docId, chunkCount }
    })
    return {
      id: taskId,
      workspaceId,
      kbId,
      type: 'seed',
      status: 'succeeded',
      payload: { docId, chunkCount },
      error: null,
      createdAt: now,
      updatedAt: now
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditLogger.warn({
      action: 'kb-task-service.addKnowledgeSeed.failed',
      workflowId: workspaceId,
      metadata: { kbId, message }
    })
    return {
      id: taskId,
      workspaceId,
      kbId,
      type: 'seed',
      status: 'failed',
      payload: {},
      error: message,
      createdAt: now,
      updatedAt: now
    }
  }
}

/**
 * Fetch a URL, treat the body as text, and ingest it. Minimal HTML
 * stripping (drop script/style + collapse whitespace) — for richer
 * extraction (PDF, structured HTML), a follow-up should add a proper
 * extractor library; this default is enough for plaintext articles.
 */
export async function importKnowledgeUrl(
  workspaceId: string,
  kbId: string,
  url: string
): Promise<GatewayKbTask> {
  const taskId = nanoid()
  const now = new Date().toISOString()
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    const raw = await res.text()
    const text = stripHtmlMinimal(raw)
    if (text.trim().length < 30) {
      throw new Error('extracted text too short (<30 chars)')
    }
    const { docId, chunkCount } = await getKbStore().addDocument({
      kbId,
      workspaceId,
      title: url,
      content: text,
      sourceUrl: url,
      metadata: { kind: 'url-import', sourceUrl: url }
    })
    return {
      id: taskId,
      workspaceId,
      kbId,
      type: 'url',
      status: 'succeeded',
      payload: { docId, chunkCount, url },
      error: null,
      createdAt: now,
      updatedAt: now
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditLogger.warn({
      action: 'kb-task-service.importKnowledgeUrl.failed',
      workflowId: workspaceId,
      metadata: { kbId, url, message }
    })
    return {
      id: taskId,
      workspaceId,
      kbId,
      type: 'url',
      status: 'failed',
      payload: { url },
      error: message,
      createdAt: now,
      updatedAt: now
    }
  }
}

/**
 * Strip script/style + tags + collapse whitespace. NOT a real HTML parser
 * but adequate for the "fetch a blog post and ingest its prose" use case.
 * For PDFs / structured docs, a real extractor goes here in follow-up.
 */
function stripHtmlMinimal(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchKnowledgeBase(
  workspaceId: string,
  kbId: string,
  query: string,
  topK = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const results = await getKbStore().searchChunks(kbId, query, topK)
    if (results.length === 0) {
      auditLogger.info({
        action: 'kb-task-service.searchKnowledgeBase.empty',
        workflowId: workspaceId,
        metadata: { kbId, query: query.slice(0, 80), topK }
      })
    }
    return results
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    auditLogger.warn({
      action: 'kb-task-service.searchKnowledgeBase.failed',
      workflowId: workspaceId,
      metadata: { kbId, query: query.slice(0, 80), topK, message }
    })
    return []
  }
}

export async function getKnowledgeBaseStatus(
  workspaceId: string,
  kbId: string
): Promise<{
  knowledgeBase: GatewayKnowledgeBase
  tasks: GatewayKbTask[]
}> {
  await ensureKbDefinitionsTable()
  const result = await pool.query(
    `SELECT * FROM kb_definitions WHERE id = $1 AND workspace_id = $2`,
    [kbId, workspaceId]
  )
  if (result.rows.length === 0) {
    throw new Error(`Knowledge base ${kbId} not found in workspace ${workspaceId}`)
  }
  // No async-task model in the new in-process implementation — every
  // ingestion is synchronous and returns its task object directly. The
  // status query thus returns an empty tasks list; the GraphQL surface
  // keeps working without breaking changes.
  return {
    knowledgeBase: rowToKb(result.rows[0]),
    tasks: []
  }
}
