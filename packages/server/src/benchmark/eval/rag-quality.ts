/**
 * P11.17 · RAG retrieval-quality benchmark.
 *
 * Measures recall@K, precision@K, MRR for KB chunk retrieval.
 *
 * Why this exists: with EMBEDDING_PROVIDER=local-hash retrieval is
 * essentially random. Switching to a real embedding (text-embedding-
 * 3-small etc) should improve metrics meaningfully — this harness
 * lets us prove that quantitatively before/after the switch.
 *
 * Usage:
 *   pnpm --filter @starlink/server eval:rag           # run all KBs
 *   pnpm --filter @starlink/server eval:rag --kb=KB_ID
 *
 * Test cases live in `RAG_TEST_QUERIES` below — each is a
 * (query, expectedDocIds[]) pair. recall@K = (# expected docs in
 * top-K) / (# expected docs); precision@K = (# expected docs in
 * top-K) / K; MRR = 1/rank-of-first-relevant-doc.
 */

import { getKbStore } from '../../application/kb-store.js'
import { listKnowledgeBases } from '../../services/kb-task-service.js'

interface RagTestCase {
  /** Query string the user would ask. */
  query: string
  /** docIds that SHOULD appear in top-K (golden labels). */
  expectedDocIds: string[]
  /** Optional category for grouped reporting. */
  tag?: string
}

interface KbEvalResult {
  kbId: string
  cases: number
  recallAt5: number
  precisionAt5: number
  mrr: number
  averageScore: number
  detail: Array<{
    query: string
    rank: number | null
    foundExpected: number
    topScore: number
  }>
}

/**
 * Hand-curated test queries. Each entry is (query, expected doc-ids).
 * Populate per-KB with golden-set queries that domain experts agree
 * are "obviously" relevant. Start with 5-10 per KB; expand as the
 * benchmark stabilises.
 *
 * Empty by default — populate via the optional --queries=path/to.json
 * CLI flag below or by editing this constant.
 */
