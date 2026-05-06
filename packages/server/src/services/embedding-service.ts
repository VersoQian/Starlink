import { isPiiRedactionEnabled, redactPii } from './pii-redactor.js'

const STORAGE_EMBEDDING_DIMENSIONS = 1536
const MAX_EMBEDDING_TEXT_LENGTH = Number(process.env.EMBEDDING_MAX_TEXT_LENGTH ?? '8000')

export type EmbeddingResult = {
  vector: number[]
  provider: 'openai-compatible' | 'local-hash'
  model: string
  dimensions: number
}

// Throttle the per-call fallback warning. Without this, every KB chunk
// upsert / search logs a line in production when no embedding key is
// set — fills disk and hides real issues. We log on the first fall-
// through and then summarise every Nth occurrence.
let fallbackCount = 0
const FALLBACK_LOG_EVERY = 100

/**
 * Boot-time embedding configuration check. Call once during server start
 * so operators see "embedding=remote/local-hash" loud and clear in the
 * startup log instead of discovering it 30 minutes later via degraded
 * KB search quality. Returns the configured mode for callers that want
 * to surface it elsewhere (e.g. /health response).
 */
/**
 * Explicit override: `EMBEDDING_PROVIDER=local-hash` (or `=disabled` / `=none`)
 * forces local-hash mode without any remote attempt. Set this when the
 * configured chat endpoint (e.g. DeepSeek `/beta`) doesn't host an
 * embeddings route — otherwise every KB chunk floods the log with
 * "Embedding API failed: 404 Not Found" before the fallback.
 */
function isLocalHashForced(): boolean {
  const v = (process.env.EMBEDDING_PROVIDER ?? '').trim().toLowerCase()
  return v === 'local-hash' || v === 'local' || v === 'disabled' || v === 'none'
}

export function describeEmbeddingConfig(): {
  mode: 'remote' | 'local-hash'
  baseUrl: string | null
  model: string | null
  warning: string | null
} {
  if (isLocalHashForced()) {
    return {
      mode: 'local-hash',
      baseUrl: null,
      model: null,
      warning: null
    }
  }
  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY
  if (!apiKey) {
    return {
      mode: 'local-hash',
      baseUrl: null,
      model: null,
      warning:
        'No embedding API key configured. KB / memory vector search will use a deterministic local hash (poor quality). ' +
        'Set EMBEDDING_API_KEY (or OPENAI_API_KEY / LLM_API_KEY) for production-grade retrieval.'
    }
  }
  const baseUrl = stripTrailingSlash(
    process.env.EMBEDDING_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.LLM_BASE_URL ??
      'https://api.openai.com/v1'
  )
  return {
    mode: 'remote',
    baseUrl,
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    warning: null
  }
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const normalizedText = normalizeWhitespace(text).slice(0, MAX_EMBEDDING_TEXT_LENGTH)
  // F5 · PII redaction (opt-in via USER_SKILL_REDACT_PII_ON_EMBED=true).
  // Strips emails / phones / IDs / IPs / credit cards / URLs before
  // embedding so the residual leak from embedding inversion can't
  // recover those exact identifiers. See pii-redactor.ts for the full
  // honest scope discussion (this is mitigation, not solution).
  const redacted = isPiiRedactionEnabled() ? redactPii(normalizedText).redacted : normalizedText
  const dimensions = getEmbeddingDimensions()
  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY

  if (apiKey && redacted && !isLocalHashForced()) {
    try {
      return await embedRemote(redacted, apiKey, dimensions)
    } catch (error) {
      // Throttled: log every 1st + every 100th failure. Production with
      // a misconfigured embedding endpoint would otherwise drown the log.
      fallbackCount += 1
      if (fallbackCount === 1 || fallbackCount % FALLBACK_LOG_EVERY === 0) {
        console.warn('[embedding-service] remote embedding failed, falling back to local embedding', {
          error: String(error),
          fallbackCount
        })
      }
    }
  }

  return {
    vector: createLocalEmbedding(redacted, dimensions),
    provider: 'local-hash',
    model: `local-hash-${dimensions}`,
    dimensions
  }
}

export function getEmbeddingDimensions() {
  return STORAGE_EMBEDDING_DIMENSIONS
}

export function toPgVector(vector: number[]) {
  return `[${fitDimensions(vector, getEmbeddingDimensions())
    .map((value) => Number.isFinite(value) ? value.toFixed(8) : '0')
    .join(',')}]`
}

async function embedRemote(
  text: string,
  apiKey: string,
  dimensions: number
): Promise<EmbeddingResult> {
  const baseUrl = stripTrailingSlash(
    process.env.EMBEDDING_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    process.env.LLM_BASE_URL ??
    'https://api.openai.com/v1'
  )
  const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
  const requestedDimensions = Number(process.env.EMBEDDING_DIMENSIONS)
  const shouldSendDimensions = Number.isFinite(requestedDimensions) && requestedDimensions > 0

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: text,
      ...(shouldSendDimensions ? { dimensions: Math.floor(requestedDimensions) } : {})
    })
  })

  if (!response.ok) {
    throw new Error(`Embedding API failed: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json() as { data?: Array<{ embedding?: unknown }> }
  const embedding = payload.data?.[0]?.embedding
  if (!Array.isArray(embedding)) {
    throw new Error('Embedding API returned invalid payload')
  }

  return {
    vector: fitDimensions(
      normalizeVector(embedding.map((value) => Number(value)).filter(Number.isFinite)),
      dimensions
    ),
    provider: 'openai-compatible',
    model,
    dimensions
  }
}

function createLocalEmbedding(text: string, dimensions: number) {
  const vector = Array.from({ length: dimensions }, () => 0)
  const tokens = tokenize(text)

  for (const token of tokens) {
    const hash = hashToken(token)
    const index = Math.abs(hash) % dimensions
    const sign = hash % 2 === 0 ? 1 : -1
    vector[index] += sign
  }

  return normalizeVector(vector)
}

function fitDimensions(vector: number[], dimensions: number) {
  if (vector.length === dimensions) return vector
  if (vector.length > dimensions) return normalizeVector(vector.slice(0, dimensions))
  return normalizeVector([...vector, ...Array.from({ length: dimensions - vector.length }, () => 0)])
}

function tokenize(text: string) {
  const normalized = text.toLowerCase()
  const latinTokens = normalized.match(/[a-z0-9]+/g) ?? []
  const cjkChars = Array.from(normalized.match(/[\u3400-\u9fff]/g) ?? [])
  const cjkBigrams = cjkChars.slice(0, -1).map((char, index) => `${char}${cjkChars[index + 1]}`)
  return [...latinTokens, ...cjkChars, ...cjkBigrams].filter((token) => token.length > 0)
}

function hashToken(token: string) {
  let hash = 2166136261
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash | 0
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!norm) return vector
  return vector.map((value) => value / norm)
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}
