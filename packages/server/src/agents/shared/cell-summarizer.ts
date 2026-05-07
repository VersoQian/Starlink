/**
 * BMC Cell Summarizer · post-generator distillation pass (P11.5 / B3)
 *
 * Each market/product/finance generator agent emits a `MacraNodeData` with
 * both `summary` (~120-200 字 markdown) and `content` (~300-800 字 markdown).
 * The agent's own summary is constrained by single-call attention budget —
 * the agent has to context-switch between writing detail and writing digest,
 * leading to truncation, formulaic templates, and inconsistent coverage.
 *
 * This helper runs an independent post-hoc distillation pass on each cell's
 * `content` using a cheap-fast model (deepseek-v4-flash by default).
 * The summarizer has a single dedicated job: read the full content and emit a
 * concise markdown digest that covers every H2/H3 sub-section's core takeaway
 * while preserving key numbers and named entities.
 *
 * Failure semantics: caller is expected to wrap each call in try/catch.
 * On any failure (LLM error / empty response / over-length), throw and let
 * the caller fall back to the agent's original summary. We never silently
 * substitute a degraded summary.
 */

import { LLMClient } from '../../services/llm-client.js'
import { createAuditLogger } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:agents:cell-summarizer')

const DEFAULT_MODEL = process.env.BMC_SUMMARIZER_MODEL ?? 'deepseek-v4-flash'
const MIN_SUMMARY_CHARS = 60
const MAX_SUMMARY_CHARS = 600 // hard cap from bmcAnalysisCardSchema

export interface SummarizeCellOptions {
  /** BMC domain in Chinese (e.g. "客户细分"). Used to flavor the prompt. */
  domain?: string
  /** Cell label (e.g. "目标客户群体"). Helps the summarizer name the subject. */
  label?: string
  /** Optional model override; defaults to BMC_SUMMARIZER_MODEL env or v4-flash. */
  model?: string
  /** trace info for audit logs. */
  traceId?: string
  workspaceId?: string
  userId?: string
}

export interface SummarizerDeps {
  /**
   * LLMClient instance. Caller injects so we share connection pooling
   * with other server-side LLM consumers.
   */
  llm: LLMClient
}

const SYSTEM_PROMPT = `你是商业模型画布（BMC）的"卡片摘要员"。你的唯一任务是把一段 BMC 单元格的详细分析（markdown）压缩成一段精华摘要（markdown）。

## 输出要求

1. **长度**：120-180 个汉字（含 markdown 语法），单段或最多含 1 个短列表（≤ 3 项）。
2. **覆盖度**：原文每一个 H2 / H3 / 编号小节的核心 takeaway 都必须被提到（用一个短句即可），允许使用同义改写。
3. **保留**：关键数字、百分比、金额、专有名词、Wizard N 编号、引用标记必须保留。
4. **markdown**：用 \`**关键词**\` 加粗 2-3 个核心概念；不需要 H2/H3。如有 ≥ 3 个并列点可用短列表。
5. **禁止**：禁止省略号（…/...）、禁止 \`# 标题\`、禁止 "本摘要"/"以下"等元描述、禁止重复 cell 标题作为开头。

## 输出格式

直接输出 markdown 文本，不要包裹代码块、不要 JSON、不要前缀。第一句应直接陈述结论。`

function buildUserPrompt(content: string, opts: SummarizeCellOptions): string {
  const labelLine = opts.label ? `\n卡片标题：${opts.label}` : ''
  const domainLine = opts.domain ? `\nBMC 维度：${opts.domain}` : ''
  return `请为下面这张 BMC 卡片的"详细分析"写一段精华摘要。${labelLine}${domainLine}

==== 详细分析（待压缩）====

${content}

==== 现在输出精华摘要（120-180 字 markdown，单段或短列表，无省略号）====`
}

/**
 * Strip leading code fences / "摘要：" prefixes / trailing whitespace so the
 * raw markdown drops cleanly into the drawer's prose renderer.
 */
