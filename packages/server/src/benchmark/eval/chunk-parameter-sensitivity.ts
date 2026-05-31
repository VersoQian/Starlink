/**
 * Chunk-parameter sensitivity benchmark.
 *
 * Re-chunks the persisted benchmark documents in memory, then applies the
 * production embedding service, bilingual lexical tokenizer, and RRF ranking
 * formula. The script does not mutate kb_documents or kb_chunks.
 *
 * Usage:
 *   pnpm --filter @starlink/server eval:chunk-sensitivity
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chunkText, tokenizeForLexical } from '../../application/kb-store.js'
import { pool } from '../../infrastructure/db/pool.js'
import { embedText } from '../../services/embedding-service.js'

type GoldenCase = {
  kbId: string
  query: string
  expectedDocIds: string[]
}

type DocumentRow = {
  kb_id: string
  id: string
  title: string
  content: string
}

type Chunk = {
  id: string
  kbId: string
  docId: string
  content: string
  vector: number[]
}

type RankedChunk = Chunk & {
  score: number
}

type Config = {
  label: string
  targetChars: number
  overlapChars: number
}

type Metrics = {
  chunkCount: number
  hitAt5: number
  mrr: number
}

const RRF_K = 60
const TOP_K = 5
const POOL_SIZE = TOP_K * 4

// Full grid sweep: targetChars 300–900 (step 100), overlapChars 40–120 (step 20)
const TARGET_SWEEP = [300, 400, 500, 600, 700, 800, 900]
const OVERLAP_SWEEP = [40, 60, 80, 100, 120]

function buildConfigs(): Config[] {
  const configs: Config[] = []
  for (const targetChars of TARGET_SWEEP) {
    for (const overlapChars of OVERLAP_SWEEP) {
      const isDefault = targetChars === 600 && overlapChars === 80
      configs.push({
        label: `target=${targetChars}, overlap=${overlapChars}${isDefault ? ' (default)' : ''}`,
        targetChars,
        overlapChars
      })
    }
  }
  return configs
}

const CONFIGS: Config[] = buildConfigs()

const GOLDEN_CASES: GoldenCase[] = [
  {
    kbId: 'kb-bench-saas-pricing',
    query: 'Stripe transaction fee 2.9%',
    expectedDocIds: ['doc-saas-pricing-tiers-2024']
  },
  {
    kbId: 'kb-bench-saas-pricing',
    query: 'NRR 130% Snowflake Datadog',
    expectedDocIds: ['doc-saas-churn-strategies-2024']
  },
  {
    kbId: 'kb-bench-saas-pricing',
    query: '订阅按使用量计费 vs 按席位计费',
    expectedDocIds: ['doc-saas-pricing-tiers-2024']
  },
  {
    kbId: 'kb-bench-saas-pricing',
    query: '客户成功比新客户获取便宜多少',
    expectedDocIds: ['doc-saas-churn-strategies-2024']
  },
  {
    kbId: 'kb-bench-saas-pricing',
    query: 'Notion 4.2% conversion 是怎么测算的',
    expectedDocIds: ['doc-saas-pricing-tiers-2024']
  },
  {
    kbId: 'kb-bench-saas-pricing',
    query: 'aha moment 和 onboarding 完成率关系',
    expectedDocIds: ['doc-saas-churn-strategies-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: 'CE 认证范围 EMC LVD 指令',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: 'FCC Part 15 Subpart C SAR 测试',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: 'GDPR 第 17 条删除请求',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: '电池可拆卸 2027 新规',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: '337 调查华为小米遭遇过几次',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  },
  {
    kbId: 'kb-bench-hardware-export',
    query: '智能音箱在欧盟需要哪些用户数据合规',
    expectedDocIds: ['doc-hw-ce-fcc-2024']
  }
]

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function lexicalHits(content: string, query: string): number {
  const lower = content.toLowerCase()
  return tokenizeForLexical(query).filter((token) => lower.includes(token.toLowerCase())).length
}

function rankHybrid(chunks: Chunk[], queryVector: number[], query: string): RankedChunk[] {
  const semantic = [...chunks]
    .map((chunk) => ({ chunk, score: cosine(chunk.vector, queryVector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, POOL_SIZE)

  const lexical = chunks
    .map((chunk) => ({ chunk, hits: lexicalHits(chunk.content, query) }))
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.chunk.content.length - b.chunk.content.length)
    .slice(0, POOL_SIZE)

  const byId = new Map<string, RankedChunk>()
  semantic.forEach(({ chunk }, index) => {
    byId.set(chunk.id, { ...chunk, score: 1 / (RRF_K + index + 1) })
  })
  lexical.forEach(({ chunk }, index) => {
    const existing = byId.get(chunk.id)
    if (existing) {
      existing.score += 1 / (RRF_K + index + 1)
    } else {
      byId.set(chunk.id, { ...chunk, score: 1 / (RRF_K + index + 1) })
    }
  })
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, TOP_K)
}

async function loadDocuments(): Promise<DocumentRow[]> {
  const kbIds = [...new Set(GOLDEN_CASES.map((tc) => tc.kbId))]
  const result = await pool.query(
    `SELECT kb_id, id, title, content
       FROM kb_documents
      WHERE kb_id = ANY($1::text[])
      ORDER BY kb_id, id`,
    [kbIds]
  )
  return result.rows as DocumentRow[]
}

async function buildChunks(documents: DocumentRow[], config: Config): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  for (const document of documents) {
    const pieces = chunkText(document.content, config)
    for (let index = 0; index < pieces.length; index++) {
      const content = pieces[index]
      const embedding = await embedText(content)
      chunks.push({
        id: `${document.id}#${index}`,
        kbId: document.kb_id,
        docId: document.id,
        content,
        vector: embedding.vector
      })
    }
  }
  return chunks
}

let _queryEmbeddingsCache: Map<string, { vector: number[] }> | null = null

async function precacheQueryEmbeddings(): Promise<Map<string, { vector: number[] }>> {
  if (_queryEmbeddingsCache) return _queryEmbeddingsCache
  console.log('[chunk-sensitivity] pre-caching query embeddings...')
  const cache = new Map<string, { vector: number[] }>()
  for (const tc of GOLDEN_CASES) {
    if (!cache.has(tc.query)) {
      cache.set(tc.query, await embedText(tc.query))
    }
  }
  _queryEmbeddingsCache = cache
  return cache
}

async function evaluate(documents: DocumentRow[], config: Config, queryCache: Map<string, { vector: number[] }>): Promise<Metrics> {
  const chunks = await buildChunks(documents, config)
  let hits = 0
  let reciprocalRank = 0
  for (const tc of GOLDEN_CASES) {
    const queryEmbedding = queryCache.get(tc.query)!
    const ranked = rankHybrid(
      chunks.filter((chunk) => chunk.kbId === tc.kbId),
      queryEmbedding.vector,
      tc.query
    )
    const rank = ranked.findIndex((chunk) => tc.expectedDocIds.includes(chunk.docId))
    if (rank >= 0) {
      hits += 1
      reciprocalRank += 1 / (rank + 1)
    }
  }
  return {
    chunkCount: chunks.length,
    hitAt5: hits / GOLDEN_CASES.length,
    mrr: reciprocalRank / GOLDEN_CASES.length
  }
}

function fmt(value: number): string {
  return value.toFixed(3)
}

async function main(): Promise<void> {
  const documents = await loadDocuments()
  if (documents.length === 0) {
    throw new Error('No benchmark documents found. Run pnpm --filter @starlink/server kb:seed-bench first.')
  }

  const queryCache = await precacheQueryEmbeddings()

  const rows: Array<{ config: Config; metrics: Metrics }> = []
  for (const config of CONFIGS) {
    console.log(`[chunk-sensitivity] evaluating ${config.label}`)
    rows.push({ config, metrics: await evaluate(documents, config, queryCache) })
  }

  const defaultRow = rows.find((row) => row.config.targetChars === 600 && row.config.overlapChars === 80)
  if (!defaultRow) throw new Error('Default chunk configuration missing')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputDir = join(process.cwd(), 'benchmark', 'reports')
  const outputPath = join(outputDir, `chunk-sensitivity-${timestamp}.md`)
  const lines = [
    '# Chunk Parameter Sensitivity',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Documents: ${documents.length}`,
    `- Golden queries: ${GOLDEN_CASES.length}`,
    `- Retrieval: bilingual lexical channel + vector cosine + RRF (k=${RRF_K})`,
    '- Metrics: document-level Hit@5 and MRR. The experiment re-chunks in memory and does not mutate the KB.',
    '',
    '| Configuration | Chunks | Hit@5 | MRR | MRR delta vs default |',
    '|---|---:|---:|---:|---:|',
    ...rows.map(({ config, metrics }) => {
      const delta = metrics.mrr - defaultRow.metrics.mrr
      return `| ${config.label} | ${metrics.chunkCount} | ${fmt(metrics.hitAt5)} | ${fmt(metrics.mrr)} | ${delta >= 0 ? '+' : ''}${fmt(delta)} |`
    }),
    ''
  ]

  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, lines.join('\n'), 'utf8')
  console.log()
  console.log(lines.join('\n'))
  console.log(`[chunk-sensitivity] report=${outputPath}`)
}

main()
  .catch((error) => {
    console.error('[chunk-sensitivity] FAILED', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
