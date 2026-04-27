/**
 * Coach RPC types — request/response schema for /api/ideation/reflect.
 *
 * Stage B contract. Kept locally in apps/web (not in packages/shared) because
 * the route is Next.js-side only — backend GraphQL gateway doesn't see these
 * yet. If/when we promote to GraphQL, copy this file to packages/shared.
 */

import { z } from 'zod'
import { IDEATION_NODE_KINDS } from './ideation-types'

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
    z.object({ type: z.literal('meta-check') })
  ]),
  canvas: z.object({
    /** lightweight node list — content trimmed to 200 chars per node to bound prompt size */
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
    /** per-kind counts (for fast meta reasoning without LLM having to count) */
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
  /** server SHOULD NOT repeat any meta prompt id in this list */
  firedMetaIds: z.array(z.string()).default([])
})

export type ReflectionRequest = z.infer<typeof ReflectionRequestSchema>

export const ReflectionResponseSchema = z.object({
  scaffold: ScaffoldKindSchema,
  /** Markdown-allowed Chinese reflection question; ≤500 chars */
  content: z.string().min(8).max(500),
  /** When the LLM produced a meta-prompt, returns the trigger id so the
   *  client can add it to firedMetaIds and avoid repeats */
  metaIdFired: z.string().nullable().optional(),
  /** transparency: tells the user where the prompt came from */
  source: z.enum(['llm', 'scripted', 'error']),
  /** server-measured wall time in ms (informational) */
  latencyMs: z.number().int().nonnegative().optional()
})

export type ReflectionResponse = z.infer<typeof ReflectionResponseSchema>
