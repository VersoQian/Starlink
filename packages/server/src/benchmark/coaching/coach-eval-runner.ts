/**
 * Coaching-mode benchmark orchestrator (2026-04-28).
 *
 * Runs the full pipeline for one persona:
 *   1. Generate N synthetic conversation summaries (LLM)
 *   2. Seed them into the in-memory store
 *   3. Run UserSkillExtractor against the store (LLM)
 *   4. Read back the user-skill rows
 *   5. Score recall + precision against the persona's GT traits
 *   6. Generate the rendered userSkillBlock via shared renderer
 *   7. A/B compare reflectOnIdeation: with vs without skill block
 *
 * No production code is modified — the extractor + buildUserSkillPrompt
 * + reflectOnIdeation are all real, only the storage backing is swapped.
 */

import {
  type ReflectionRequest,
  type ReflectionResponse,
  renderUserSkillBlock
} from '@starlink/shared'
import type { MemoryItem } from '@starlink/shared'
import { reflectOnIdeation } from '../../services/ideation-coach-service.js'
import type { BenchmarkPersona, PersonaTrait } from './personas.js'
import {
  generateSyntheticSummaries,
  type SyntheticSummary
} from './synthetic-summaries.js'
import { InMemoryConversationMemoryStore } from './in-memory-store.js'
import { UserSkillExtractor } from '../../services/user-skill-extractor.js'
import { LLMClient } from '../../services/llm-client.js'
import type { ConversationMemoryStore } from '../../application/conversation-memory-store.js'

// ============================================================================
// Types
// ============================================================================

export interface TraitRecallEntry {
  trait: PersonaTrait
  /** Best matching skill content + score; null = trait missed. */
  bestMatch: { skillId: string; skillTitle: string; skillContent: string; score: number } | null
  hit: boolean
}

export interface SkillPrecisionEntry {
  skill: { id: string; title: string; content: string; confidence: number }
  /** Mapped GT trait ids; empty array = fabricated / unjustified. */
  matchedTraitIds: string[]
  justified: boolean
}

export interface ABComparison {
  scenario: 'with-skill-block' | 'no-skill-block'
  rawRequest: ReflectionRequest
  response: ReflectionResponse
  /** Lexical sentinels in the response that are present (lower-case match). */
  sentinelHits: string[]
}

export interface PersonaEvalResult {
  persona: BenchmarkPersona
  summaries: SyntheticSummary[]
  extractedSkills: MemoryItem[]
  recall: {
    traits: TraitRecallEntry[]
    fraction: number /* 0..1 */
  }
  precision: {
    skills: SkillPrecisionEntry[]
    fraction: number /* 0..1, 0 if no skills */
  }
  blockRender: {
    block: string
    /** Number of GT keywords that surface in the rendered block. */
    keywordHits: number
    /** Total keywords across all traits. */
    keywordTotal: number
  }
  abCoachComparison: ABComparison[]
  /** Sentinel keywords whose absence in the WITH-block response indicates
   *  personalisation working (the coach skipped a "basic" question because
   *  the skill block already answered it). */
  sentinels: string[]
  errors: string[]
}

// ============================================================================
// Recall / precision scoring (lexical, cheap)
// ============================================================================

function lowerWord(s: string): string {
  return s.toLowerCase().normalize('NFC')
}

function keywordHitCount(text: string, keywords: string[]): number {
  const lower = lowerWord(text)
  return keywords.reduce((acc, kw) => (lower.includes(lowerWord(kw)) ? acc + 1 : acc), 0)
}

function scoreRecall(
  traits: PersonaTrait[],
  skills: MemoryItem[]
): { traits: TraitRecallEntry[]; fraction: number } {
  const entries: TraitRecallEntry[] = traits.map((trait) => {
    let best: TraitRecallEntry['bestMatch'] = null
    for (const s of skills) {
      const hits = keywordHitCount(`${s.title}\n${s.content}`, trait.keywords)
      const score = trait.keywords.length > 0 ? hits / trait.keywords.length : 0
      if (score > 0 && (!best || score > best.score)) {
        best = { skillId: s.id, skillTitle: s.title, skillContent: s.content, score }
      }
    }
    // Threshold: any keyword hit within a single skill row, AND that skill's
    // top-keyword density ≥ 0.25, counts as "extractor surfaced this trait".
    return { trait, bestMatch: best, hit: !!best && best.score >= 0.25 }
  })
  const hits = entries.filter((e) => e.hit).length
  return { traits: entries, fraction: traits.length > 0 ? hits / traits.length : 0 }
}

function scorePrecision(
  traits: PersonaTrait[],
  skills: MemoryItem[]
): { skills: SkillPrecisionEntry[]; fraction: number } {
  const entries: SkillPrecisionEntry[] = skills.map((s) => {
    const matched: string[] = []
    for (const trait of traits) {
      const hits = keywordHitCount(`${s.title}\n${s.content}`, trait.keywords)
      if (hits > 0) matched.push(trait.id)
    }
    return {
      skill: { id: s.id, title: s.title, content: s.content, confidence: s.confidence },
      matchedTraitIds: matched,
      justified: matched.length > 0
    }
  })
  const justified = entries.filter((e) => e.justified).length
  return { skills: entries, fraction: skills.length > 0 ? justified / skills.length : 0 }
}

// ============================================================================
// Block-render quality
// ============================================================================

function scoreBlockRender(
  traits: PersonaTrait[],
  block: string
): { block: string; keywordHits: number; keywordTotal: number } {
  const allKeywords = traits.flatMap((t) => t.keywords)
  const total = allKeywords.length
  let hits = 0
  for (const kw of allKeywords) {
    if (lowerWord(block).includes(lowerWord(kw))) hits++
  }
  return { block, keywordHits: hits, keywordTotal: total }
}

