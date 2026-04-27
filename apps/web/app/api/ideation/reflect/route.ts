import { NextResponse } from 'next/server'
import {
  ReflectionRequestSchema,
  ReflectionResponseSchema,
  type ReflectionRequest,
  type ReflectionResponse,
  type ScaffoldKind
} from '@/features/ideation/types/coach-rpc-types'

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
// Prompt construction
// =============================================================================

const SYSTEM_PROMPT = `You are a Meflex-style entrepreneurship coach for the Starlink Ideation Canvas.

CRITICAL ROLE BOUNDARIES (Luo et al. 2026):
1. You ASK ONE focused reflection question. You NEVER write content for the user.
2. You scaffold the user's thinking; you DO NOT replace it.
3. You DO NOT propose specific node content, copy, or answers.
4. Output is in 中文 (zh-CN), 1–3 short paragraphs, Markdown allowed for *emphasis*.

PICK ONE SCAFFOLD KIND for each response:
- "why"             — challenge the user's reasoning / surface assumptions
- "how"             — push them on cheap validation / mechanics
- "so-what"         — surface implications / falsifiability / consequences
- "evidence-needed" — flag missing first-hand evidence
- "meta"            — cross-node observation about coverage gaps

IDEATION_NODE_KIND vocabulary (you'll see these in the canvas snapshot):
core-idea, customer-pain, value-angle, hypothesis, validation-channel, revenue, risk, evidence, reflection.

OUTPUT: a JSON object exactly like:
  { "scaffold": "<one of the 5 kinds>", "content": "<your question, 1-3 short paragraphs>" }

Constraints:
- content is at most 480 chars (~200 汉字)
- one focused question, not a list
- Chinese only`

function buildUserMessage(input: ReflectionRequest): string {
  const { event, canvas, recentChat, firedMetaIds } = input

  const canvasSummary = (() => {
    const counts = canvas.nodeCountByKind
    const kindBreakdown = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}:${n}`)
      .join(', ')
    return `${canvas.nodes.length} nodes (${kindBreakdown || 'empty'}), ${canvas.edgeCount} links.`
  })()

  const nodeList = canvas.nodes.length
    ? canvas.nodes
        .slice(0, 20)
        .map(
          (n, i) =>
            `  [${i + 1}] ${n.kind} · "${n.label}"${
              n.content ? ` — ${n.content.slice(0, 160).replace(/\n+/g, ' ')}` : ''
            }`
        )
        .join('\n')
    : '  (no nodes yet)'

  const eventLine = (() => {
    switch (event.type) {
      case 'node-added':
        return `Just ADDED a "${event.kind}" node labeled "${event.label}".`
      case 'node-linked':
        return `Just LINKED a "${event.fromKind}" node → "${event.toKind}" node.`
      case 'meta-check':
        return 'CANVAS THRESHOLD reached — produce a META observation about coverage gaps. ' +
          (firedMetaIds.length > 0
            ? `Already fired meta ids (DO NOT repeat themes): ${firedMetaIds.join(', ')}.`
            : '')
    }
  })()

  const chatLines = recentChat.length
    ? recentChat
        .map((m) => `  ${m.role.toUpperCase()}: ${m.content.slice(0, 240).replace(/\n+/g, ' ')}`)
        .join('\n')
    : '  (no prior exchange)'

  return `CANVAS:
${canvasSummary}
${nodeList}

EVENT:
${eventLine}

RECENT EXCHANGE (newest last):
${chatLines}

Respond with the JSON object only.`
}

// =============================================================================
// Fallback (graceful degradation when LLM is unavailable)
// =============================================================================

function fallbackReflection(input: ReflectionRequest, latencyMs: number): ReflectionResponse {
  // Mirrors a tiny subset of features/ideation/conversation/coach-engine.ts
  // KIND_PROMPTS so the user still gets a useful question. Full local
  // engine runs on the FRONTEND fallback path; this server-side fallback is
  // only used when the orchestrator forgot to handle a 5xx.
  const fallbackByEvent: Record<string, { content: string; scaffold: ScaffoldKind }> = {
    'node-added': {
      scaffold: 'why',
      content:
        '记下这个节点了 ✓\n\n你打算怎么解释它和你已有节点的关系？尝试用一句话写清"为什么"。'
    },
    'node-linked': {
      scaffold: 'why',
      content: '你把两个节点连起来了 — 这条连线代表"导致"、"支撑"还是"包含"？'
    },
    'meta-check': {
      scaffold: 'meta',
      content:
        '你的画布到了一个节点 — 退一步看：当前最薄弱的环节是什么？哪个节点你最不确定？'
    }
  }
  const f = fallbackByEvent[input.event.type] ?? fallbackByEvent['node-added']
  return {
    ...f,
    source: 'error',
    latencyMs
  }
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
): Promise<{ scaffold: ScaffoldKind; content: string }> {
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
      temperature: 0.7,
      max_tokens: 400
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

  // Best-effort JSON parse — some models wrap in ```json fences
  const stripped = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    throw new Error(`DeepSeek output is not valid JSON: ${content.slice(0, 120)}`)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('DeepSeek output is not an object')
  }
  const obj = parsed as { scaffold?: unknown; content?: unknown }
  if (
    typeof obj.scaffold !== 'string' ||
    !['why', 'how', 'so-what', 'evidence-needed', 'meta'].includes(obj.scaffold) ||
    typeof obj.content !== 'string' ||
    obj.content.length < 8
  ) {
    throw new Error('DeepSeek output failed shape check')
  }
  return {
    scaffold: obj.scaffold as ScaffoldKind,
    content: obj.content.slice(0, 500)
  }
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

  // 12 s timeout
  const ac = new AbortController()
  const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS)

  try {
    const userPrompt = buildUserMessage(parsedBody)
    const llm = await callDeepSeek(SYSTEM_PROMPT, userPrompt, ac.signal)
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
    const fallback = fallbackReflection(parsedBody, latencyMs)
    return NextResponse.json({ ...fallback, _diagnostic: errMsg })
  }
}
