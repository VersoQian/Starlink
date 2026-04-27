import { NextResponse } from 'next/server'
import {
  WizardStepRequestSchema,
  WizardStepResponseSchema,
  type WizardStepRequest,
  type WizardStepResponse
} from '@/features/ideation/types/wizard-rpc-types'
import type { IdeationNodeKind } from '@/features/ideation/types/ideation-types'

/**
 * POST /api/ideation/wizard-step
 *
 * Wave γ: LLM-augmented wizard. The 7-step flow stays deterministic
 * server-side (step order is fixed for predictability) but each step now:
 *   1. Extracts structured node info from the user's free-text answer
 *      via DeepSeek (kind + concise label + cleaned content)
 *   2. Generates the NEXT question contextualised by the canvas state
 *      so wizard feels like a real coach, not a Mad Libs form
 *
 * Failure mode: if DeepSeek fails (env missing, network, parse), respond
 * with `source: 'error'` and a fallback that:
 *   - uses the user's raw answer as both label (truncated) and content
 *   - returns the scripted next question from a static map
 *
 * The frontend wizard handler is responsible for applying the mutations
 * (add-node + link to previous step's node) — server stays stateless.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEEPSEEK_URL =
  process.env.DEEPSEEK_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.deepseek.com/v1'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? ''
const DEEPSEEK_MODEL = process.env.LLM_MODEL ?? 'deepseek-chat'
const TIMEOUT_MS = 12_000

// =============================================================================
// Step → kind mapping. The wizard step decides what KIND of node we extract.
// =============================================================================

const STEP_TO_KIND: Record<string, IdeationNodeKind> = {
  'core-idea': 'core-idea',
  'customer-pain': 'customer-pain',
  'value-angle': 'value-angle',
  hypothesis: 'hypothesis',
  validation: 'validation-channel',
  revenue: 'revenue',
  risk: 'risk',
  meta: 'reflection'
}

const STEP_ORDER = [
  'core-idea',
  'customer-pain',
  'value-angle',
  'hypothesis',
  'validation',
  'revenue',
  'risk',
  'meta',
  'done'
] as const

function nextStepOf(step: WizardStepRequest['step']): WizardStepRequest['step'] {
  const idx = STEP_ORDER.indexOf(step)
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return 'done'
  return STEP_ORDER[idx + 1]
}

// =============================================================================
// Scripted fallbacks (used when LLM fails / unavailable)
// =============================================================================

const FALLBACK_NEXT_Q: Record<string, string> = {
  'core-idea':
    '记下你的核心想法。**第二个问题**：这个想法解决的是**谁**的什么痛点？什么时候 / 在什么场景下他们会卡住？',
  'customer-pain':
    '客户痛点已挂在核心想法下。**第三个问题**：你的方案对客户的核心价值是什么？为什么是**你**而不是别人来做？',
  'value-angle':
    '价值角度就位 ✓\n\n**第四个问题**：把这个想法变成一条**可证伪**的具体假设：X 类用户在 Y 情境下，会愿意为 Z 付 W 元。',
  hypothesis:
    '关键假设记下了。**第五个问题**：用什么方式 cheap 验证它？大概要花多少时间？多少钱？',
  validation:
    '验证路径有了 ✓\n\n**第六个问题**：商业模式上 — 你打算怎么收钱？谁付钱？付多少？',
  revenue:
    '收入假设记下了。**第七个问题**：什么会让这个想法走不下去？想到一个最大的风险就行。',
  risk:
    '所有 7 步问题问完了。**Meta 反思**：你的画布当前**结构上可能缺**：一手证据、竞品分析、团队盘点。要不要继续加？',
  meta:
    '太好了 — 第一轮已经画完。接下来可以进入 BMC 视图把节点映射到 9 维上看缺口。'
}

function fallbackResponse(
  input: WizardStepRequest,
  latencyMs: number
): WizardStepResponse {
  const kind = STEP_TO_KIND[input.step] ?? 'core-idea'
  const trimmed = input.userAnswer.trim().split('\n')[0]
  const label = trimmed.length > 24 ? `${trimmed.slice(0, 22)}…` : trimmed
  return {
    extracted: { kind, label: label || '未命名', content: input.userAnswer },
    nextQuestion:
      FALLBACK_NEXT_Q[input.step] ?? '继续描述你的下一个想法。',
    nextStep: nextStepOf(input.step),
    source: 'error',
    latencyMs
  }
}

// =============================================================================
// LLM prompt construction
// =============================================================================

const SYSTEM_PROMPT = `You are a Meflex-style entrepreneurship coach guiding a founder through 7-step ideation. The current step ID is provided; you must:

1. EXTRACT a structured node from the user's free-text answer
   - kind: must match the step's expected kind exactly
   - label: a concise <=24 字 (Chinese) title summarizing the answer
   - content: cleaned-up version of the user's answer, removing filler. DO NOT add new content the user didn't say.

2. GENERATE the next AI question, informed by:
   - the current canvas (nodes already on it)
   - the user's just-given answer
   - the next step in the deterministic order
   - Tone: focused, one question, push for specificity. NEVER write content for them, only ask.
   - Length: 1-3 short paragraphs in 中文 (zh-CN). Markdown *emphasis* allowed.

OUTPUT exactly this JSON shape (nothing else):
{
  "extracted": {
    "kind": "<step's expected kind>",
    "label": "<<=24 chars Chinese>",
    "content": "<cleaned user content>"
  },
  "nextQuestion": "<your next question in Chinese, max 600 chars>"
}

Constraints:
- Do NOT include markdown fences in the JSON
- Do NOT generate content for the user that they didn't say
- The 'kind' MUST match what the step expects; never pick a different kind
- If user's answer is empty/garbage, still extract what you can with a placeholder label like "待补充"`

function buildUserMessage(input: WizardStepRequest, expectedKind: IdeationNodeKind): string {
  const canvasSummary = input.canvas.nodes.length
    ? input.canvas.nodes
        .slice(-12)
        .map(
          (n, i) =>
            `  [${i + 1}] ${n.kind} · "${n.label}"${n.content ? ` — ${n.content.slice(0, 120).replace(/\n+/g, ' ')}` : ''}`
        )
        .join('\n')
    : '  (empty)'
  const chatLines = input.recentChat.length
    ? input.recentChat
        .slice(-6)
        .map((m) => `  ${m.role.toUpperCase()}: ${m.content.slice(0, 200).replace(/\n+/g, ' ')}`)
        .join('\n')
    : '  (no prior exchange)'
  const nextStep = nextStepOf(input.step)
  return `CURRENT STEP: ${input.step}
EXPECTED KIND for extraction: ${expectedKind}
NEXT STEP: ${nextStep}

CANVAS (so far):
${canvasSummary}

RECENT EXCHANGE (newest last):
${chatLines}

USER JUST ANSWERED:
${input.userAnswer}

Respond with the JSON object only.`
}

// =============================================================================
// DeepSeek call
// =============================================================================

interface DeepSeekChoice {
  message?: { content?: string | null }
}
interface DeepSeekResp {
  choices?: DeepSeekChoice[]
  error?: { message?: string }
}

async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal
): Promise<{ extracted: { kind: string; label: string; content: string }; nextQuestion: string }> {
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not configured')
  const res = await fetch(`${DEEPSEEK_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6, // a bit lower than coach — wizard wants stability
      max_tokens: 600
    }),
    signal
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as DeepSeekResp
  if (json.error) throw new Error(`DeepSeek error: ${json.error.message ?? 'unknown'}`)
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('DeepSeek returned empty content')

  const stripped = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error(`DeepSeek output is not valid JSON: ${content.slice(0, 120)}`)
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('DeepSeek output is not an object')
  const obj = parsed as {
    extracted?: { kind?: unknown; label?: unknown; content?: unknown }
    nextQuestion?: unknown
  }
  const e = obj.extracted
  if (
    !e ||
    typeof e.kind !== 'string' ||
    typeof e.label !== 'string' ||
    typeof e.content !== 'string' ||
    typeof obj.nextQuestion !== 'string' ||
    obj.nextQuestion.length < 4
  ) {
    throw new Error('DeepSeek output failed shape check')
  }
  return {
    extracted: {
      kind: e.kind,
      label: e.label.slice(0, 60),
      content: e.content.slice(0, 800)
    },
    nextQuestion: obj.nextQuestion.slice(0, 700)
  }
}

// =============================================================================
// Route handler
// =============================================================================

export async function POST(request: Request) {
  const startedAt = Date.now()
  let parsedBody: WizardStepRequest
  try {
    const raw = await request.json()
    parsedBody = WizardStepRequestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid request body', detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    )
  }

  // If we're already at 'done', no LLM call — just acknowledge.
  if (parsedBody.step === 'done') {
    return NextResponse.json<WizardStepResponse>({
      extracted: { kind: 'reflection', label: '已完成', content: parsedBody.userAnswer },
      nextQuestion: '✓ 7 步引导已完成。继续在画布上打磨节点。',
      nextStep: 'done',
      source: 'scripted'
    })
  }

  const expectedKind = STEP_TO_KIND[parsedBody.step] ?? 'core-idea'

  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS)

  try {
    const userPrompt = buildUserMessage(parsedBody, expectedKind)
    const llm = await callDeepSeek(SYSTEM_PROMPT, userPrompt, ac.signal)
    clearTimeout(timeoutId)

    // Force the kind to match the step (don't trust the LLM if it
    // hallucinated a different kind)
    const safeKind = expectedKind

    const response: WizardStepResponse = {
      extracted: {
        kind: safeKind,
        label: llm.extracted.label || '未命名',
        content: llm.extracted.content || parsedBody.userAnswer
      },
      nextQuestion: llm.nextQuestion,
      nextStep: nextStepOf(parsedBody.step),
      source: 'llm',
      latencyMs: Date.now() - startedAt
    }
    return NextResponse.json(WizardStepResponseSchema.parse(response))
  } catch (err) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startedAt
    console.warn('[ideation-wizard-step] LLM failed, falling back', {
      err: err instanceof Error ? err.message : String(err),
      latencyMs
    })
    return NextResponse.json(fallbackResponse(parsedBody, latencyMs))
  }
}
