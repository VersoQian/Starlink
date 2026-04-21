import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Document, Seed } from '@prisma/client'
import { prisma } from '../prisma'

const DEFAULT_CHUNK_SIZE = Number(process.env.KB_CHUNK_SIZE ?? '900')
const DEFAULT_CHUNK_OVERLAP = Number(process.env.KB_CHUNK_OVERLAP ?? '160')
const DEFAULT_TOP_K = Number(process.env.KB_SEARCH_TOP_K ?? '5')
const LOCAL_EMBEDDING_DIMENSIONS = Number(process.env.LOCAL_EMBEDDING_DIMENSIONS ?? '384')
const MAX_INDEXED_TEXT_LENGTH = Number(process.env.KB_MAX_INDEXED_TEXT_LENGTH ?? '250000')

type KnowledgeChunkRow = {
  id: string
  kb_id: string
  source_id: string
  source_type: string
  title: string | null
  chunk_index: number
  text: string
  embedding: unknown
  token_count: number
  metadata: unknown
  created_at: Date
}

export type RagSearchResult = {
  docId: string
  snippet: string
  score: number
  metadata: Record<string, unknown>
}

type IndexSource = {
  sourceId: string
  sourceType: 'seed' | 'document' | 'url'
  title?: string | null
  text: string
  metadata?: Record<string, unknown>
}

