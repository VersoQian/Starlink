/**
 * Ideation Coach service (Wave F.6 + F.7).
 *
 * Server-side caller of the DeepSeek-backed Ideation coach + wizard.
 * Same DeepSeek invocation pattern as the apps/web Next.js routes,
 * but consumed by the GraphQL resolver. Both surfaces share the same
 * prompt + schema via `@starlink/shared/ideation-coach`.
 *
 * On failure (no key, network, parse), falls back to a scripted reply
 * so the GraphQL mutation never throws unrelated errors back at the
 * client. Source-of-output is reported in the response.
 */

import {
  COACH_SYSTEM_PROMPT,
  COACH_SCRIPTED_PIVOT_CONTENT,
  buildCoachUserMessage,
  isCoachMessageRepeat,
  parseCoachReply,
  reflectionFallback,
  shouldScriptCoachPivot,
  type ReflectionRequest,
  type ReflectionResponse,
  type ScaffoldKind,
  WIZARD_SYSTEM_PROMPT,
  buildWizardUserMessage,
  parseWizardReply,
  type WizardStepRequest,
  type WizardStepResponse,
  type WizardStepId,
  type IdeationNodeKind,
  WIZARD_STEP_TO_KIND,
  nextWizardStep
} from '@starlink/shared'

export { reflectionFallback } from '@starlink/shared'

const DEEPSEEK_URL =
  process.env.DEEPSEEK_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.deepseek.com/v1'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? ''
const DEEPSEEK_MODEL = process.env.LLM_MODEL ?? 'deepseek-chat'
const TIMEOUT_MS = 12_000

interface DeepSeekChoice {
  message?: { content?: string | null }
}
interface DeepSeekResp {
  choices?: DeepSeekChoice[]
  error?: { message?: string }
}

async function callDeepSeek<T>(
  systemPrompt: string,
  userPrompt: string,
  parser: (raw: string) => T,
  options: { temperature?: number } = {}
): Promise<T> {
  if (!DEEPSEEK_KEY) {
    throw new Error('DEEPSEEK_API_KEY (or LLM_API_KEY) not configured')
  }
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
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
        temperature: options.temperature ?? 0.7
      }),
      signal: ac.signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const json = (await res.json()) as DeepSeekResp
    if (json.error) throw new Error(`DeepSeek error: ${json.error.message ?? 'unknown'}`)
    const content = json.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('DeepSeek returned empty content')
    return parser(content)
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Generate one reflection for the GraphQL `reflectOnIdeation` mutation.
 */
export async function reflectOnIdeation(
  request: ReflectionRequest
): Promise<ReflectionResponse> {
  const startedAt = Date.now()

  // P10 fix C · short-circuit on repeated user message. If the user just
  // sent essentially the same thing as their previous turn, the Coach
  // should NOT loop back to the same Socratic question — instead gently
  // switch from extraction to organization. Saves an LLM call AND breaks
  // the WHY/WHY loop while keeping the conversation in the default Coach path.
  if (request.event.type === 'user-message') {
    const lastUserMsg = [...request.recentChat].reverse().find((m) => m.role === 'user')
    if (lastUserMsg && isCoachMessageRepeat(lastUserMsg.content, request.event.label)) {
      return {
        scaffold: 'meta',
        content:
          '我注意到你在围绕同一个想法反复确认 — 这说明核心方向开始稳定了。\n\n' +
          '我们可以继续向下拆解。接下来，你更想先确认目标客户、核心价值，还是最小验证方式？',
        source: 'scripted',
        latencyMs: Date.now() - startedAt
      }
    }

    // P15.6 · Short-answer deflection detection. When user sends < 15
    // characters, they're almost certainly not engaging with the question.
    // Skip the LLM call entirely — return a scripted pivot that gently
    // moves to a different topic. Saves cost + latency + guarantees the
    // coach doesn't hammer the same topic with a different scaffold.
    const trimmed = request.event.label.trim()
    if (shouldScriptCoachPivot(trimmed)) {
      return {
        scaffold: 'meta',
        content: COACH_SCRIPTED_PIVOT_CONTENT,
        source: 'scripted',
        latencyMs: Date.now() - startedAt
      }
    }
  }

  try {
    const userPrompt = buildCoachUserMessage(request)
    const reply = await callDeepSeek(
      COACH_SYSTEM_PROMPT,
      userPrompt,
      parseCoachReply,
      { temperature: 0.7 }
    )
    return {
      scaffold: reply.scaffold,
      content: reply.content,
      source: 'llm',
      latencyMs: Date.now() - startedAt
    }
  } catch (err) {
    console.warn('[ideation-coach-service] reflectOnIdeation LLM failed', {
      err: err instanceof Error ? err.message : String(err)
    })
    return reflectionFallback(request, Date.now() - startedAt)
  }
}

// =============================================================================
// Wizard step
// =============================================================================

const WIZARD_FALLBACK_NEXT_Q: Record<string, string> = {
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
  meta: '太好了 — 第一轮已经画完。接下来可以进入 BMC 视图把节点映射到 9 维上看缺口。'
}

function wizardFallback(
  request: WizardStepRequest,
  latencyMs: number
): WizardStepResponse {
  const kind: IdeationNodeKind = WIZARD_STEP_TO_KIND[request.step] ?? 'core-idea'
  const trimmed = request.userAnswer.trim().split('\n')[0]
  const label = trimmed.length > 24 ? `${trimmed.slice(0, 22)}…` : trimmed
  return {
    extracted: { kind, label: label || '未命名', content: request.userAnswer },
    nextQuestion: WIZARD_FALLBACK_NEXT_Q[request.step] ?? '继续描述你的下一个想法。',
    nextStep: nextWizardStep(request.step),
    source: 'error',
    latencyMs
  }
}

/**
 * Process one wizard step for the GraphQL `processIdeationWizardStep`
 * mutation. Force kind to step's expected kind even if LLM hallucinates
 * a different kind.
 */
export async function processIdeationWizardStep(
  request: WizardStepRequest
): Promise<WizardStepResponse> {
  const startedAt = Date.now()

  // Step 'done' short-circuits without an LLM call.
  if (request.step === ('done' as WizardStepId)) {
    return {
      extracted: { kind: 'reflection', label: '已完成', content: request.userAnswer },
      nextQuestion: '✓ 7 步引导已完成。继续在画布上打磨节点。',
      nextStep: 'done',
      source: 'scripted'
    }
  }

  const expectedKind: IdeationNodeKind =
    WIZARD_STEP_TO_KIND[request.step] ?? 'core-idea'
  try {
    const userPrompt = buildWizardUserMessage(request, expectedKind)
    const reply = await callDeepSeek(
      WIZARD_SYSTEM_PROMPT,
      userPrompt,
      parseWizardReply,
      { temperature: 0.6 }
    )
    return {
      extracted: {
        kind: expectedKind, // force — don't trust LLM hallucination
        label: reply.extracted.label || '未命名',
        content: reply.extracted.content || request.userAnswer
      },
      nextQuestion: reply.nextQuestion,
      nextStep: nextWizardStep(request.step),
      source: 'llm',
      latencyMs: Date.now() - startedAt
    }
  } catch (err) {
    console.warn('[ideation-coach-service] processIdeationWizardStep LLM failed', {
      err: err instanceof Error ? err.message : String(err)
    })
    return wizardFallback(request, Date.now() - startedAt)
  }
}
