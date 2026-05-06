/**
 * KB-aware wizard pre-read.
 *
 * When a user starts the structured wizard while KB content already exists
 * for their workspace, instead of asking 7 generic questions, we:
 *   1. Sample KB chunks per wizard dimension (cosine retrieval against a
 *      step-specific seed query)
 *   2. Send the chunks + 7 dimension definitions to one LLM call
 *   3. Get back a per-step assessment: covered / partial / absent +
 *      draft answer + supporting citations
 *
 * The frontend uses this to skip already-covered steps (user just confirms)
 * and only ask the user about gaps.
 *
 * Why one LLM call (not 7): cheaper + the model can use cross-step context
 * (e.g. revenue model implies customer segment). Cap input at ~16K chars
 * of KB excerpts so we stay under provider limits.
 */

import { LLMClient } from './llm-client.js'
import { listKnowledgeBases, searchKnowledgeBase } from './kb-task-service.js'
import { listKbBindingsForAgent } from './kb-task-service.js'
import { createAuditLogger } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:services:wizard-prefill')

export interface PrefillCitation {
  docId: string
  snippet: string
}

export interface PrefillItem {
  step: string
  status: 'covered' | 'partial' | 'absent'
  draftAnswer: string
  citations: PrefillCitation[]
  confidence: number
}

export interface WizardPrefillResult {
  items: PrefillItem[]
  kbNames: string[]
  chunksScanned: number
}

/**
 * Per-step seed queries used for cosine retrieval. Picked so they hit
 * the typical KB content patterns (case studies / market reports /
 * pitch decks).
 */
const STEP_SEEDS: Record<string, string> = {
  'core-idea':     '产品核心想法 价值主张 一句话总结',
  'customer-pain': '客户痛点 用户问题 使用场景 困扰',
  'value-angle':   '差异化 独特价值 竞争优势 切入点',
  'hypothesis':    '关键假设 前提条件 待验证',
  'validation':    '验证方法 测试渠道 MVP 试点',
  'revenue':       '商业模式 定价 收入来源 付费意愿',
  'risk':          '主要风险 失败原因 阻碍因素'
}

const STEP_LABELS: Record<string, string> = {
  'core-idea':     '核心想法 / Core Idea',
  'customer-pain': '客户痛点 / Customer Pain',
  'value-angle':   '价值切入 / Value Angle',
  'hypothesis':    '关键假设 / Hypothesis',
  'validation':    '验证渠道 / Validation Channel',
  'revenue':       '收入模式 / Revenue Model',
  'risk':          '主要风险 / Key Risk'
}

const SYSTEM_PROMPT = `你是一个商业模型分析助手。我会给你 7 个商业模型维度的定义，以及用户已上传的 KB 知识库片段。

你的任务：对每个维度判断 KB 是否已经覆盖了内容，并按下面 JSON Schema 返回。

输出 JSON Schema:
{
  "items": [
    {
      "step": "core-idea" | "customer-pain" | "value-angle" | "hypothesis" | "validation" | "revenue" | "risk",
      "status": "covered" | "partial" | "absent",
      "draftAnswer": "如果 covered/partial，给出 2-3 句话的总结作为草稿；absent 时为空字符串",
      "citations": [{"docId": "doc1", "snippet": "原文片段最多 100 字"}],
      "confidence": 0.0-1.0
    }
  ]
}

判定规则：
- covered (信心 ≥ 0.7)：KB 中能找到清晰证据支持该维度
- partial (信心 0.4-0.7)：KB 提到一些但不完整
- absent (信心 < 0.4)：KB 与该维度无关

只引用 KB 中确实存在的片段；不要编造。citations 最多 2 条，snippet 必须是 KB 原文。`

/**
 * Module-scope helpers exported for unit testing. Strict pure functions
 * — no side effects, no I/O. Used internally by WizardPrefillService.
 */

export function parsePrefillReply(raw: string): { items: PrefillItem[] } | null {
  if (!raw) return null
  // Strip markdown code fences if present.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as { items?: unknown[] }
    if (!Array.isArray(parsed.items)) return null
    return { items: parsed.items as PrefillItem[] }
  } catch {
    // Try to extract first {...} JSON block.
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      const parsed = JSON.parse(m[0]) as { items?: unknown[] }
      if (!Array.isArray(parsed.items)) return null
      return { items: parsed.items as PrefillItem[] }
    } catch {
      return null
    }
  }
}

export function normalisePrefillItem(raw: unknown): PrefillItem {
  const r = raw as Partial<PrefillItem>
  const status = r.status === 'covered' || r.status === 'partial' ? r.status : 'absent'
  const draftAnswer = typeof r.draftAnswer === 'string' ? r.draftAnswer.slice(0, 600) : ''
  const confidence = typeof r.confidence === 'number'
    ? Math.max(0, Math.min(1, r.confidence))
    : 0
  const citations = Array.isArray(r.citations)
    ? r.citations
        .filter((c): c is PrefillCitation =>
          !!c && typeof (c as PrefillCitation).docId === 'string' && typeof (c as PrefillCitation).snippet === 'string'
        )
        .slice(0, 2)
        .map((c) => ({ docId: c.docId, snippet: c.snippet.slice(0, 200) }))
    : []
  return {
    step: typeof r.step === 'string' ? r.step : '',
    status,
    draftAnswer,
    citations,
    confidence
  }
}

interface DepsLike {
  llm: LLMClient
}

export class WizardPrefillService {
  private readonly llm: LLMClient
  constructor(deps: DepsLike) {
    this.llm = deps.llm
  }

