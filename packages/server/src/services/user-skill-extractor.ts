/**
 * UserSkillExtractor — async LLM-driven extraction of durable user traits
 * from recent conversation summaries (2026-04-28).
 *
 * Triggered fire-and-forget at the tail of `writeConversationSummary` in
 * `business-langgraph.ts`. Reads recent cross-workspace summaries + existing
 * skills for the user, calls DeepSeek with the prompts in
 * `@starlink/shared/user-skill`, applies the parsed result via
 * `ConversationMemoryStore.upsertMemory` / archive helpers.
 *
 * Output shape from the LLM is parsed by `parseUserSkillExtractionReply`:
 *   { creates, updates, refines, decays }
 *
 * Layer-1 self-evolution: `refines` rewrites existing skill title/content
 * and appends the prior text to `metadata.revisionTrend` so the audit
 * trail keeps every revision.
 *
 * Throttling: env `USER_SKILL_EXTRACT_EVERY_N` (default 3) — only every Nth
 * call performs LLM work; intermediate calls return immediately.
 */

import {
  USER_SKILL_SYSTEM_PROMPT,
  buildUserSkillUserMessage,
  parseUserSkillExtractionReplyDetailed,
  type UserSkillExtractionInput,
  createAuditLogger
} from '@starlink/shared'
import { LLMClient } from './llm-client.js'
import type {
  ConversationMemoryStore,
  UpsertMemoryInput
} from '../application/conversation-memory-store.js'

const auditLogger = createAuditLogger('packages/server:services:user-skill-extractor')

interface ExtractParams {
  userId: string
  workspaceId: string
  traceId: string
}

const callCounter = new Map<string, number>()
const EXTRACT_EVERY_N = Math.max(1, Number(process.env.USER_SKILL_EXTRACT_EVERY_N ?? '3'))

export class UserSkillExtractor {
  private readonly llm: LLMClient
  private readonly memoryStore: ConversationMemoryStore

  constructor(args: { memoryStore: ConversationMemoryStore; llm?: LLMClient }) {
    this.memoryStore = args.memoryStore
    this.llm = args.llm ?? new LLMClient()
  }

