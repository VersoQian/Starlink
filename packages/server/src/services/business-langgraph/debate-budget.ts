/**
 * Per-trace debate-LLM-call budget + orchestration-mode/ debate-enabled
 * env flag helpers. Extracted from business-langgraph.ts (Stage 4d).
 *
 * Module-scoped `DEBATE_BUDGET` map is intentional — the budget is a
 * process-wide property of an in-flight conversation, not of any single
 * orchestrator instance. Tests that need isolation should call
 * `releaseDebateBudget(traceId)` between cases.
 */

export type OrchestrationMode = 'legacy' | 'registry'

export function getOrchestrationMode(): OrchestrationMode {
  return process.env.ORCHESTRATION_MODE === 'registry' ? 'registry' : 'legacy'
}

export function isDebateEnabled(): boolean {
  return process.env.DEBATE_ENABLED === 'true'
}

/**
 * A2 hardening (2026-04-29): per-trace budget on debate LLM calls.
 *
 * `runDebate` does up to `maxRounds` × 2 turns + 1 judge call per
 * invocation, and `maybeRunDebates` calls it once per (high-severity
 * conflict × related agent). With 3 conflicts × 2 related agents ×
 * (2 rounds × 2 turns + 1 judge) = 30 LLM calls per critic round.
 * Repeated over MAX_ROUNDS supervisor cycles → cost can spike
 * unboundedly for pathological inputs.
 *
 * We budget total debate-related LLM calls per trace (env
 * `MAX_DEBATE_LLM_CALLS_PER_TRACE`, default 10). Once hit, subsequent
 * `runDebate` invocations are skipped + emit a `budget-exceeded`
 * handoff so operators see what was aborted. Conflicts that didn't
 * get debated still go through the regular revision-request path —
 * just without the deliberative back-and-forth.
 */
const DEBATE_BUDGET = new Map<string, { used: number; limit: number }>()

export function getDebateBudgetLimit(): number {
  const raw = Number(process.env.MAX_DEBATE_LLM_CALLS_PER_TRACE ?? '10')
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10
}

export function ensureDebateBudget(traceId: string): { used: number; limit: number } {
  let entry = DEBATE_BUDGET.get(traceId)
  if (!entry) {
    entry = { used: 0, limit: getDebateBudgetLimit() }
    DEBATE_BUDGET.set(traceId, entry)
  }
  return entry
}

export function releaseDebateBudget(traceId: string): void {
  DEBATE_BUDGET.delete(traceId)
}
