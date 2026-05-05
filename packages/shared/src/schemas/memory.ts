import { z } from 'zod'
import { knowledgeEvidenceSchema } from './conversation.js'

export const conversationMessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool'])
export const memoryScopeSchema = z.enum(['workspace', 'user', 'agent'])
/**
 * Memory kinds. The `'user-skill'` kind (added 2026-04-28) carries durable
 * traits about a specific user — domain background, thinking style, blind
 * spots — extracted across conversations by `UserSkillExtractor`. Conventions:
 *
 *   - `kind === 'user-skill'` rows MUST have non-null `userId`
 *   - `scope === 'user'`: `workspace_id` should be null (cross-idea / global)
 *   - `scope === 'workspace'`: both `userId` and `workspaceId` filled (idea-specific)
 *   - `title` ≤ 24 chars (short trait name)
 *   - `content` ≤ 480 chars (descriptive sentence)
 *   - `metadata` carries `{ observedEvidence: string[], lastReinforcedAt: ISO,
 *     confidenceTrend: number[] }`
 */
export const memoryKindSchema = z.enum(['preference', 'decision', 'insight', 'constraint', 'summary', 'canvas', 'user-skill'])

export const conversationSessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  title: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'archived']),
  latestQuestion: z.string().nullable(),
  contextSnapshot: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  // P1: heartbeat-driven session lifecycle. heartbeatAt is updated every
  // 30s by the gateway running the stream; failureReason is populated by
  // the reaper when a stale row is recovered.
  heartbeatAt: z.string().nullable().optional(),
  ownerPid: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional()
})

export const conversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  workspaceId: z.string(),
  userId: z.string().nullable(),
  role: conversationMessageRoleSchema,
  content: z.string(),
  metadata: z.record(z.unknown()),
  createdAt: z.string()
})

export const memoryItemSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string().nullable(),
  scope: memoryScopeSchema,
  kind: memoryKindSchema,
  title: z.string(),
  content: z.string(),
  sourceType: z.string(),
  sourceId: z.string().nullable(),
  importance: z.number(),
  confidence: z.number(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUsedAt: z.string().nullable(),
  archivedAt: z.string().nullable()
})

export const canvasContextSummarySchema = z.object({
  nodeCount: z.number(),
  edgeCount: z.number(),
  highlights: z.array(z.string())
})

export const workspaceContextSnapshotSchema = z.object({
  workspaceId: z.string(),
  conversationId: z.string().nullable(),
  query: z.string(),
  builtAt: z.string(),
  canvasSummary: canvasContextSummarySchema,
  recentMessages: z.array(conversationMessageSchema),
  memories: z.array(memoryItemSchema),
  knowledgeEvidence: z.array(knowledgeEvidenceSchema),
  promptBlock: z.string()
})

export type ConversationMessageRole = z.infer<typeof conversationMessageRoleSchema>
export type MemoryScope = z.infer<typeof memoryScopeSchema>
export type MemoryKind = z.infer<typeof memoryKindSchema>
export type ConversationSession = z.infer<typeof conversationSessionSchema>
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type MemoryItem = z.infer<typeof memoryItemSchema>
export type CanvasContextSummary = z.infer<typeof canvasContextSummarySchema>
export type WorkspaceContextSnapshot = z.infer<typeof workspaceContextSnapshotSchema>