// ============================================================================
// A/B coach comparison
// ============================================================================

/** Sentinels we expect the WITH-block coach to NOT have to ask, since the
 *  user-skill block already conveys the relevant info. Lower-cased lexical
 *  match against the coach `content`. */
const COACH_SENTINELS_BY_PERSONA: Record<string, string[]> = {
  'persona-b2b-saas-pm': ['to-b', 'to-c', 'b2c', '客户类型是', '面向消费者还是', '是 b 端还是 c 端'],
  'persona-indie-hardware': ['你能做硬件吗', '有制造经验吗', '懂 3d 打印吗', '是不是工程出身']
}

function detectSentinelHits(text: string, sentinels: string[]): string[] {
  const lower = lowerWord(text)
  return sentinels.filter((s) => lower.includes(lowerWord(s)))
}

function buildBaselineCoachRequest(persona: BenchmarkPersona): ReflectionRequest {
  // A canvas snapshot deliberately spare so the coach has lots of room to
  // ask basic questions. The persona's traits aren't on the canvas either —
  // only skill injection should change behaviour.
  return {
    event: { type: 'meta-check' },
    canvas: {
      nodes: [
        {
          id: 'core-idea-1',
          kind: 'core-idea',
          label: '核心想法（占位）',
          content: '一个轻量的工具帮一类用户解决一个常见痛点。'
        }
      ],
      edgeCount: 0,
      nodeCountByKind: { 'core-idea': 1 }
    },
    recentChat: [
      { role: 'ai', content: '我们刚开始记录你的核心想法。' },
      { role: 'user', content: '好。' }
    ],
    firedMetaIds: []
  }
}

// ============================================================================
// Driver
// ============================================================================

export async function evaluatePersona(
  persona: BenchmarkPersona,
  options: { llm?: LLMClient } = {}
): Promise<PersonaEvalResult> {
  const errors: string[] = []
  const llm = options.llm ?? new LLMClient()

  // 1. Synthetic summaries
  const summaries = await generateSyntheticSummaries(persona, llm)

  // 2. Seed in-memory store
  const store = new InMemoryConversationMemoryStore()
  const userId = `bench-coaching-${persona.id}`
  for (const s of summaries) {
    store.seedSummary({
      userId,
      workspaceId: s.workspaceId,
      traceId: s.traceId,
      summary: s.summary,
      createdAt: s.createdAt
    })
  }

  // 3. Run extractor — bypass the throttle by calling enough times to
  //    cross EXTRACT_EVERY_N (default 3). We force one real extraction.
  const extractor = new UserSkillExtractor({
    memoryStore: store as unknown as ConversationMemoryStore,
    llm
  })
  // Ensure we actually trigger LLM work regardless of node-process module
  // counter state — call up to 3 times; the third is guaranteed to fire.
  let appliedFinal = 0
  for (let i = 0; i < 3; i++) {
    const applied = await extractor.extractUserSkills({
      userId,
      workspaceId: persona.ideaWorkspaces[0]?.workspaceId ?? 'ws-coaching-default',
      traceId: `bench-coaching-extract-${i}`
    })
    if (applied > 0) {
      appliedFinal = applied
      break
    }
  }
  if (appliedFinal === 0) {
    errors.push('extractor produced 0 changes across 3 attempts — likely LLM/parse failure')
  }

  // 4. Read back skills (across all this user's idea workspaces — extractor
  //    may have written to the workspace it was called against; we want the
  //    full picture).
  const allSkills: MemoryItem[] = []
  for (const ws of persona.ideaWorkspaces) {
    const rows = await store.searchUserSkills(userId, ws.workspaceId, { limit: 50 })
    for (const r of rows) {
      if (!allSkills.some((s) => s.id === r.id)) allSkills.push(r)
    }
  }

  // 5. Recall + precision
  const recall = scoreRecall(persona.traits, allSkills)
  const precision = scorePrecision(persona.traits, allSkills)

  // 6. Render skill block + measure keyword saturation
  const blockInput = allSkills.slice(0, 5).map((s) => ({
    title: s.title,
    content: s.content,
    confidence: s.confidence,
    scope: (s.scope === 'user' ? 'user' : 'workspace') as 'user' | 'workspace',
    tags: s.tags
  }))
  const blockText = renderUserSkillBlock(blockInput)
  const blockRender = scoreBlockRender(persona.traits, blockText)

  // 7. A/B coach comparison
  const sentinels = COACH_SENTINELS_BY_PERSONA[persona.id] ?? []
  const baselineReq = buildBaselineCoachRequest(persona)
  const ab: ABComparison[] = []
  try {
    const noSkillResp = await reflectOnIdeation(baselineReq)
    ab.push({
      scenario: 'no-skill-block',
      rawRequest: baselineReq,
      response: noSkillResp,
      sentinelHits: detectSentinelHits(noSkillResp.content, sentinels)
    })
  } catch (err) {
    errors.push(`coach (no-skill-block) failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    const withSkillReq: ReflectionRequest = { ...baselineReq, userSkillBlock: blockText || undefined }
    const withSkillResp = await reflectOnIdeation(withSkillReq)
    ab.push({
      scenario: 'with-skill-block',
      rawRequest: withSkillReq,
      response: withSkillResp,
      sentinelHits: detectSentinelHits(withSkillResp.content, sentinels)
    })
  } catch (err) {
    errors.push(`coach (with-skill-block) failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    persona,
    summaries,
    extractedSkills: allSkills,
    recall,
    precision,
    blockRender,
    abCoachComparison: ab,
    sentinels,
    errors
  }
}
