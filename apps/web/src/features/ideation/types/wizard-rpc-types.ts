/**
 * Wizard-step RPC types. Mirrors the coach RPC shape (Zod schema in/out)
 * but with wizard-specific fields:
 *   - `step`: which of the 7 wizard steps we're processing
 *   - `userAnswer`: free-text the user typed in chat
 *   - response carries the EXTRACTED structured node + the next question
 */

import { z } from 'zod'
import { IDEATION_NODE_KINDS } from './ideation-types'

const NodeKindZ = z.enum(IDEATION_NODE_KINDS)

const StepIdZ = z.enum([
  'core-idea',
  'customer-pain',
  'value-angle',
  'hypothesis',
  'validation',
  'revenue',
  'risk',
  'meta',
  'done'
])

export const WizardStepRequestSchema = z.object({
  step: StepIdZ,
  userAnswer: z.string().min(1).max(2000),
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
    edgeCount: z.number().int().nonnegative()
  }),
  recentChat: z
    .array(
      z.object({
        role: z.enum(['ai', 'user']),
        content: z.string()
      })
    )
    .max(8)
})

export type WizardStepRequest = z.infer<typeof WizardStepRequestSchema>

export const WizardStepResponseSchema = z.object({
  /** The structured node the LLM extracted from the user's answer.
   *  `kind` is determined by the step — frontend uses it to compose the
   *  add-node mutation. */
  extracted: z.object({
    kind: NodeKindZ,
    label: z.string().min(1).max(60),
    content: z.string().min(1).max(800)
  }),
  /** The next AI question to display in chat — contextually informed by the
   *  full canvas + recent answers. Markdown allowed for *emphasis*. */
  nextQuestion: z.string().min(8).max(700),
  /** Server may decide to short-circuit to 'done' if user explicitly says
   *  they're finished. Frontend treats this as canonical. */
  nextStep: StepIdZ,
  source: z.enum(['llm', 'scripted', 'error']),
  latencyMs: z.number().int().nonnegative().optional()
})

export type WizardStepResponse = z.infer<typeof WizardStepResponseSchema>
