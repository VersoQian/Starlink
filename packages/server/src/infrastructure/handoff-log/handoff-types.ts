/**
 * Phase 3.1 · Inter-Agent Handoff Protocol
 *
 * Every time one agent hands information to another, we emit a Handoff
 * event. The log is the foundation for:
 *   - debate convergence analysis
 *   - benchmark metrics (revision-efficiency, escalation rate)
 *   - paper figure: agent-interaction timeline per case
 */

export type AgentId = string

export type HandoffKind =
  | 'task-assignment'
  | 'generation-output'
  | 'critique'
  | 'revision-request'
  | 'escalation'
  | 'completion'
  | 'debate-turn'
  | 'debate-verdict'
  | 'action-invocation'
  | 'action-result'

export interface HandoffMeta {
  round: number
  threadId: string
  traceId: string
  dimension?: string
}

export interface Handoff {
  t: number
  from: AgentId
  to: AgentId
  kind: HandoffKind
  payload: Record<string, unknown>
  meta: HandoffMeta
}

export interface TaskAssignmentPayload {
  promptVars?: Record<string, unknown>
  overrides?: Record<string, unknown>
  reason: string
  capability?: string
}

export interface GenerationOutputPayload {
  nodeCount: number
  nodeIds: string[]
  tokensUsed?: number
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
}

export interface RevisionRequestPayload {
  conflictId: string
  severity: 'high' | 'medium' | 'low'
  conflictType: string
  summary: string
  suggestedChange?: string
}

export interface DebateTurnPayload {
  speaker: AgentId
  addressee: AgentId
  claimOrRebuttal: 'claim' | 'rebuttal' | 'concession' | 'question'
  targetNodeId?: string
  message: string
  citations?: string[]
}

export interface DebateVerdictPayload {
  convergedAfterRounds: number
  winner: AgentId | 'tie' | 'unresolved'
  reasoning: string
}

export interface ActionInvocationPayload {
  toolName: string
  dimension: string
  args: Record<string, unknown>
}

export interface ActionResultPayload {
  toolName: string
  ok: boolean
  resultSummary: string
  error?: string
}

export interface HandoffLogger {
  record(event: Omit<Handoff, 't'>): void
  dump(): Handoff[]
  subscribe(cb: (h: Handoff) => void): () => void
  clear(): void
  readonly size: number
}
