/**
 * Agent-as-a-Judge evaluator (Zhuge et al. 2024 methodology applied to BMC).
 *
 * Reference: arxiv.org/abs/2410.10934 — uses an LLM as the evaluator,
 * with prompted rubrics enforcing structured judgement. We adapt the
 * methodology to score BMC outputs against hand-authored ground truth:
 *
 *   For each (case, runner_bmc_output) pair, ask a JUDGE LLM
 *   to score on a 0-3 rubric per BMC dimension:
 *     0 — empty / off-topic
 *     1 — partially covers must_cover
 *     2 — covers all must_cover, plausible content
 *     3 — covers all must_cover + adds defensible nuance
 *
 *   PLUS dual-LLM consensus: ask GPT-4o AND Claude (if available),
 *   take per-dimension MIN to be conservative. Disagreement >1 point
 *   on any dimension → flag for human review.
 *
 * Stage status: SKELETON. The actual LLM judge call is stubbed —
 * the prompt template + scoring scaffolding are real but `runJudge()`
 * returns a placeholder zero-score until DeepSeek + a separate judge
 * model are wired (Stage J.4).
 *
 * Why ship the skeleton now: lets us iterate on the rubric + dataset
 * shape without committing to a particular judge LLM yet, and lets
 * the benchmark CLI plug in stub scores for end-to-end pipeline
 * testing.
 */

import { BMC_DIMENSION_IDS, type BmcDimensionId } from '../types.js'
import type { YcCompanyCase } from '../corpus/yc-cases/index.js'

// =============================================================================
// Types
// =============================================================================

export interface JudgeRubric {
  /** What the runner produced for this dimension (free-text BMC content). */
  candidate: string
  /** Hand-authored truth for this dimension. */
  ground_truth: string
  must_cover: string[]
  must_not_cover: string[]
}

export interface JudgeScore {
  /** 0-3 integer per the rubric */
  score: 0 | 1 | 2 | 3
  /** brief one-line rationale from the judge */
  rationale: string
  /** which must_cover tokens were detected in candidate */
  covered: string[]
  /** which must_cover tokens were missing */
  missed: string[]
  /** any must_not_cover tokens that did appear (penalty signal) */
  violations: string[]
}

export interface CaseEvaluation {
  case_id: string
  runner: string
  /** per-dimension scores keyed by canonical BMC dimension id */
  perDimension: Partial<Record<BmcDimensionId, JudgeScore>>
  /** sum of all 9 dimension scores, 0-27 */
  total: number
  /** average across non-empty dimensions, 0-3 */
  average: number
  /** dimensions where judge confidence is low and a human should review */
  needs_human_review: BmcDimensionId[]
}

// =============================================================================
// Judge prompt template (copy-pastable into a chat completion)
// =============================================================================

export const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator scoring a Business Model Canvas (BMC) output against hand-authored ground truth.

For each dimension you evaluate, score 0-3:
- 0: candidate is empty, off-topic, or contradicts the company's actual model
- 1: candidate partially covers must_cover concepts, but misses key ones or has plausibility gaps
- 2: covers all must_cover concepts, content is plausible and on-domain
- 3: covers must_cover + adds defensible, non-obvious nuance the ground truth itself omitted

Penalties:
- If candidate mentions any must_not_cover token, cap score at 1
- If candidate is purely generic (e.g. "online users" with no specifics), cap at 1

Output STRICT JSON: {
  "score": 0 | 1 | 2 | 3,
  "rationale": "<one short sentence>",
  "covered": [<must_cover tokens detected>],
  "missed": [<must_cover tokens missing>],
  "violations": [<must_not_cover tokens that appeared>]
}`

export function buildJudgeUserMessage(
  rubric: JudgeRubric,
  dimensionId: BmcDimensionId
): string {
  return `BMC dimension: ${dimensionId}

GROUND_TRUTH (hand-authored):
${rubric.ground_truth}

MUST_COVER (concepts the candidate should mention):
${rubric.must_cover.length > 0 ? rubric.must_cover.map((t) => `- ${t}`).join('\n') : '(none)'}

MUST_NOT_COVER (concepts the candidate should NOT mention):
${rubric.must_not_cover.length > 0 ? rubric.must_not_cover.map((t) => `- ${t}`).join('\n') : '(none)'}

CANDIDATE (the BMC pipeline output for this dimension):
${rubric.candidate}

