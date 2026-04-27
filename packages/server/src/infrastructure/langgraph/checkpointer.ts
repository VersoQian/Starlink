import { createAuditLogger } from '@starlink/shared'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import { pool } from '../db/pool.js'

/**
 * F2 · LangGraph PostgresSaver checkpointer (singleton).
 *
 * Provides cross-restart durability for LangGraph state so that:
 *   - HITL pauses survive server restarts (resume by thread_id)
 *   - Long-running seminars can be inspected post-mortem
 *   - Multiple gateway instances can share state (shared PG)
 *
 * Reuses the existing `pg` Pool from infrastructure/db/pool.ts — never opens a
 * second connection pool. Auto-DDLs the 3 LangGraph tables (`checkpoints`,
 * `checkpoint_blobs`, `checkpoint_writes`) on first use via `setup()`.
 *
 * Gated by env flag `LANGGRAPH_CHECKPOINTER_ENABLED=true` (default off, fail
 * safe). On any failure (missing DB, DDL error, etc.) we log to audit and
 * return null — callers must treat null as "no checkpointer, proceed without
 * persistence" rather than failing the request.
 */

const auditLogger = createAuditLogger('packages/server:langgraph-checkpointer')

let initialized = false
let cached: PostgresSaver | null = null
let setupPromise: Promise<PostgresSaver | null> | null = null

function isEnabled(): boolean {
  // Explicit opt-out wins.
  if (process.env.LANGGRAPH_CHECKPOINTER_ENABLED === 'false') return false
  // Explicit opt-in.
  if (process.env.LANGGRAPH_CHECKPOINTER_ENABLED === 'true') return true
  // Default: ON whenever a DATABASE_URL is configured. Production gateways
  // always have one; CI/unit tests that set neither stay opted out, which
  // is what we want (no PG = no checkpointer).
  return Boolean(process.env.DATABASE_URL)
}

async function buildCheckpointer(): Promise<PostgresSaver | null> {
  try {
    // PostgresSaver in @langchain/langgraph-checkpoint-postgres 0.x accepts a
    // node-pg Pool. We reuse the existing pool from infrastructure/db/pool.ts
    // so connection-count stays bounded across the gateway.
    //
    // Type cast: PostgresSaver's TS signature evolved across 0.0.x → 0.1.x;
    // we pin to a Pool-compatible call via `as unknown` to avoid coupling to
    // a specific minor's exported types while keeping runtime behaviour stable.
    const SaverCtor = PostgresSaver as unknown as new (pgPool: unknown) => PostgresSaver
    const checkpointer = new SaverCtor(pool)
    await checkpointer.setup()
    auditLogger.info({
      action: 'langgraph-checkpointer.ready',
      requestId: 'startup',
      metadata: { driver: 'pg', tables: ['checkpoints', 'checkpoint_blobs', 'checkpoint_writes'] }
    })
    return checkpointer
  } catch (error) {
    auditLogger.error({
      action: 'langgraph-checkpointer.setup_failed',
      requestId: 'startup',
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
    return null
  }
}

/**
 * Returns a lazily-initialised PostgresSaver, or null if disabled / failed.
 * Safe to call repeatedly — DDL only runs once per process.
 */
export async function getCheckpointer(): Promise<PostgresSaver | null> {
  if (!isEnabled()) return null
  if (initialized) return cached
  if (!setupPromise) {
    setupPromise = buildCheckpointer().then((saver) => {
      cached = saver
      initialized = true
      return saver
    })
  }
  return await setupPromise
}

/** Test helper — reset the singleton between tests. */
export function __resetCheckpointerForTests() {
  initialized = false
  cached = null
  setupPromise = null
}