  async prefill(args: {
    workspaceId: string
    userId: string
    /** Optional: limit to one KB. When omitted, samples all KBs in the workspace. */
    kbId?: string
  }): Promise<WizardPrefillResult> {
    const startedAt = Date.now()

    // 1. Resolve which KBs to scan.
    const allKbs = await listKnowledgeBases(args.workspaceId)
    const targetKbs = args.kbId
      ? allKbs.filter((kb) => kb.id === args.kbId)
      : allKbs
    if (targetKbs.length === 0) {
      // No KBs at all → return all-absent quickly.
      return {
        items: Object.keys(STEP_SEEDS).map((step) => ({
          step,
          status: 'absent' as const,
          draftAnswer: '',
          citations: [],
          confidence: 0
        })),
        kbNames: [],
        chunksScanned: 0
      }
    }

    // 2. Per-step retrieval (top-3 chunks per dimension per KB).
    const stepIds = Object.keys(STEP_SEEDS)
    const allChunks: Array<{ step: string; docId: string; snippet: string; score: number }> = []
    for (const stepId of stepIds) {
      const seed = STEP_SEEDS[stepId]
      for (const kb of targetKbs) {
        try {
          const results = await searchKnowledgeBase(
            args.workspaceId,
            kb.id,
            seed,
            3,
            args.userId
          )
          for (const r of results) {
            allChunks.push({
              step: stepId,
              docId: r.docId,
              snippet: r.snippet.slice(0, 240),
              score: r.score
            })
          }
        } catch (err) {
          auditLogger.warn({
            action: 'wizard-prefill.search-failed',
            workflowId: args.workspaceId,
            userId: args.userId,
            metadata: { kbId: kb.id, step: stepId, err: err instanceof Error ? err.message : String(err) }
          })
        }
      }
    }

    if (allChunks.length === 0) {
      return {
        items: stepIds.map((step) => ({ step, status: 'absent' as const, draftAnswer: '', citations: [], confidence: 0 })),
        kbNames: targetKbs.map((k) => k.name),
        chunksScanned: 0
      }
    }

    // 3. One LLM call: stuff all retrieved chunks (capped at 16K chars) +
    //    dimension definitions, ask for per-step assessment.
    const userMessage = this.buildUserMessage(allChunks)
    let parsed: { items: PrefillItem[] } | null = null
    try {
      const response = await this.llm.chat({
        // deepseek-v4-flash is the cheap-fast tier — appropriate for
        // a one-shot scan of a few KB chunks. The default model name
        // (gpt-4o-mini) gets rejected by our DeepSeek-compatible
        // backend with HTTP 400.
        model: process.env.WIZARD_PREFILL_MODEL ?? 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1
      })
      parsed = parsePrefillReply(response.content ?? '')
    } catch (err) {
      auditLogger.warn({
        action: 'wizard-prefill.llm-failed',
        workflowId: args.workspaceId,
        userId: args.userId,
        metadata: { err: err instanceof Error ? err.message : String(err) }
      })
    }

    // 4. Normalise: ensure all 7 steps present, defaults to absent.
    const itemsMap = new Map<string, PrefillItem>()
    for (const stepId of stepIds) {
      itemsMap.set(stepId, {
        step: stepId,
        status: 'absent',
        draftAnswer: '',
        citations: [],
        confidence: 0
      })
    }
    if (parsed?.items) {
      for (const item of parsed.items) {
        if (stepIds.includes(item.step)) {
          itemsMap.set(item.step, normalisePrefillItem(item))
        }
      }
    }

    const result: WizardPrefillResult = {
      items: stepIds.map((s) => itemsMap.get(s)!),
      kbNames: targetKbs.map((k) => k.name),
      chunksScanned: allChunks.length
    }
    auditLogger.info({
      action: 'wizard-prefill.completed',
      workflowId: args.workspaceId,
      userId: args.userId,
      metadata: {
        durationMs: Date.now() - startedAt,
        chunksScanned: allChunks.length,
        coveredCount: result.items.filter((i) => i.status === 'covered').length,
        partialCount: result.items.filter((i) => i.status === 'partial').length
      }
    })
    return result
  }

  private buildUserMessage(chunks: Array<{ step: string; docId: string; snippet: string; score: number }>): string {
    // Group by step + cap total length.
    const byStep: Record<string, typeof chunks> = {}
    for (const c of chunks) {
      if (!byStep[c.step]) byStep[c.step] = []
      byStep[c.step].push(c)
    }
    const sections: string[] = []
    sections.push('## 7 个维度定义\n')
    for (const [step, label] of Object.entries(STEP_LABELS)) {
      sections.push(`- **${step}** (${label}): ${STEP_SEEDS[step]}`)
    }
    sections.push('\n## KB 检索片段（按维度分组）\n')
    let totalChars = 0
    const limit = 16_000
    for (const stepId of Object.keys(STEP_SEEDS)) {
      const stepChunks = byStep[stepId] ?? []
      if (stepChunks.length === 0) continue
      sections.push(`\n### ${STEP_LABELS[stepId]}`)
      // Top 3 by score
      const top = stepChunks.sort((a, b) => b.score - a.score).slice(0, 3)
      for (const c of top) {
        const line = `[doc:${c.docId}] ${c.snippet}`
        if (totalChars + line.length > limit) break
        sections.push(line)
        totalChars += line.length
      }
    }
    sections.push('\n## 任务')
    sections.push('对每个维度，依据上面的 KB 片段判断 status (covered/partial/absent) + draftAnswer + citations + confidence。返回纯 JSON。')
    return sections.join('\n')
  }

}

// Avoid unused-import warning for listKbBindingsForAgent — referenced in
// future per-agent prefill scope. Keep import for forward compatibility.
void listKbBindingsForAgent