Score the candidate per the rubric. Respond with the JSON object only.`
}

// =============================================================================
// Heuristic stub — token-overlap fallback used until the LLM judge is wired
// =============================================================================

/**
 * Cheap heuristic that approximates the LLM judge's scoring by pure token
 * overlap. Useful for:
 *   - smoke-testing the eval pipeline without burning judge LLM calls
 *   - pre-screening to decide which cases need an actual LLM judge
 *   - CI / dev environments where no LLM key is available
 */
export function heuristicScore(rubric: JudgeRubric): JudgeScore {
  const candidateLower = rubric.candidate.toLowerCase()
  const covered = rubric.must_cover.filter((t) =>
    candidateLower.includes(t.toLowerCase())
  )
  const missed = rubric.must_cover.filter((t) => !covered.includes(t))
  const violations = rubric.must_not_cover.filter((t) =>
    candidateLower.includes(t.toLowerCase())
  )

  // Penalty: if candidate touches any must_not_cover, cap at 1
  if (violations.length > 0) {
    return {
      score: 1,
      rationale: `mentions must_not_cover token(s): ${violations.join(', ')}`,
      covered,
      missed,
      violations
    }
  }

  if (rubric.must_cover.length === 0) {
    // nothing to cover — score by length + non-emptiness
    const score = candidateLower.trim().length < 10 ? 0 : 2
    return {
      score: score as 0 | 2,
      rationale:
        score === 0
          ? 'candidate is essentially empty'
          : 'no must_cover defined; candidate is non-empty and on-topic',
      covered,
      missed,
      violations: []
    }
  }

  const ratio = covered.length / rubric.must_cover.length
  let score: 0 | 1 | 2 | 3
  let rationale: string
  if (ratio === 0) {
    score = 0
    rationale = 'no must_cover concepts detected'
  } else if (ratio < 0.5) {
    score = 1
    rationale = `covers ${covered.length}/${rubric.must_cover.length} must_cover concepts`
  } else if (ratio < 1) {
    score = 2
    rationale = `covers ${covered.length}/${rubric.must_cover.length} must_cover concepts; plausible`
  } else {
    score = 3
    rationale = 'covers all must_cover concepts'
  }
  return { score, rationale, covered, missed, violations }
}

// =============================================================================
// Dual-judge consensus stub
// =============================================================================

/**
 * Returns the conservative (per-dimension MIN) score across multiple judges
 * + flags dimensions where judges disagreed by ≥2 points (caller should
 * surface these for human review).
 */
export function dualJudgeConsensus(
  scores: JudgeScore[]
): { consensus: JudgeScore; disagreement: number } {
  if (scores.length === 0) {
    throw new Error('dualJudgeConsensus: empty scores array')
  }
  if (scores.length === 1) {
    return { consensus: scores[0], disagreement: 0 }
  }
  const minScore = scores.reduce((a, b) => (a.score <= b.score ? a : b))
  const maxScore = scores.reduce((a, b) => (a.score >= b.score ? a : b))
  return { consensus: minScore, disagreement: maxScore.score - minScore.score }
}

// =============================================================================
// Public API stubs — to be filled in Stage J.4 (real LLM judge)
// =============================================================================

/**
 * Run a judge LLM (DeepSeek + optional second model) on a candidate BMC
 * output for one dimension. Returns the consensus score + disagreement.
 *
 * STUB: currently just calls heuristicScore. Real implementation will
 * fetch judge LLM, parse JSON, run dual-judge consensus.
 *
 * Stage J.4 work:
 *   1. Wire DeepSeek (or GPT-4o + Claude dual) call here
 *   2. Parse JSON response per JudgeScore shape
 *   3. Validate via Zod
 *   4. Apply dualJudgeConsensus()
 *   5. Add latency / cost metrics
 */
export async function runJudge(rubric: JudgeRubric): Promise<JudgeScore> {
  // TODO(stage-j-4): replace with real LLM judge call
  return heuristicScore(rubric)
}

/**
 * Score one whole case (all 9 BMC dimensions). Caller provides:
 *   - the case (with ground_truth_bmc)
 *   - the candidate BMC output keyed by dimension id (free text per cell)
 */
export async function evaluateCase(
  testCase: YcCompanyCase,
  candidate: Partial<Record<BmcDimensionId, string>>,
  runner: string
): Promise<CaseEvaluation> {
  const perDimension: Partial<Record<BmcDimensionId, JudgeScore>> = {}
  let totalScore = 0
  let scoredDimensions = 0
  const needs_human_review: BmcDimensionId[] = []

  for (const dimId of BMC_DIMENSION_IDS) {
    const truth = testCase.ground_truth_bmc[dimId]
    if (!truth) continue
    const candidateText = candidate[dimId] ?? ''
    const score = await runJudge({
      candidate: candidateText,
      ground_truth: truth.ground_truth,
      must_cover: truth.must_cover ?? [],
      must_not_cover: truth.must_not_cover ?? []
    })
    perDimension[dimId] = score
    totalScore += score.score
    scoredDimensions += 1
    // For now (heuristic), no disagreement signal — Stage J.4 will populate.
  }

  return {
    case_id: testCase.case_id,
    runner,
    perDimension,
    total: totalScore,
    average: scoredDimensions > 0 ? totalScore / scoredDimensions : 0,
    needs_human_review
  }
}
