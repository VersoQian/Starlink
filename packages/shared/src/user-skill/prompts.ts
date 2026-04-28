/**
 * User-skill extractor prompts (2026-04-28).
 *
 * Lifts the LLM call shape that `UserSkillExtractor` (server-side) makes
 * against DeepSeek into a shared module so the prompt can be iterated in
 * one place.
 *
 * Pairs with `schemas.ts` (input/output Zod) and `parser.ts` (JSON cleanup).
 */

import type { UserSkillExtractionInput } from './schemas.js'

/**
 * System prompt for the user-skill extraction LLM.
 *
 * English (system role) for stable JSON output across providers; the
 * downstream rendered block is in 中文 because that's what the rest of the
 * coach pipeline operates in.
 *
 * Hard rules in the prompt are deliberately conservative:
 *   - never invent a skill from a single weak signal
 *   - keep titles short
 *   - prefer reinforcing existing skills over creating duplicates
 *   - decay skills only when actively contradicted, not just unmentioned
 */
export const USER_SKILL_SYSTEM_PROMPT = `You analyse a user's recent conversations to extract durable traits ("skills") about them, so a downstream coaching AI can personalise its reflection questions.

You are NOT writing a profile FOR the user; you are abstracting recurring patterns ABOUT the user. Output is consumed by another AI, not shown to the user.

EXTRACTION RULES:
1. NEVER fabricate a trait from one weak signal. A skill needs ≥ 2 distinct conversations or one extremely strong explicit statement ("I'm a backend engineer with 8 years experience").
2. Prefer REINFORCING an existing skill (update confidence +0.1 to +0.2) over creating a near-duplicate.
3. DECAY (suggest removal) only when the user has explicitly contradicted a prior skill. Lack of recent mention is NOT decay-worthy.
4. SCOPE choice:
   - 'user'      → trait that holds across any business idea this user works on
                    (e.g. domain background, communication style, education).
   - 'workspace' → trait specific to ONE idea/workspace (e.g. "this idea
                    targets SMB", "this product is hardware-heavy"). Tag with
                    the workspaceId in evidence.
5. Title MUST be ≤ 24 chars. Content MUST be ≤ 480 chars and describe the
   trait + how the coach should adjust (e.g. "B2B SaaS 资深背景：偏好
   企业销售案例，少用 to-C 类比").
6. confidence ∈ [0, 1]. New skills should start at 0.5–0.7 unless the
   evidence is overwhelming (≥ 0.85).
7. **Title and content MUST be written in 中文 (Simplified Chinese)** to
   match the language of conversation summaries and the downstream coach
   prompts. English in title or content is treated as a malformed output.

8. REFINE (rewrite an existing skill's title/content) when accumulated
   evidence diverges from the stored text. Use refines for course-correction:
   "5y B2B" → after evidence "actually 3y B2B + 2y B2C". Only newTitle and/or
   newContent fields you want to change; null = keep. Always provide \`reason\`.
   Refines are ORTHOGONAL to updates — bump confidence via updates, rewrite
   text via refines.

OUTPUT exactly one JSON object, NO markdown fences:
{
  "creates": [{"scope": "user|workspace", "title": "...", "content": "...",
               "tags": [...], "confidence": 0.x, "importance": 0.x,
               "observedEvidence": ["traceId", ...]}],
  "updates": [{"id": "...", "confidenceDelta": 0.x, "addEvidence": "traceId|null"}],
  "refines": [{"id": "...", "newTitle": "...|null", "newContent": "...|null", "reason": "..."}],
  "decays":  [{"id": "..."}]
}

If nothing meets the threshold, return all-empty arrays. Do NOT pad output.

When multiple DISTINCT durable traits are observable across the summaries
(e.g. domain background + thinking style + a recurring blind spot all
showing up in 2+ conversations each), surface them as separate \`creates\`
entries rather than collapsing into one. Aim for 1-5 creates when evidence
supports them; the goal is coverage of orthogonal traits, not minimalism.`

/**
 * Build the per-extraction user message. Pairs with USER_SKILL_SYSTEM_PROMPT.
 *
 * Renders recent conversation summaries + existing skills into a compact
 * markdown block. Both lists are bounded by the schema limits in
 * UserSkillExtractionInputSchema (≤ 10 summaries, ≤ 20 existing skills).
 */
export function buildUserSkillUserMessage(input: UserSkillExtractionInput): string {
  const summariesBlock = input.recentConversationSummaries.length
    ? input.recentConversationSummaries
        .map(
          (s, i) =>
            `[${i + 1}] traceId=${s.traceId} workspace=${s.workspaceId} (${s.createdAt})\n    ${s.summary.replace(/\n+/g, ' ').slice(0, 400)}`
        )
        .join('\n')
    : '  (no recent conversations)'

  const skillsBlock = input.existingSkills.length
    ? input.existingSkills
        .map(
          (k) =>
            `  - id=${k.id} [${k.scope}] "${k.title}" (conf ${k.confidence.toFixed(2)}, tags ${k.tags.join(',')})\n      ${k.content.slice(0, 200)}`
        )
        .join('\n')
    : '  (none)'

  return `USER: ${input.userId}

RECENT CONVERSATIONS (newest last, summaries):
${summariesBlock}

EXISTING USER-SKILL MEMORIES:
${skillsBlock}

Analyse the deltas. Respond with the JSON object only.`
}

/**
 * Render an array of `UserSkillPayload`-like rows (as fetched from
 * `memory_items` and ranked) into the markdown block injected into coach /
 * wizard / BMC-generator prompts.
 *
 * Returns '' (empty string) if the list is empty; callers should treat ''
 * as "no user-skill section to render" and skip it entirely (no header, no
 * blank line).
 */
export function renderUserSkillBlock(
  skills: Array<{
    title: string
    content: string
    confidence: number
    scope: 'user' | 'workspace'
    tags: string[]
  }>
): string {
  if (!skills.length) return ''
  const lines = skills.map((s) => {
    const scopeTag = s.scope === 'user' ? '全局' : '本 idea'
    return `- **${s.title}** [${scopeTag} · 置信 ${s.confidence.toFixed(2)}] — ${s.content}`
  })
  return lines.join('\n')
}
