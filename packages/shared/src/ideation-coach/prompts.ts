/**
 * Ideation Coach prompt templates (Wave F.2).
 *
 * The system prompt + user message builder. Identical wording across
 * Next.js REST route and the Apollo GraphQL resolver — single source of
 * truth.
 *
 * Lifted from `apps/web/app/api/ideation/reflect/route.ts` so both
 * runtimes consume the same string. If you tweak the prompt here, both
 * the REST and GraphQL paths see the change.
 */

import type { ReflectionRequest } from './schemas.js'

/**
 * Coach system prompt (Meflex philosophy).
 *
 * Must be in English for stable JSON-mode output across providers.
 * The user-facing answer the LLM produces is in Chinese (zh-CN), but
 * the system instructions live in English to keep DeepSeek's JSON mode
 * stable.
 */
export const COACH_SYSTEM_PROMPT = `You are a Meflex-style entrepreneurship coach for the Starlink Ideation Canvas.

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

/**
 * Build the per-event user message that pairs with COACH_SYSTEM_PROMPT.
 *
 * Includes a snapshot of the canvas (counts + last 20 nodes), what the
 * user just did, recent chat history, and meta dedup hints.
 */
export function buildCoachUserMessage(input: ReflectionRequest): string {
  const { event, canvas, recentChat, firedMetaIds, userSkillBlock } = input

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
        return (
          'CANVAS THRESHOLD reached — produce a META observation about coverage gaps. ' +
          (firedMetaIds.length > 0
            ? `Already fired meta ids (DO NOT repeat themes): ${firedMetaIds.join(', ')}.`
            : '')
        )
    }
  })()

  const chatLines = recentChat.length
    ? recentChat
        .map(
          (m) =>
            `  ${m.role.toUpperCase()}: ${m.content.slice(0, 240).replace(/\n+/g, ' ')}`
        )
        .join('\n')
    : '  (no prior exchange)'

  // Optional user-skill block: when the server has fetched durable traits
  // for this user, they're rendered here so the LLM can calibrate its
  // scaffold-type and word choice. Empty/missing → section omitted entirely
  // so the prompt stays identical to the pre-personalization shape (zero
  // regression risk on first-session users).
  const skillSection = userSkillBlock?.trim()
    ? `\n\n## 用户长期画像（仅供你 calibrate 反思类型 + 用词，不要在回答里复述）\n${userSkillBlock.trim()}`
    : ''

  return `CANVAS:
${canvasSummary}
${nodeList}

EVENT:
${eventLine}${skillSection}

RECENT EXCHANGE (newest last):
${chatLines}

Respond with the JSON object only.`
}
