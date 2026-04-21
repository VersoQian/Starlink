const STORAGE_EMBEDDING_DIMENSIONS = 1536
const MAX_EMBEDDING_TEXT_LENGTH = Number(process.env.EMBEDDING_MAX_TEXT_LENGTH ?? '8000')

export type EmbeddingResult = {
  vector: number[]
  provider: 'openai-compatible' | 'local-hash'
  model: string
  dimensions: number
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const normalizedText = normalizeWhitespace(text).slice(0, MAX_EMBEDDING_TEXT_LENGTH)
  const dimensions = getEmbeddingDimensions()
  const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY

  if (apiKey && normalizedText) {
    try {
      return await embedRemote(normalizedText, apiKey, dimensions)
    } catch (error) {
      console.warn('[embedding-service] remote embedding failed, falling back to local embedding', {
        error: String(error)
      })
    }
  }

  return {
    vector: createLocalEmbedding(normalizedText, dimensions),
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
