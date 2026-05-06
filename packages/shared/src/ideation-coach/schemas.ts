/**
 * Ideation Coach RPC schemas — single source of truth across runtimes.
 *
 * Wave F.3: lifted from `apps/web/src/features/ideation/types/coach-rpc-types.ts`.
 * The web file now re-exports from here.
 *
 * IDEATION_NODE_KINDS is duplicated here (it lives in apps/web ideation
 * types currently). When ideation types are themselves promoted to
 * @starlink/shared, the duplication can be removed.
 */

import { z } from 'zod'

export const IDEATION_NODE_KINDS = [
  'core-idea',
  'customer-pain',
  'value-angle',
  'hypothesis',
  'validation-channel',
  'revenue',
  'risk',
  'evidence',
  'reflection'
] as const

export type IdeationNodeKind = (typeof IDEATION_NODE_KINDS)[number]

const ScaffoldKindSchema = z.enum([
  'why',
  'how',
  'so-what',
  'evidence-needed',
  'meta'
])
export type ScaffoldKind = z.infer<typeof ScaffoldKindSchema>

const NodeKindZ = z.enum(IDEATION_NODE_KINDS)

export const ReflectionRequestSchema = z.object({
  event: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('node-added'),
      kind: NodeKindZ,
      label: z.string()
    }),
    z.object({
      type: z.literal('node-linked'),
      fromKind: NodeKindZ,
      toKind: NodeKindZ
    }),
    z.object({ type: z.literal('meta-check') }),
    /**
     * P10 fix · user typed in chat dock (not via canvas drag-drop).
     * Frontend was already sending this type, but schema only allowed
     * the 3 above — Zod silently failed and Coach lost user-message
     * context, falling back to canvas-empty WHY questions.
     */
    z.object({
      type: z.literal('user-message'),
      label: z.string()
    })
  ]),
  canvas: z.object({
    nodes: z
      .array(
        z.object({
          id: z.string(),
          kind: NodeKindZ,
          label: z.string(),
          content: z.string()
        })
      )
      .max(40),
    edgeCount: z.number().int().nonnegative(),
    nodeCountByKind: z.record(z.string(), z.number())
  }),
  recentChat: z
    .array(
      z.object({
        role: z.enum(['ai', 'user']),
        content: z.string()
      })
    )
    .max(8),
  firedMetaIds: z.array(z.string()).default([]),
  /**
   * P10 fix B · last 3 scaffold types the LLM picked. Lets the prompt
   * tell the LLM to AVOID repeating, e.g. ['why','why'] → must pick
   * something other than 'why'. Without this hint the LLM keeps
   * defaulting to 'why' (its statistical happy path).
   */
  priorScaffolds: z.array(z.string()).max(5).optional(),
  /**
   * P10 fix D · how many user messages have been sent in this session.
   * After 4+ messages without canvas progress, the prompt nudges the LLM
   * toward `meta` scaffold + a graduation suggestion (try /wizard or
   * trigger BMC pipeline) instead of more why/how loops.
   */
  userTurnCount: z.number().int().nonnegative().optional(),
  /**
   * Pre-rendered user-skill markdown block (server-fetched). When present,
   * the coach prompt builder injects it as "## 用户长期画像" so the LLM can
   * calibrate its scaffold-type choice + word choice without the coach
   * itself re-querying the memory store. Server is source of truth; client
   * never fills this. See `packages/shared/src/user-skill/prompts.ts`
   * `renderUserSkillBlock` for the format.
   */
  userSkillBlock: z.string().optional()
})

export type ReflectionRequest = z.infer<typeof ReflectionRequestSchema>

export const ReflectionResponseSchema = z.object({
  scaffold: ScaffoldKindSchema,
  content: z.string().min(8).max(500),
  metaIdFired: z.string().nullable().optional(),
  source: z.enum(['llm', 'scripted', 'error']),
  latencyMs: z.number().int().nonnegative().optional()
})

export type ReflectionResponse = z.infer<typeof ReflectionResponseSchema>