const RAG_TEST_QUERIES: Record<string, RagTestCase[]> = {
  // 咖啡 B2B 调研 KB · 8 个 golden queries
  // 文档：B2B 团队咖啡订阅服务调研笔记（市场背景 / 痛点 / 价值主张 / 收入模型 / 验证渠道 / 风险）
  CYXwVKqmzKvurYQo3BIrP: [
    // 直接关键词匹配
    { query: '中型科技公司办公室咖啡每月预算', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    { query: '订阅服务的定价层级和毛利', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    // 语义改写
    { query: '我们的产品和星巴克 to-B 有什么不同', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    { query: '小规模 office 怎么获得高品质咖啡豆', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    // 痛点 / 验证
    { query: '行政管理者在采购咖啡上花多少时间', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    { query: 'MVP 试点城市和续订率目标', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    // 风险
    { query: '烘焙商绕开平台直连客户怎么办', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
    { query: '经济下行对办公福利支出的影响', expectedDocIds: ['DdaWRnuaYxDSa9T5qm7N9'] },
  ],
}

async function evalKb(kbId: string, cases: RagTestCase[], topK = 5): Promise<KbEvalResult> {
  const detail: KbEvalResult['detail'] = []
  let recallSum = 0
  let precisionSum = 0
  let mrrSum = 0
  let scoreSum = 0

  for (const tc of cases) {
    const results = await getKbStore().searchChunks(kbId, tc.query, topK, {
      // Use minScore=0 so the eval sees raw retrieval quality without
      // the production threshold cutting recall artificially.
      minScore: 0
    })
    const retrievedDocIds = results.map((r) => r.docId)
    const expectedSet = new Set(tc.expectedDocIds)

    // Find rank of first matching expected doc.
    let rank: number | null = null
    for (let i = 0; i < retrievedDocIds.length; i++) {
      if (expectedSet.has(retrievedDocIds[i])) {
        rank = i + 1
        break
      }
    }
    const found = retrievedDocIds.filter((d) => expectedSet.has(d)).length
    const recall = expectedSet.size > 0 ? found / expectedSet.size : 0
    const precision = retrievedDocIds.length > 0 ? found / retrievedDocIds.length : 0
    const mrr = rank ? 1 / rank : 0
    const topScore = results[0]?.score ?? 0

    recallSum += recall
    precisionSum += precision
    mrrSum += mrr
    scoreSum += topScore
    detail.push({ query: tc.query, rank, foundExpected: found, topScore })
  }

  const n = cases.length || 1
  return {
    kbId,
    cases: cases.length,
    recallAt5: recallSum / n,
    precisionAt5: precisionSum / n,
    mrr: mrrSum / n,
    averageScore: scoreSum / n,
    detail
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const kbFlag = argv.find((a) => a.startsWith('--kb='))?.replace('--kb=', '')
  const queriesPathFlag = argv.find((a) => a.startsWith('--queries='))?.replace('--queries=', '')

  // Optional: load test cases from external JSON file.
  if (queriesPathFlag) {
    const fs = await import('node:fs/promises')
    try {
      const text = await fs.readFile(queriesPathFlag, 'utf8')
      const parsed = JSON.parse(text) as Record<string, RagTestCase[]>
      Object.assign(RAG_TEST_QUERIES, parsed)
      console.log(`[rag-eval] loaded test cases from ${queriesPathFlag}`)
    } catch (err) {
      console.error(`[rag-eval] failed to load ${queriesPathFlag}:`, err)
      process.exit(1)
    }
  }

  // Determine which KBs to eval.
  const allKbIds = kbFlag
    ? [kbFlag]
    : Object.keys(RAG_TEST_QUERIES).length > 0
      ? Object.keys(RAG_TEST_QUERIES)
      : (await listKnowledgeBases('').catch(() => [])).map((kb: { id: string }) => kb.id)

  if (allKbIds.length === 0) {
    console.error('[rag-eval] no KBs to evaluate. Either populate RAG_TEST_QUERIES or pass --kb=ID.')
    process.exit(1)
  }

  console.log(`[rag-eval] evaluating ${allKbIds.length} KB(s)`)
  console.log(`[rag-eval] EMBEDDING_PROVIDER=${process.env.EMBEDDING_PROVIDER ?? '(default)'}`)
  console.log(`[rag-eval] KB_SEARCH_MIN_SCORE=${process.env.KB_SEARCH_MIN_SCORE ?? '0.55'}`)
  console.log()

  const results: KbEvalResult[] = []
  for (const kbId of allKbIds) {
    const cases = RAG_TEST_QUERIES[kbId] ?? []
    if (cases.length === 0) {
      console.log(`[rag-eval] ${kbId}: no test cases, skipping`)
      continue
    }
    const r = await evalKb(kbId, cases)
    results.push(r)
    console.log(
      `[rag-eval] ${kbId}: cases=${r.cases} recall@5=${r.recallAt5.toFixed(3)} precision@5=${r.precisionAt5.toFixed(3)} MRR=${r.mrr.toFixed(3)} avgScore=${r.averageScore.toFixed(3)}`
    )
    for (const d of r.detail) {
      console.log(`  · "${d.query}" → rank=${d.rank ?? 'NOT-IN-TOP-5'} found=${d.foundExpected} topScore=${d.topScore.toFixed(3)}`)
    }
  }

  // Aggregate across KBs.
  if (results.length > 1) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    console.log()
    console.log(
      `[rag-eval] AGGREGATE: recall@5=${avg(results.map((r) => r.recallAt5)).toFixed(3)} precision@5=${avg(results.map((r) => r.precisionAt5)).toFixed(3)} MRR=${avg(results.map((r) => r.mrr)).toFixed(3)}`
    )
  }
}

main().catch((err) => {
  console.error('[rag-eval] FAILED:', err)
  process.exit(1)
})