export class RagService {
  static async ensureInfrastructure() {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
        "id" TEXT PRIMARY KEY,
        "kb_id" TEXT NOT NULL,
        "source_id" TEXT NOT NULL,
        "source_type" TEXT NOT NULL,
        "title" TEXT,
        "chunk_index" INTEGER NOT NULL,
        "text" TEXT NOT NULL,
        "embedding" JSONB NOT NULL,
        "token_count" INTEGER NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_chunks_kb_id_source_type_source_id_chunk_index_key"
      ON "knowledge_chunks"("kb_id", "source_type", "source_id", "chunk_index")
    `
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "knowledge_chunks_kb_id_idx"
      ON "knowledge_chunks"("kb_id")
    `
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "knowledge_chunks_source_id_idx"
      ON "knowledge_chunks"("source_id")
    `
  }

  static async indexSeed(seed: Seed) {
    await this.indexText(seed.kbId, {
      sourceId: seed.id,
      sourceType: 'seed',
      title: `Seed ${seed.id.slice(0, 8)}`,
      text: seed.text,
      metadata: { seedId: seed.id }
    })
  }

  static async indexDocument(document: Document) {
    const text = await extractDocumentText(document)
    await this.indexText(document.kbId, {
      sourceId: document.id,
      sourceType: document.sourceType === 'url' ? 'url' : 'document',
      title: document.title,
      text,
      metadata: {
        documentId: document.id,
        path: document.path,
        mime: document.mime,
        sourceType: document.sourceType
      }
    })
  }

  static async indexText(kbId: string, source: IndexSource) {
    await this.ensureInfrastructure()
    const normalizedText = normalizeWhitespace(source.text).slice(0, MAX_INDEXED_TEXT_LENGTH)
    if (!normalizedText) return

    const chunks = chunkText(normalizedText, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP)
    await prisma.$executeRaw`
      DELETE FROM "knowledge_chunks"
      WHERE "kb_id" = ${kbId}
        AND "source_id" = ${source.sourceId}
        AND "source_type" = ${source.sourceType}
    `

    for (const [index, chunk] of chunks.entries()) {
      const embedding = await EmbeddingService.embed(chunk)
      await prisma.$executeRaw`
        INSERT INTO "knowledge_chunks" (
          "id",
          "kb_id",
          "source_id",
          "source_type",
          "title",
          "chunk_index",
          "text",
          "embedding",
          "token_count",
          "metadata"
        ) VALUES (
          ${crypto.randomUUID()},
          ${kbId},
          ${source.sourceId},
          ${source.sourceType},
          ${source.title ?? null},
          ${index},
          ${chunk},
          ${JSON.stringify(embedding)}::jsonb,
          ${estimateTokenCount(chunk)},
          ${JSON.stringify({
            ...(source.metadata ?? {}),
            embeddingProvider: EmbeddingService.providerName(),
            embeddingDimensions: embedding.length
          })}::jsonb
        )
      `
    }
  }

  static async search(kbId: string, query: string, topK = DEFAULT_TOP_K): Promise<RagSearchResult[]> {
    await this.ensureInfrastructure()
    const normalizedQuery = normalizeWhitespace(query)
    if (!normalizedQuery) return []

    const rows = await prisma.$queryRaw<KnowledgeChunkRow[]>`
      SELECT
        "id",
        "kb_id",
        "source_id",
        "source_type",
        "title",
        "chunk_index",
        "text",
        "embedding",
        "token_count",
        "metadata",
        "created_at"
      FROM "knowledge_chunks"
      WHERE "kb_id" = ${kbId}
      ORDER BY "created_at" DESC
      LIMIT 1000
    `

    if (rows.length === 0) return []

    const queryEmbedding = await EmbeddingService.embed(normalizedQuery)
    const queryTokens = tokenize(normalizedQuery)

    return rows
      .map((row) => {
        const embedding = parseEmbedding(row.embedding)
        const semanticScore = cosineSimilarity(queryEmbedding, embedding)
        const lexicalScore = keywordOverlapScore(queryTokens, tokenize(row.text))
        const score = clampScore((semanticScore * 0.72) + (lexicalScore * 0.28))

        return {
          docId: row.source_id,
          snippet: makeSnippet(row.text, queryTokens),
          score,
          metadata: {
            ...(isRecord(row.metadata) ? row.metadata : {}),
            chunkId: row.id,
            kbId: row.kb_id,
            sourceType: row.source_type,
            title: row.title,
            chunkIndex: row.chunk_index,
            tokenCount: row.token_count
          }
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}

class EmbeddingService {
  static providerName() {
    return process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY
      ? 'openai-compatible'
      : 'local-hash'
  }

  static async embed(text: string): Promise<number[]> {
    const apiKey = process.env.EMBEDDING_API_KEY ?? process.env.OPENAI_API_KEY
    if (apiKey) {
      try {
        return await this.embedRemote(text, apiKey)
      } catch (error) {
        console.warn('[RagService] remote embedding failed, falling back to local embedding', {
          error: String(error)
        })
      }
    }
    return createLocalEmbedding(text)
  }

  private static async embedRemote(text: string, apiKey: string): Promise<number[]> {
    const baseUrl = stripTrailingSlash(process.env.EMBEDDING_BASE_URL ?? 'https://api.openai.com/v1')
    const model = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small'
    const dimensions = process.env.EMBEDDING_DIMENSIONS
      ? Number(process.env.EMBEDDING_DIMENSIONS)
      : undefined

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: text,
        ...(dimensions ? { dimensions } : {})
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

    return normalizeVector(embedding.map((value) => Number(value)).filter(Number.isFinite))
  }
}

async function extractDocumentText(document: Document) {
  if (document.sourceType === 'url') {
    return `${document.title}\n${document.path}`
  }

  const absolutePath = path.resolve(process.cwd(), document.path)

  if (document.mime.startsWith('text/')) {
    return (await fs.readFile(absolutePath, 'utf8')).slice(0, MAX_INDEXED_TEXT_LENGTH)
  }

  if (document.mime === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default
      const buffer = await fs.readFile(absolutePath)
      const parsed = await pdfParse(buffer)
      return (parsed.text || document.title).slice(0, MAX_INDEXED_TEXT_LENGTH)
    } catch (error) {
      console.warn('[RagService] failed to parse pdf, indexing metadata only', {
        documentId: document.id,
        error: String(error)
      })
    }
  }

  if (
    document.mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    document.mime === 'application/msword'
  ) {
    try {
      const mammoth = await import('mammoth')
      const parsed = await mammoth.extractRawText({ path: absolutePath })
      return (parsed.value || document.title).slice(0, MAX_INDEXED_TEXT_LENGTH)
    } catch (error) {
      console.warn('[RagService] failed to parse document, indexing metadata only', {
        documentId: document.id,
        error: String(error)
      })
    }
  }

  return `${document.title}\n${document.path}`
}

function chunkText(text: string, chunkSize: number, overlap: number) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs.length > 0 ? paragraphs : [text]) {
    if ((current + '\n\n' + paragraph).trim().length <= chunkSize) {
      current = current ? `${current}\n\n${paragraph}` : paragraph
      continue
    }

    if (current) chunks.push(current)
    if (paragraph.length <= chunkSize) {
      current = paragraph
      continue
    }

    for (let start = 0; start < paragraph.length; start += Math.max(chunkSize - overlap, 1)) {
      chunks.push(paragraph.slice(start, start + chunkSize))
    }
    current = ''
  }

  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text.slice(0, chunkSize)]
}

function createLocalEmbedding(text: string) {
  const vector = Array.from({ length: LOCAL_EMBEDDING_DIMENSIONS }, () => 0)
  const tokens = tokenize(text)

  for (const token of tokens) {
    const hash = hashToken(token)
    const index = Math.abs(hash) % LOCAL_EMBEDDING_DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[index] += sign
  }

  return normalizeVector(vector)
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

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length)
  if (length === 0) return 0
  let score = 0
  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index]
  }
  return (score + 1) / 2
}

function keywordOverlapScore(queryTokens: string[], textTokens: string[]) {
  if (queryTokens.length === 0 || textTokens.length === 0) return 0
  const textSet = new Set(textTokens)
  const matches = new Set(queryTokens.filter((token) => textSet.has(token)))
  return matches.size / new Set(queryTokens).size
}

function parseEmbedding(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite)
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : []
    } catch {
      return []
    }
  }
  return []
}

function makeSnippet(text: string, queryTokens: string[]) {
  const lowered = text.toLowerCase()
  const firstMatch = queryTokens
    .map((token) => lowered.indexOf(token.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0]

  if (firstMatch === undefined) {
    return text.length > 360 ? `${text.slice(0, 360)}...` : text
  }

  const start = Math.max(firstMatch - 120, 0)
  const end = Math.min(start + 360, text.length)
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim()
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(4))))
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
