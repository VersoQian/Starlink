import { NextResponse } from 'next/server'
import {
  ReflectionRequestSchema,
  ReflectionResponseSchema,
  type ReflectionRequest,
  type ReflectionResponse,
  COACH_SCRIPTED_PIVOT_CONTENT,
  COACH_SYSTEM_PROMPT,
  buildCoachUserMessage,
  isCoachMessageRepeat,
  parseCoachReply,
  reflectionFallback,
  shouldScriptCoachPivot
} from '@starlink/shared'

/**
 * POST /api/ideation/reflect
 *
 * Stage B Coach endpoint — generates a Meflex-style reflection prompt from a
 * canvas snapshot using DeepSeek (chosen for: cost, OpenAI-compatible API,
 * already proven in benchmark runs).
 *
 * Design notes:
 *  - Direct fetch to DeepSeek's OpenAI-compatible endpoint, no SDK. Keeps the
 *    Next.js bundle small and avoids langchain/openai client transitive deps
 *    in the web package.
 *  - JSON mode (`response_format: { type: 'json_object' }`) + Zod parse for
 *    structural safety. If parse fails we fall back to scripted output.
 *  - Hard 12 s server-side timeout via AbortController; matches the frontend
 *    orchestrator's expectation.
 *  - On any LLM failure (env missing, network, 4xx, parse) we return a 200
 *    response with `source: 'error'` and a graceful Chinese message — the
 *    frontend orchestrator falls back to its scripted prompt set.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEEPSEEK_URL =
  process.env.DEEPSEEK_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.deepseek.com/v1'
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? ''
const DEEPSEEK_MODEL = process.env.LLM_MODEL ?? 'deepseek-chat'
const TIMEOUT_MS = 12_000

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
): Promise<{ scaffold: ReflectionResponse['scaffold']; content: string }> {
  if (!DEEPSEEK_KEY) {
    throw new Error('DEEPSEEK_API_KEY (or LLM_API_KEY) not configured')
  }
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
      temperature: 0.7
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

  // Shared parser handles ```json fences + Zod-shape validation.
  return parseCoachReply(content)
}

// =============================================================================
// Route handler
// =============================================================================

export async function POST(request: Request) {
  const startedAt = Date.now()
  let parsedBody: ReflectionRequest
  try {
    const raw = await request.json()
    parsedBody = ReflectionRequestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'invalid request body',
        detail: err instanceof Error ? err.message : String(err)
      },
      { status: 400 }
    )
  }

  // P15.6 · Short-answer deflection detection. When user sends < 15
  // characters, skip the LLM call and return a scripted pivot. Saves cost
  // + latency + guarantees the coach doesn't hammer the same topic.
  if (parsedBody.event.type === 'user-message') {
    const lastUserMsg = [...parsedBody.recentChat].reverse().find((message) => message.role === 'user')
    if (lastUserMsg && isCoachMessageRepeat(lastUserMsg.content, parsedBody.event.label)) {
      return NextResponse.json({
        scaffold: 'meta',
        content:
          '我注意到你在围绕同一个想法反复确认 — 这说明核心方向开始稳定了。\n\n' +
          '我们可以继续向下拆解。接下来，你更想先确认目标客户、核心价值，还是最小验证方式？',
        source: 'scripted',
        latencyMs: Date.now() - startedAt
      } satisfies ReflectionResponse)
    }
    const trimmed = parsedBody.event.label.trim()
    if (shouldScriptCoachPivot(trimmed)) {
      const latencyMs = Date.now() - startedAt
      return NextResponse.json({
        scaffold: 'meta',
        content: COACH_SCRIPTED_PIVOT_CONTENT,
        source: 'scripted',
        latencyMs
      } satisfies ReflectionResponse)
    }
  }

  // 12 s timeout
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS)

  try {
    const userPrompt = buildCoachUserMessage(parsedBody)
    const llm = await callDeepSeek(COACH_SYSTEM_PROMPT, userPrompt, ac.signal)
    clearTimeout(timeoutId)

    const response: ReflectionResponse = {
      scaffold: llm.scaffold,
      content: llm.content,
      source: 'llm',
      latencyMs: Date.now() - startedAt
    }

    // Validate before sending out — also ensures the response shape is stable
    const validated = ReflectionResponseSchema.parse(response)
    return NextResponse.json(validated)
  } catch (err) {
    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startedAt
    const errMsg = err instanceof Error ? err.message : String(err)
    console.warn('[ideation-reflect] LLM call failed, returning fallback', { errMsg, latencyMs })
    const fallback = reflectionFallback(parsedBody, latencyMs)
    return NextResponse.json({ ...fallback, _diagnostic: errMsg })
  }
}