  /**
   * Fire-and-forget extraction. Caller must wrap in `void` + `.catch()`;
   * this method never throws (errors are logged + swallowed). Returns the
   * count of changes applied (0 if throttled or empty extraction).
   */
  async extractUserSkills(params: ExtractParams): Promise<number> {
    try {
      // Throttle: only every Nth call per user does real work.
      const prev = callCounter.get(params.userId) ?? 0
      callCounter.set(params.userId, prev + 1)
      if ((prev + 1) % EXTRACT_EVERY_N !== 0) {
        return 0
      }

      const summaries = await this.memoryStore.listUserSummaries(params.userId, 5)
      if (summaries.length === 0) {
        return 0
      }
      const existing = await this.memoryStore.searchUserSkills(
        params.userId,
        params.workspaceId,
        { limit: 20 }
      )

      const llmInput: UserSkillExtractionInput = {
        userId: params.userId,
        recentConversationSummaries: summaries.map((m) => ({
          traceId: typeof m.metadata?.traceId === 'string' ? m.metadata.traceId : m.id,
          workspaceId: m.workspaceId,
          summary: m.content,
          createdAt: m.createdAt
        })),
        existingSkills: existing.map((m) => ({
          id: m.id,
          scope: (m.scope === 'user' ? 'user' : 'workspace') as 'user' | 'workspace',
          title: m.title,
          content: m.content,
          confidence: m.confidence,
          tags: m.tags
        }))
      }

      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: USER_SKILL_SYSTEM_PROMPT },
          { role: 'user', content: buildUserSkillUserMessage(llmInput) }
        ],
        temperature: 0.2
      })

      const parseResult = parseUserSkillExtractionReplyDetailed(response.content ?? '')
      if (!parseResult.ok || !parseResult.data) {
        auditLogger.warn({
          action: 'user-skill-extractor.parse-failed',
          userId: params.userId,
          metadata: {
            traceId: params.traceId,
            reason: parseResult.reason,
            issues: parseResult.issues ?? null,
            preview: parseResult.rawPreview ?? (response.content ?? '').slice(0, 200)
          }
        })
        return 0
      }
      const parsed = parseResult.data

      let applied = 0
      // ---- creates ----
      for (const [idx, c] of parsed.creates.entries()) {
        const input: UpsertMemoryInput = {
          workspaceId: c.scope === 'workspace' ? params.workspaceId : params.workspaceId,
          userId: params.userId,
          scope: c.scope,
          kind: 'user-skill',
          title: c.title,
          content: c.content,
          sourceType: 'user-skill-extractor',
          // Differentiate per-create so upsert dedup-by-source doesn't
          // collapse multiple skills from the same extraction pass into
          // one row. Each new skill needs its own row identity.
          sourceId: `${params.traceId}#${idx}`,
          importance: c.importance,
          confidence: c.confidence,
          tags: c.tags,
          metadata: {
            observedEvidence: c.observedEvidence,
            lastReinforcedAt: new Date().toISOString(),
            confidenceTrend: [c.confidence],
            revisionTrend: []
          }
        }
        await this.memoryStore.upsertMemory(input)
        applied++
      }

      // ---- updates: bump confidence + add evidence ----
      for (const u of parsed.updates) {
        const target = existing.find((m) => m.id === u.id)
        if (!target) continue
        const prevConfTrend = Array.isArray(target.metadata?.confidenceTrend)
          ? (target.metadata.confidenceTrend as number[])
          : []
        const evidence = Array.isArray(target.metadata?.observedEvidence)
          ? ([...(target.metadata.observedEvidence as string[])] as string[])
          : []
        if (u.addEvidence && !evidence.includes(u.addEvidence)) {
          evidence.push(u.addEvidence)
        }
        const newConf = clamp01(target.confidence + u.confidenceDelta)
        await this.memoryStore.upsertMemory({
          id: target.id,
          workspaceId: target.workspaceId,
          userId: target.userId,
          scope: target.scope,
          kind: 'user-skill',
          title: target.title,
          content: target.content,
          sourceType: target.sourceType,
          sourceId: target.sourceId,
          importance: target.importance,
          confidence: newConf,
          tags: target.tags,
          metadata: {
            ...target.metadata,
            observedEvidence: evidence.slice(-20),
            lastReinforcedAt: new Date().toISOString(),
            confidenceTrend: [...prevConfTrend, newConf].slice(-10)
          }
        })
        applied++
      }

      // ---- refines (Layer-1 self-evolution): rewrite title/content ----
      for (const r of parsed.refines) {
        const target = existing.find((m) => m.id === r.id)
        if (!target) continue
        const prevTrend = Array.isArray(target.metadata?.revisionTrend)
          ? (target.metadata.revisionTrend as Array<Record<string, unknown>>)
          : []
        const newTitle = r.newTitle ?? target.title
        const newContent = r.newContent ?? target.content
        if (newTitle === target.title && newContent === target.content) continue
        await this.memoryStore.upsertMemory({
          id: target.id,
          workspaceId: target.workspaceId,
          userId: target.userId,
          scope: target.scope,
          kind: 'user-skill',
          title: newTitle,
          content: newContent,
          sourceType: target.sourceType,
          sourceId: target.sourceId,
          importance: target.importance,
          confidence: target.confidence,
          tags: target.tags,
          metadata: {
            ...target.metadata,
            revisionTrend: [
              ...prevTrend,
              {
                from: { title: target.title, content: target.content },
                to: { title: newTitle, content: newContent },
                reason: r.reason,
                at: new Date().toISOString()
              }
            ].slice(-10)
          }
        })
        applied++
      }

      // ---- decays: archive ----
      for (const d of parsed.decays) {
        const target = existing.find((m) => m.id === d.id)
        if (!target) continue
        await this.memoryStore.archiveMemory(target.id)
        applied++
      }

      auditLogger.info({
        action: 'user-skill-extractor.applied',
        userId: params.userId,
        metadata: {
          traceId: params.traceId,
          counts: {
            creates: parsed.creates.length,
            updates: parsed.updates.length,
            refines: parsed.refines.length,
            decays: parsed.decays.length
          }
        }
      })

      return applied
    } catch (error) {
      auditLogger.warn({
        action: 'user-skill-extractor.failed',
        userId: params.userId,
        metadata: {
          traceId: params.traceId,
          message: error instanceof Error ? error.message : String(error)
        }
      })
      return 0
    }
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}
