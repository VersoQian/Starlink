import { z } from 'zod'
import { canvasGraphSchema } from './canvas.js'
import { cardCitationSchema } from './citation.js'

export const conversationStatusSchema = z.enum(['idle', 'running', 'paused', 'failed', 'completed'])
export const seminarPhaseSchema = z.enum(['planning', 'execution', 'review', 'decision'])

export const phaseChangedPayloadSchema = z.object({
  workspaceId: z.string(),
  phase: seminarPhaseSchema,
  reason: z.string().nullable().optional(),
  occurredAt: z.string()
})

export const seminarTurnCompletedPayloadSchema = z.object({
  workspaceId: z.string(),
  phase: seminarPhaseSchema,
  agentId: z.string(),
  agentName: z.string(),
  nodeId: z.string(),
  title: z.string(),
  summary: z.string(),
  occurredAt: z.string()
})

export const seminarDecisionPayloadSchema = z.object({
  workspaceId: z.string(),
  phase: z.literal('decision'),
  decision: z.string(),
  occurredAt: z.string()
})

export const seminarDecisionRequestedPayloadSchema = z.object({
  workspaceId: z.string(),
  phase: z.literal('decision'),
  decision: z.string(),
  occurredAt: z.string()
})

export const knowledgeEvidenceSchema = z.object({
  docId: z.string(),
  snippet: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()).optional()
})

export const conversationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('graph/appended'),
    conversationId: z.string(),
    payload: canvasGraphSchema
  }),
  z.object({
    type: z.literal('graph/diff'),
    conversationId: z.string(),
    payload: z.object({
      nodes: z.array(canvasGraphSchema.shape.nodes.element).optional(),
      edges: z.array(canvasGraphSchema.shape.edges.element).optional(),
      removedNodeIds: z.array(z.string()).optional(),
      removedEdgeIds: z.array(z.string()).optional()
    })
  }),
  z.object({
    type: z.literal('evidence/updated'),
    conversationId: z.string(),
    payload: z.array(knowledgeEvidenceSchema)
  }),
  z.object({
    type: z.literal('card/cited'),
    conversationId: z.string(),
    payload: z.object({
      cardId: z.string(),
      citation: cardCitationSchema,
      groundingRate: z.number()
    })
  }),
  z.object({
    type: z.literal('status'),
    conversationId: z.string(),
    status: conversationStatusSchema,
    message: z.string().optional()
  }),
  z.object({
    type: z.literal('phase.changed'),
    conversationId: z.string(),
    payload: phaseChangedPayloadSchema
  }),
  z.object({
    type: z.literal('seminar.turn.completed'),
    conversationId: z.string(),
    payload: seminarTurnCompletedPayloadSchema
  }),
  z.object({
    type: z.literal('seminar.decision.made'),
    conversationId: z.string(),
    payload: seminarDecisionPayloadSchema
  }),
  z.object({
    type: z.literal('seminar.decision.requested'),
    conversationId: z.string(),
    payload: seminarDecisionRequestedPayloadSchema
  })
])

export const conversationMetadataSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  status: conversationStatusSchema,
  latestQuestion: z.string().optional()
})

export type ConversationStatus = z.infer<typeof conversationStatusSchema>
export type SeminarPhase = z.infer<typeof seminarPhaseSchema>
export type PhaseChangedPayload = z.infer<typeof phaseChangedPayloadSchema>
export type SeminarTurnCompletedPayload = z.infer<typeof seminarTurnCompletedPayloadSchema>
export type SeminarDecisionPayload = z.infer<typeof seminarDecisionPayloadSchema>
export type SeminarDecisionRequestedPayload = z.infer<typeof seminarDecisionRequestedPayloadSchema>
export type ConversationEvent = z.infer<typeof conversationEventSchema>
export type ConversationMetadata = z.infer<typeof conversationMetadataSchema>
export type KnowledgeEvidence = z.infer<typeof knowledgeEvidenceSchema>