function postProcess(raw: string): string {
  let s = raw.trim()
  // Strip ```markdown ... ``` or ``` ... ``` wrappers
  const fence = s.match(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/)
  if (fence) s = fence[1].trim()
  // Strip leading "摘要：" / "总结：" prefixes
  s = s.replace(/^(摘要|总结|核心摘要|精华摘要)\s*[:：]\s*/, '')
  // Collapse runs of trailing ellipsis (defensive — prompt forbids them)
  s = s.replace(/[…\.]{2,}\s*$/, '').trim()
  return s
}

/**
 * Distill one cell's content into a 120-180 char markdown summary.
 * Throws on failure; caller is expected to fall back to the agent's
 * original summary.
 */
export async function summarizeCellMarkdown(
  content: string,
  opts: SummarizeCellOptions,
  deps: SummarizerDeps
): Promise<string> {
  const trimmed = content?.trim()
  if (!trimmed || trimmed.length < 40) {
    throw new Error(`cell-summarizer: content too short (${trimmed?.length ?? 0} chars)`)
  }

  const startedAt = Date.now()
  const model = opts.model ?? DEFAULT_MODEL
  const response = await deps.llm.chat({
    model,
    temperature: 0.1,
    maxTokens: 600,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(trimmed, opts) }
    ]
  })

  const raw = response.content ?? ''
  const summary = postProcess(raw)

  if (summary.length < MIN_SUMMARY_CHARS) {
    throw new Error(`cell-summarizer: output too short (${summary.length} chars)`)
  }
  if (summary.length > MAX_SUMMARY_CHARS) {
    throw new Error(`cell-summarizer: output too long (${summary.length} chars > ${MAX_SUMMARY_CHARS})`)
  }

  auditLogger.info({
    action: 'cell-summarizer.distill',
    requestId: opts.traceId,
    workflowId: opts.workspaceId,
    userId: opts.userId,
    metadata: {
      domain: opts.domain,
      label: opts.label,
      model,
      contentChars: trimmed.length,
      summaryChars: summary.length,
      durationMs: Date.now() - startedAt,
      usage: response.usage
    }
  })

  return summary
}

/**
 * Run summarizer in parallel for every cc-bmc-card node in the array.
 * Replaces `summary` on each node when distillation succeeds; keeps
 * original on failure. Non-cc-bmc-card nodes pass through unchanged.
 *
 * Disabled when BMC_SUMMARIZER_ENABLED=false.
 */
export async function distillSummariesForCells<
  T extends { id: string; type: string; summary?: string; content?: string; domain?: string; label?: string }
>(
  nodes: T[],
  opts: { traceId?: string; workspaceId?: string; userId?: string },
  deps: SummarizerDeps
): Promise<T[]> {
  if (process.env.BMC_SUMMARIZER_ENABLED === 'false') {
    return nodes
  }
  if (!nodes || nodes.length === 0) return nodes

  const tasks = nodes.map(async (node) => {
    if (node.type !== 'cc-bmc-card') return node
    if (!node.content || node.content.trim().length < 40) return node
    try {
      const distilled = await summarizeCellMarkdown(
        node.content,
        {
          domain: node.domain,
          label: node.label,
          traceId: opts.traceId,
          workspaceId: opts.workspaceId,
          userId: opts.userId
        },
        deps
      )
      return { ...node, summary: distilled }
    } catch (err) {
      auditLogger.warn({
        action: 'cell-summarizer.distill-failed',
        requestId: opts.traceId,
        workflowId: opts.workspaceId,
        userId: opts.userId,
        metadata: {
          nodeId: node.id,
          domain: node.domain,
          label: node.label,
          err: err instanceof Error ? err.message : String(err),
          fallback: 'keeping agent original summary'
        }
      })
      return node
    }
  })

  return Promise.all(tasks)
}
