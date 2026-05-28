/**
 * Composite ablation experiment for the Starlink thesis evaluation.
 *
 * The experiment keeps a single scoring framework for all variants while
 * making different mechanism effects observable:
 *   - normal YC cases exercise BMC coverage and evidence support
 *   - conflict-injected cases exercise cross-cell consistency and repair
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BMC_DIMENSION_IDS,
  type BenchmarkCase,
  type BenchmarkRun,
  type BmcDimensionId
} from '../types.js'
import { loadAllYcCases, type YcCompanyCase } from '../corpus/yc-cases/index.js'
import { runStarlink, type StarlinkRunnerOptions } from '../runners/run-starlink.js'
import type { Handoff } from '../../infrastructure/handoff-log/handoff-types.js'

const SCORE_WEIGHTS = {
  coverage: 0.3,
  evidenceSupport: 0.25,
  consistency: 0.25,
  repairQuality: 0.2
} as const

const CC_BMC_LABEL_TO_ID: Record<string, BmcDimensionId> = {
  客户细分: 'CUSTOMER_SEGMENTS',
  价值主张: 'VALUE_PROPOSITIONS',
  渠道通路: 'CHANNELS',
  客户关系: 'CUSTOMER_RELATIONSHIPS',
  收入来源: 'REVENUE_STREAMS',
  关键业务: 'KEY_ACTIVITIES',
  核心资源: 'KEY_RESOURCES',
  重要合作: 'KEY_PARTNERSHIPS',
  成本结构: 'COST_STRUCTURE'
}

interface RunnerBmcNode {
  domain?: string
  content?: string
  data?: { content?: string; meta?: { domain?: string } }
}

interface ConflictTemplate {
  id: string
  target: string
  /**
   * Natural business assumptions injected into the user-facing case.
   * This must not announce that a conflict exists, otherwise every ablation
   * condition gets the answer in the prompt.
   */
  userFacingAssumptions: string
  /** Hidden answer key used only by the judge. */
  oracleConflict: string
}

interface ExperimentCase {
  caseId: string
  companyName: string
  type: 'normal' | 'conflict'
  baseCaseId: string
  yc: YcCompanyCase
  benchmark: BenchmarkCase
  injectedConflict?: ConflictTemplate
}

interface Condition {
  id: 'full' | 'no-rag' | 'no-critic' | 'no-debate' | 'minimal'
  label: string
  removed: string
  purpose: string
  options: StarlinkRunnerOptions
}

interface CompositeScores {
  coverage: number
  evidenceSupport: number
  consistency: number
  repairQuality: number
  composite: number
}

interface CompositeJudgeOutput extends CompositeScores {
  rationale: string
  detectedConflict?: boolean
  contradictionRemains?: boolean
  unnecessaryRewrite?: boolean
  valid: boolean
  judgeMode: 'llm' | 'heuristic' | 'invalid'
}

interface ResultRow {
  phase?: 'grounding' | 'critic-repair' | 'matrix'
  caseId: string
  baseCaseId: string
  companyName: string
  caseType: 'normal' | 'conflict'
  conflictTarget?: string
  condition: Condition['id']
  removed: string
  durationMs: number
  handoffCount: number
  nodeCount: number
  citationCount: number
  error?: string
  scores: CompositeJudgeOutput
}

interface PlannedRun {
  phase: 'grounding' | 'critic-repair' | 'matrix'
  expCase: ExperimentCase
  condition: Condition
}

interface AggregateRow extends CompositeScores {
  condition: Condition['id']
  removed: string
  cases: number
  deltaComposite?: number
}

const CONDITIONS: Condition[] = [
  {
    id: 'full',
    label: 'Full',
    removed: 'None',
    purpose: 'Complete Starlink pipeline',
    options: { variantTag: 'full' }
  },
  {
    id: 'no-rag',
    label: 'No-RAG',
    removed: 'Retrieval grounding',
    purpose: 'Tests evidence support',
    options: { noRag: true, variantTag: 'no-rag' }
  },
  {
    id: 'no-critic',
    label: 'No-critic',
    removed: 'Critic',
    purpose: 'Tests conflict detection',
    options: { noCritic: true, variantTag: 'no-critic' }
  },
  {
    id: 'no-debate',
    label: 'No-debate',
    removed: 'Limited review loop',
    purpose: 'Tests conflict repair',
    options: { noDebate: true, variantTag: 'no-debate' }
  },
  {
    id: 'minimal',
    label: 'Minimal',
    removed: 'RAG + critic + limited review loop',
    purpose: 'Basic multi-agent generation with coverage check only',
    options: {
      noRag: true,
      noCritic: true,
      noDebate: true,
      variantTag: 'minimal'
    }
  }
]

const CONFLICT_TEMPLATES: ConflictTemplate[] = [
  {
    id: 'customer-channel',
    target: 'Customer-Channel consistency',
    userFacingAssumptions:
      'The startup sells workflow security software to enterprise CIOs and procurement committees. Its current acquisition plan relies on TikTok organic growth, student ambassadors, and creator partnerships. The team has no direct sales motion yet.',
    oracleConflict:
      'Enterprise CIO and procurement-committee buyers conflict with a TikTok/student-ambassador-only acquisition channel and no direct sales motion.'
  },
  {
    id: 'value-revenue',
    target: 'Value-Revenue consistency',
    userFacingAssumptions:
      'The product is positioned as a free open-source developer tool with broad community adoption. The financial plan depends on high-price enterprise subscriptions as the primary revenue stream, but no paid enterprise packaging has been defined.',
    oracleConflict:
      'A free open-source value proposition conflicts with reliance on high-price enterprise subscription revenue when no enterprise packaging is defined.'
  },
  {
    id: 'activity-resource',
    target: 'Activity-Resource consistency',
    userFacingAssumptions:
      'The roadmap depends on frequent large-model training and proprietary recommendation models. The founding team is non-technical, has no proprietary dataset, and has not secured cloud compute credits or ML infrastructure.',
    oracleConflict:
      'Heavy AI training as a key activity conflicts with the lack of technical team, proprietary data, and compute resources.'
  },
  {
    id: 'cost-revenue',
    target: 'Cost-Revenue consistency',
    userFacingAssumptions:
      'Customer onboarding requires high-touch consulting, custom implementation, and ongoing account support. The only planned revenue source is low-margin advertising, with no subscription or service fee.',
    oracleConflict:
      'High-touch consulting and implementation costs conflict with a low-margin advertising-only revenue model.'
  },
  {
    id: 'partnership-risk',
    target: 'Partnership-Risk consistency',
    userFacingAssumptions:
      'The product depends on access to hospital records and clinical workflow data. The current partnership plan lists only generic startup communities and cloud vendors, with no hospital, data-provider, or healthcare compliance partner.',
    oracleConflict:
      'Hospital-data dependency conflicts with the absence of hospital, data-provider, or healthcare compliance partnerships.'
  },
  {
    id: 'customer-relationship',
    target: 'Customer-Relationship consistency',
    userFacingAssumptions:
      'The company sells to large enterprise buyers with security review, procurement approval, and multi-stakeholder evaluation. The planned customer relationship model is fully self-service with no sales, implementation, or account support.',
    oracleConflict:
      'Large enterprise procurement conflicts with a fully self-service relationship model and no sales or account support.'
  }
]

function ycToBenchmarkCase(yc: YcCompanyCase): BenchmarkCase {
  const dimensions: BenchmarkCase['expected_output']['dimensions'] = {}
  for (const dim of BMC_DIMENSION_IDS) {
    const truth = yc.ground_truth_bmc[dim]
    if (!truth) continue
    dimensions[dim] = {
      must_cover: truth.must_cover ?? [],
      must_not_cover: truth.must_not_cover ?? []
    }
  }

  return {
    case_id: yc.case_id,
    domain: yc.sector,
    region: 'global',
    source: {
      kind: 'business-case',
      citation: `${yc.company_name} (${yc.yc_batch}) — ${yc.source_url}`
    },
    input: {
      question: `请为以下创业项目生成完整的 CC-BMC 商业模型画布（覆盖 9 个维度）：

公司：${yc.company_name}
一句话定位：${yc.one_liner}

详细描述：
${yc.description}

行业：${yc.sector}`,
      workspace_knowledge: yc.workspace_knowledge ?? [],
      constraints: []
    },
    expected_output: {
      dimensions,
      consistency_checks: []
    }
  }
}

function injectConflict(yc: YcCompanyCase, conflict: ConflictTemplate): YcCompanyCase {
  return {
    ...yc,
    case_id: `${yc.case_id}-conflict-${conflict.id}`,
    description: `${yc.description}

Additional operating assumptions:
${conflict.userFacingAssumptions}`,
    notes: `${yc.notes ?? ''}

Hidden ablation oracle (${conflict.target}): ${conflict.oracleConflict}`
  }
}

function nodesToCandidate(
  nodes: unknown[]
): Partial<Record<BmcDimensionId, string>> {
  const buckets: Partial<Record<BmcDimensionId, string[]>> = {}
  for (const raw of nodes) {
    const n = raw as RunnerBmcNode
    const label = n.domain ?? n.data?.meta?.domain
    const content = n.content ?? n.data?.content
    if (!label || !content) continue
    const id = CC_BMC_LABEL_TO_ID[label]
    if (!id) continue
    const arr = buckets[id] ?? []
    arr.push(content)
    buckets[id] = arr
  }

  const out: Partial<Record<BmcDimensionId, string>> = {}
  for (const [id, contents] of Object.entries(buckets)) {
    if (contents.length > 0) out[id as BmcDimensionId] = contents.join('\n')
  }
  return out
}

function candidateToText(candidate: Partial<Record<BmcDimensionId, string>>): string {
  return BMC_DIMENSION_IDS.map((dim) => {
    const text = candidate[dim]?.trim()
    if (!text) return `## ${dim}\n(empty)`
    return `## ${dim}\n${text}`
  }).join('\n\n')
}

function collectCitationCount(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') {
    const refMatches = value.match(/\[\[ref:[^\]]+\]\]/g) ?? []
    const bracketMatches = value.match(/\[[A-Za-z0-9_-]+#[A-Za-z0-9_-]+\]/g) ?? []
    return refMatches.length + bracketMatches.length
  }
  if (Array.isArray(value)) {
    return value.reduce((acc, item) => acc + collectCitationCount(item), 0)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    let total = 0
    for (const [key, nested] of Object.entries(obj)) {
      if ((key === 'citations' || key === 'evidenceRefs') && Array.isArray(nested)) {
        total += nested.length
        continue
      }
      total += collectCitationCount(nested)
    }
    return total
  }
  return 0
}

function clampScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.min(5, num))
}

function composite(scores: Omit<CompositeScores, 'composite'>): number {
  return (
    scores.coverage * SCORE_WEIGHTS.coverage +
    scores.evidenceSupport * SCORE_WEIGHTS.evidenceSupport +
    scores.consistency * SCORE_WEIGHTS.consistency +
    scores.repairQuality * SCORE_WEIGHTS.repairQuality
  )
}

function invalidJudge(reason: string): CompositeJudgeOutput {
  return {
    coverage: 0,
    evidenceSupport: 0,
    consistency: 0,
    repairQuality: 0,
    composite: 0,
    rationale: reason,
    valid: false,
    judgeMode: 'invalid'
  }
}

function heuristicJudge(
  expCase: ExperimentCase,
  run: BenchmarkRun,
  candidate: Partial<Record<BmcDimensionId, string>>,
  citationCount: number
): CompositeJudgeOutput {
  const presentDims = BMC_DIMENSION_IDS.filter((dim) => (candidate[dim] ?? '').trim().length > 0)
  const coverage = (presentDims.length / BMC_DIMENSION_IDS.length) * 5
  const hasKb = (expCase.benchmark.input.workspace_knowledge ?? []).length > 0
  const evidenceSupport = hasKb
    ? Math.min(5, citationCount / Math.max(1, presentDims.length) * 5)
    : Math.min(5, presentDims.length > 0 ? 3 : 0)
  const outputText = candidateToText(candidate).toLowerCase()
  const conflictWords = expCase.injectedConflict?.oracleConflict
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 5) ?? []
  const conflictMentioned = conflictWords.some((word) => outputText.includes(word))
  const consistency = expCase.type === 'conflict'
    ? conflictMentioned ? 3 : 2
    : presentDims.length === BMC_DIMENSION_IDS.length ? 4 : 3
  const repairQuality = expCase.type === 'conflict'
    ? conflictMentioned ? 3 : 2
    : run.error ? 1 : 4

  const scores = {
    coverage,
    evidenceSupport,
    consistency,
    repairQuality
  }
  return {
    ...scores,
    composite: composite(scores),
    rationale: 'Heuristic fallback based on dimension presence, citation count, and simple conflict-term checks.',
    detectedConflict: expCase.type === 'conflict' ? conflictMentioned : undefined,
    contradictionRemains: undefined,
    unnecessaryRewrite: undefined,
    valid: true,
    judgeMode: 'heuristic'
  }
}

const COMPOSITE_JUDGE_SYSTEM_PROMPT = `You are evaluating outputs from a Business Model Canvas generation system.

Score the output on four 0-5 dimensions:
- Coverage: whether the nine BMC dimensions and expected must-cover concepts are present.
- Evidence Support: whether important claims are connected to relevant citations or source passages. Penalize unsupported factual claims when knowledge sources are available.
- Consistency: whether final canvas cells contradict one another. For hidden conflict cases, compare the final canvas against the hidden oracle conflict. Do not penalize an output merely because a process note mentions that a conflict was detected.
- Repair Quality: whether the process evidence shows targeted conflict detection and repair, and whether the final canvas reflects that repair without unnecessary rewriting. For hidden conflict cases, if the final canvas is coherent but there is no critic/revision/debate process evidence, consistency may still be high but repair quality should not exceed 3.0. For normal cases with no hidden conflict, score whether the output remains stable, coherent, and faithful to the input.

Use integers or one-decimal numbers from 0 to 5. Be strict but fair. The composite score is calculated outside the judge.

Output STRICT JSON:
{
  "coverage": 0-5,
  "evidenceSupport": 0-5,
  "consistency": 0-5,
  "repairQuality": 0-5,
  "rationale": "short explanation",
  "detectedConflict": true|false|null,
  "contradictionRemains": true|false|null,
  "unnecessaryRewrite": true|false|null
}`

function getRunHandoffs(run: BenchmarkRun): Handoff[] {
  return ((run.output as BenchmarkRun['output'] & { handoffs?: Handoff[] }).handoffs ?? [])
}

function summarizePayload(payload: Record<string, unknown>, keys: string[]): string {
  const parts: string[] = []
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${key}: ${value.trim().replace(/\s+/g, ' ').slice(0, 260)}`)
    }
  }
  return parts.join('; ')
}

function buildRepairProcessEvidence(run: BenchmarkRun): string {
  const handoffs = getRunHandoffs(run)
  if (handoffs.length === 0) return '(no process evidence captured)'

  const lines: string[] = []
  const revisionRequests = handoffs.filter((h) => h.kind === 'revision-request')
  const critiques = handoffs.filter((h) => h.kind === 'critique')
  const debateTurns = handoffs.filter((h) => h.kind === 'debate-turn')
  const debateVerdicts = handoffs.filter((h) => h.kind === 'debate-verdict')

  lines.push(`handoffCount=${handoffs.length}`)
  lines.push(`revisionRequests=${revisionRequests.length}; critiques=${critiques.length}; debateTurns=${debateTurns.length}; debateVerdicts=${debateVerdicts.length}`)

  for (const h of revisionRequests.slice(0, 6)) {
    const summary = summarizePayload(h.payload, ['conflictType', 'summary', 'suggestedChange'])
    lines.push(`revision-request ${h.from}->${h.to}: ${summary || JSON.stringify(h.payload).slice(0, 260)}`)
  }
  for (const h of critiques.slice(0, 4)) {
    const summary = summarizePayload(h.payload, ['summary', 'suggestedChange', 'message'])
    lines.push(`critique ${h.from}->${h.to}: ${summary || JSON.stringify(h.payload).slice(0, 260)}`)
  }
  for (const h of debateVerdicts.slice(0, 3)) {
    const summary = summarizePayload(h.payload, ['reasoning', 'winner'])
    lines.push(`debate-verdict ${h.from}->${h.to}: ${summary || JSON.stringify(h.payload).slice(0, 260)}`)
  }
  for (const h of debateTurns.slice(0, 3)) {
    const summary = summarizePayload(h.payload, ['message', 'claimOrRebuttal'])
    lines.push(`debate-turn ${h.from}->${h.to}: ${summary || JSON.stringify(h.payload).slice(0, 220)}`)
  }

  return lines.join('\n')
}

function buildCompositeJudgeUserMessage(
  expCase: ExperimentCase,
  condition: Condition,
  candidate: Partial<Record<BmcDimensionId, string>>,
  citationCount: number,
  run: BenchmarkRun
): string {
  const truth = BMC_DIMENSION_IDS.map((dim) => {
    const d = expCase.yc.ground_truth_bmc[dim]
    return `- ${dim}: ${d.ground_truth} Must cover: ${(d.must_cover ?? []).join(', ') || '(none)'}`
  }).join('\n')

  return `Case type: ${expCase.type}
Base case: ${expCase.baseCaseId}
Company: ${expCase.companyName}
Condition: ${condition.label}
Removed components: ${condition.removed}
Knowledge documents available: ${(expCase.benchmark.input.workspace_knowledge ?? []).length}
Observed citation/reference count in output: ${citationCount}

Hidden oracle conflict for evaluation only:
${expCase.injectedConflict ? `${expCase.injectedConflict.target}: ${expCase.injectedConflict.oracleConflict}` : '(none)'}

Important: the hidden oracle conflict was NOT shown to the candidate system. The candidate only saw the natural input prompt below.

Input prompt:
${expCase.benchmark.input.question}

Ground-truth BMC expectations:
${truth}

Candidate BMC output:
${candidateToText(candidate)}

Repair process evidence:
${buildRepairProcessEvidence(run)}

Score the candidate under the composite ablation rubric. Return JSON only.`
}

async function callCompositeJudge(
  expCase: ExperimentCase,
  condition: Condition,
  run: BenchmarkRun,
  candidate: Partial<Record<BmcDimensionId, string>>,
  citationCount: number,
  judgeMode: 'llm' | 'heuristic'
): Promise<CompositeJudgeOutput> {
  if (judgeMode === 'heuristic') {
    return heuristicJudge(expCase, run, candidate, citationCount)
  }

  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? ''
  if (!apiKey) {
    return invalidJudge('LLM judge unavailable: missing DEEPSEEK_API_KEY or LLM_API_KEY.')
  }
  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/+$/, '')
  const model = process.env.JUDGE_MODEL ?? process.env.LLM_MODEL ?? 'deepseek-chat'
  const userContent = buildCompositeJudgeUserMessage(expCase, condition, candidate, citationCount, run)
  let lastError = 'unknown judge failure'

  for (let attempt = 1; attempt <= 3; attempt++) {
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 30_000)
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: COMPOSITE_JUDGE_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${userContent}\n\nJudge attempt: ${attempt} of 3. Return valid JSON only.`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0
        }),
        signal: ac.signal
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Composite judge HTTP ${res.status}: ${text.slice(0, 240)}`)
      }
      const json = await res.json() as {
        choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
        error?: { message?: string }
      }
      if (json.error) throw new Error(json.error.message ?? 'judge error')
      const finishReason = json.choices?.[0]?.finish_reason
      const content = json.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error(`empty judge response (finish_reason=${finishReason ?? 'none'})`)
      }
      if (finishReason === 'length') {
        console.error(`[composite-judge] WARN: finish_reason=length on attempt ${attempt} — output may be truncated`)
      }
      // Robust JSON extraction
      const stripped = content.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
      const start = stripped.indexOf('{')
      const end = stripped.lastIndexOf('}')
      let jsonText = start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped
      // Repair: fix trailing commas before } or ]
      jsonText = jsonText.replace(/,\s*([}\]])/g, '$1')
      // Repair: fix unescaped newlines inside string values (common with long rationales)
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(jsonText) as Record<string, unknown>
      } catch (parseErr) {
        // Last resort: try to extract individual fields via regex
        function extractField(key: string): number | null {
          const m = jsonText.match(new RegExp(`"${key}"\\s*:\\s*(\\d+\\.?\\d*)`))
          return m ? Number(m[1]) : null
        }
        const rationaleMatch = jsonText.match(/"rationale"\s*:\s*"([^"]*)"/)
        const extractedScores = {
          coverage: extractField('coverage'),
          evidenceSupport: extractField('evidenceSupport'),
          consistency: extractField('consistency'),
          repairQuality: extractField('repairQuality')
        }
        if (extractedScores.coverage !== null && extractedScores.evidenceSupport !== null &&
            extractedScores.consistency !== null && extractedScores.repairQuality !== null) {
          console.error(`[composite-judge] JSON parse failed, but extracted fields via regex on attempt ${attempt}`)
          parsed = {
            ...extractedScores,
            rationale: rationaleMatch?.[1] ?? 'Rationale extraction failed.',
            detectedConflict: null,
            contradictionRemains: null,
            unnecessaryRewrite: null
          }
        } else {
          throw new Error(`JSON parse failed and regex extraction insufficient: ${(parseErr as Error).message.slice(0, 120)}`)
        }
      }
      const scores = {
        coverage: clampScore(parsed.coverage),
        evidenceSupport: clampScore(parsed.evidenceSupport),
        consistency: clampScore(parsed.consistency),
        repairQuality: clampScore(parsed.repairQuality)
      }
      return {
        ...scores,
        composite: composite(scores),
        rationale: typeof parsed.rationale === 'string'
          ? parsed.rationale.slice(0, 500)
          : 'No rationale returned.',
        detectedConflict: typeof parsed.detectedConflict === 'boolean'
          ? parsed.detectedConflict
          : undefined,
        contradictionRemains: typeof parsed.contradictionRemains === 'boolean'
          ? parsed.contradictionRemains
          : undefined,
        unnecessaryRewrite: typeof parsed.unnecessaryRewrite === 'boolean'
          ? parsed.unnecessaryRewrite
          : undefined,
        valid: true,
        judgeMode: 'llm'
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    } finally {
      clearTimeout(timeout)
    }
  }

  return invalidJudge(`LLM judge failed after 3 attempts: ${lastError.slice(0, 180)}`)
}

function parseIntArg(args: string[], name: string, fallback: number): number {
  const raw = args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseListArg(args: string[], name: string): string[] | null {
  const raw = args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1]
  if (!raw) return null
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

function parseStringArg(args: string[], name: string): string | null {
  return args.find((arg) => arg.startsWith(`${name}=`))?.split('=')[1] ?? null
}

function buildExperimentCases(args: string[]): ExperimentCase[] {
  const all = loadAllYcCases()
  const selectedCaseIds = parseListArg(args, '--case')
  const selected = selectedCaseIds
    ? all.filter((yc) => selectedCaseIds.includes(yc.case_id))
    : all
  if (selected.length === 0) {
    throw new Error(`No matching cases. Available: ${all.map((c) => c.case_id).join(', ')}`)
  }

  const preferKb = [...selected].sort((a, b) =>
    (b.workspace_knowledge?.length ?? 0) - (a.workspace_knowledge?.length ?? 0)
  )
  const normalCount = parseIntArg(args, '--normal-count', args.includes('--all') ? preferKb.length : 2)
  const conflictCount = parseIntArg(args, '--conflict-count', args.includes('--all') ? 6 : 2)
  const normalOffset = parseIntArg(args, '--normal-offset', 0)
  const conflictOffset = parseIntArg(args, '--conflict-offset', 0)
  const normalBases = preferKb.slice(normalOffset, normalOffset + normalCount)
  const conflictBases = preferKb.length > 0 ? preferKb : selected

  const normalCases: ExperimentCase[] = normalBases.map((yc) => ({
    caseId: yc.case_id,
    companyName: yc.company_name,
    type: 'normal',
    baseCaseId: yc.case_id,
    yc,
    benchmark: ycToBenchmarkCase(yc)
  }))

  const conflictCases: ExperimentCase[] = []
  for (let i = 0; i < conflictCount; i++) {
    const index = i + conflictOffset
    const base = conflictBases[index % conflictBases.length]
    const conflict = CONFLICT_TEMPLATES[index % CONFLICT_TEMPLATES.length]
    const injected = injectConflict(base, conflict)
    conflictCases.push({
      caseId: injected.case_id,
      companyName: injected.company_name,
      type: 'conflict',
      baseCaseId: base.case_id,
      yc: injected,
      benchmark: ycToBenchmarkCase(injected),
      injectedConflict: conflict
    })
  }

  return [...normalCases, ...conflictCases]
}

function buildConditions(args: string[]): Condition[] {
  const requested = parseListArg(args, '--conditions')
  if (!requested) return CONDITIONS
  const requestedSet = new Set(requested)
  const conditions = CONDITIONS.filter((condition) => requestedSet.has(condition.id))
  if (conditions.length === 0) {
    throw new Error(`No valid conditions requested. Valid: ${CONDITIONS.map((c) => c.id).join(', ')}`)
  }
  return conditions
}

function buildExecutionPlan(
  args: string[],
  cases: ExperimentCase[],
  conditions: Condition[]
): { profile: 'matrix' | 'stable'; plannedRuns: PlannedRun[]; conditions: Condition[] } {
  const profile = parseStringArg(args, '--profile') === 'stable' ? 'stable' : 'matrix'
  if (profile === 'matrix') {
    return {
      profile,
      conditions,
      plannedRuns: cases.flatMap((expCase) =>
        conditions.map((condition) => ({ phase: 'matrix' as const, expCase, condition }))
      )
    }
  }

  const byId = new Map(CONDITIONS.map((condition) => [condition.id, condition]))
  const requiredIds: Condition['id'][] = ['full', 'no-rag', 'no-critic', 'no-debate', 'minimal']
  const missing = requiredIds.filter((id) => !byId.has(id))
  if (missing.length > 0) throw new Error(`Missing built-in conditions: ${missing.join(', ')}`)

  const normalCases = cases.filter((c) => c.type === 'normal')
  const conflictCases = cases.filter((c) => c.type === 'conflict')
  const plannedRuns: PlannedRun[] = []

  for (const expCase of normalCases) {
    plannedRuns.push({ phase: 'grounding', expCase, condition: byId.get('full')! })
    plannedRuns.push({ phase: 'grounding', expCase, condition: byId.get('no-rag')! })
    plannedRuns.push({ phase: 'grounding', expCase, condition: byId.get('minimal')! })
  }
  for (const expCase of conflictCases) {
    plannedRuns.push({ phase: 'critic-repair', expCase, condition: byId.get('full')! })
    plannedRuns.push({ phase: 'critic-repair', expCase, condition: byId.get('no-critic')! })
    plannedRuns.push({ phase: 'critic-repair', expCase, condition: byId.get('no-debate')! })
    plannedRuns.push({ phase: 'critic-repair', expCase, condition: byId.get('minimal')! })
  }

  const usedIds = new Set(plannedRuns.map((run) => run.condition.id))
  return {
    profile,
    plannedRuns,
    conditions: CONDITIONS.filter((condition) => usedIds.has(condition.id))
  }
}

function presentDimensionCount(candidate: Partial<Record<BmcDimensionId, string>>): number {
  return BMC_DIMENSION_IDS.filter((dim) => (candidate[dim] ?? '').trim().length > 0).length
}

function aggregate(rows: ResultRow[], phase?: ResultRow['phase']): AggregateRow[] {
  const byCondition = new Map<Condition['id'], ResultRow[]>()
  for (const row of rows.filter((r) => r.scores.valid !== false && (!phase || r.phase === phase))) {
    byCondition.set(row.condition, [...(byCondition.get(row.condition) ?? []), row])
  }

  const aggregates = [...byCondition.entries()].map(([condition, conditionRows]) => {
    const avg = (key: keyof CompositeScores): number =>
      conditionRows.reduce((acc, row) => acc + row.scores[key], 0) / conditionRows.length
    const meta = CONDITIONS.find((c) => c.id === condition)
    return {
      condition,
      removed: meta?.removed ?? '',
      cases: conditionRows.length,
      coverage: avg('coverage'),
      evidenceSupport: avg('evidenceSupport'),
      consistency: avg('consistency'),
      repairQuality: avg('repairQuality'),
      composite: avg('composite')
    }
  })

  const full = aggregates.find((row) => row.condition === 'full')?.composite
  return aggregates.map((row) => ({
    ...row,
    deltaComposite: full === undefined ? undefined : row.composite - full
  }))
}

function fmt(value: number | undefined): string {
  if (value === undefined) return '—'
  const signed = value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
  return signed === '-0.00' ? '0.00' : signed
}

function renderReport(rows: ResultRow[], cases: ExperimentCase[], conditions: Condition[]): string {
  const aggregates = aggregate(rows)
  const invalidCount = rows.filter((row) => row.scores.valid === false).length
  const phases = [...new Set(rows.map((row) => row.phase).filter((p): p is NonNullable<ResultRow['phase']> => Boolean(p)))]
  const lines: string[] = []
  lines.push('# Composite Ablation Experiment')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Cases: ${cases.length} (${cases.filter((c) => c.type === 'normal').length} normal, ${cases.filter((c) => c.type === 'conflict').length} conflict-injected)`)
  lines.push(`Conditions: ${conditions.map((c) => c.id).join(', ')}`)
  lines.push(`Scoring: Composite = 0.30 × Coverage + 0.25 × Evidence Support + 0.25 × Consistency + 0.20 × Repair Quality`)
  lines.push(`Invalid judge rows excluded from aggregate: ${invalidCount}`)
  lines.push('')
  lines.push('## Condition Definitions')
  lines.push('')
  lines.push('| condition | removed components | purpose |')
  lines.push('| --- | --- | --- |')
  for (const condition of conditions) {
    lines.push(`| ${condition.label} | ${condition.removed} | ${condition.purpose} |`)
  }
  lines.push('')
  lines.push('## Mechanism Attribution')
  lines.push('')
  lines.push('| mechanism removed | expected affected subscore | reason |')
  lines.push('| --- | --- | --- |')
  lines.push('| Retrieval grounding | Evidence Support, partly Coverage | External material and citation paths are unavailable. |')
  lines.push('| Critic | Consistency | Cross-cell conflicts are less likely to be detected. |')
  lines.push('| Limited review loop | Repair Quality | Detected conflicts receive less adversarial review and repair. |')
  lines.push('| All three | Evidence, Consistency, Repair | The system keeps basic multi-agent generation and coverage check only. |')
  lines.push('')
  lines.push('## Aggregate Results')
  lines.push('')
  lines.push('| condition | cases | coverage | evidence | consistency | repair | composite | Δ from full |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const row of aggregates) {
    lines.push(`| ${row.condition} | ${row.cases} | ${row.coverage.toFixed(2)} | ${row.evidenceSupport.toFixed(2)} | ${row.consistency.toFixed(2)} | ${row.repairQuality.toFixed(2)} | ${row.composite.toFixed(2)} | ${fmt(row.deltaComposite)} |`)
  }
  if (phases.length > 1 || (phases.length === 1 && phases[0] !== 'matrix')) {
    lines.push('')
    lines.push('## Phase Results')
    lines.push('')
    lines.push('| phase | condition | cases | coverage | evidence | consistency | repair | composite | Δ from phase full |')
    lines.push('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
    for (const phase of phases) {
      for (const row of aggregate(rows, phase)) {
        lines.push(`| ${phase} | ${row.condition} | ${row.cases} | ${row.coverage.toFixed(2)} | ${row.evidenceSupport.toFixed(2)} | ${row.consistency.toFixed(2)} | ${row.repairQuality.toFixed(2)} | ${row.composite.toFixed(2)} | ${fmt(row.deltaComposite)} |`)
      }
    }
  }
  lines.push('')
  lines.push('## Per-Case Results')
  lines.push('')
  lines.push('| phase | case | type | condition | citations | coverage | evidence | consistency | repair | composite | notes |')
  lines.push('| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
  for (const row of rows) {
    const flags = [
      row.error ? `error: ${row.error.slice(0, 60)}` : null,
      row.caseType === 'conflict' && row.scores.detectedConflict !== undefined
        ? `detected=${row.scores.detectedConflict}`
        : null,
      row.caseType === 'conflict' && row.scores.contradictionRemains !== undefined
        ? `remains=${row.scores.contradictionRemains}`
        : null,
      row.scores.valid === false ? 'invalid-judge' : null,
      row.scores.judgeMode === 'heuristic' ? 'heuristic' : null
    ].filter((item): item is string => Boolean(item))
    lines.push(`| ${row.phase ?? 'matrix'} | ${row.caseId} | ${row.caseType} | ${row.condition} | ${row.citationCount} | ${row.scores.coverage.toFixed(2)} | ${row.scores.evidenceSupport.toFixed(2)} | ${row.scores.consistency.toFixed(2)} | ${row.scores.repairQuality.toFixed(2)} | ${row.scores.composite.toFixed(2)} | ${flags.join('; ') || '—'} |`)
  }
  lines.push('')
  lines.push('## Judge Rationales')
  lines.push('')
  for (const row of rows) {
    lines.push(`### ${row.caseId} · ${row.condition} · ${row.scores.composite.toFixed(2)}`)
    lines.push('')
    lines.push(row.scores.rationale)
    lines.push('')
  }
  lines.push('## Notes')
  lines.push('')
  lines.push('- The composite score is for compact comparison; the four subscores are more useful for mechanism attribution.')
  lines.push('- Results should be interpreted as exploratory unless the case count and reviewer agreement are expanded.')
  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const judgeArg = parseListArg(args, '--judge')?.[0]
  const judgeMode: 'llm' | 'heuristic' =
    judgeArg === 'heuristic' || process.env.COMPOSITE_JUDGE_MODE === 'heuristic'
      ? 'heuristic'
      : 'llm'
  const cases = buildExperimentCases(args)
  const requestedConditions = buildConditions(args)
  const plan = buildExecutionPlan(args, cases, requestedConditions)
  const conditions = plan.conditions
  const rows: ResultRow[] = []
  const minDims = parseIntArg(args, '--min-dims', 8)
  const maxRunAttempts = Math.max(1, parseIntArg(args, '--max-run-attempts', 2))
  const concurrency = Math.max(1, parseIntArg(args, '--concurrency', 3))
  const resumePath = parseStringArg(args, '--resume')

  // Resume from partial checkpoint
  const completedKeys = new Set<string>()
  if (resumePath) {
    try {
      const raw = readFileSync(resumePath, 'utf-8')
      const partial = JSON.parse(raw) as { rows?: ResultRow[] }
      if (partial.rows) {
        for (const row of partial.rows) {
          rows.push(row)
          completedKeys.add(`${row.caseId}:${row.condition}`)
        }
        console.error(`[composite-ablation] resumed ${rows.length} completed row(s) from ${resumePath}`)
      }
    } catch (err) {
      console.error(`[composite-ablation] could not read resume file: ${(err as Error).message}`)
    }
  }

  const reportDir = join(dirname(fileURLToPath(import.meta.url)), '../../../benchmark/reports')
  mkdirSync(reportDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const mdPath = join(reportDir, `composite-ablation-${stamp}.md`)
  const jsonPath = join(reportDir, `composite-ablation-${stamp}.json`)
  const partialPath = join(reportDir, `composite-ablation-${stamp}.partial.json`)

  const writePartial = (): void => {
    writeFileSync(
      partialPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          profile: plan.profile,
          status: 'partial',
          minDims,
          maxRunAttempts,
          weights: SCORE_WEIGHTS,
          cases: cases.map((c) => ({
            caseId: c.caseId,
            baseCaseId: c.baseCaseId,
            type: c.type,
            companyName: c.companyName,
            conflict: c.injectedConflict
          })),
          conditions,
          aggregate: aggregate(rows),
          rows
        },
        null,
        2
      )
    )
  }

  console.error(`[composite-ablation] profile=${plan.profile}; ${plan.plannedRuns.length} planned Starlink run(s)`)
  console.error(`[composite-ablation] judge=${judgeMode}; default smoke is 2 normal + 2 conflict cases unless --all or counts are provided`)
  console.error(`[composite-ablation] quality gate: minDims=${minDims}, maxRunAttempts=${maxRunAttempts}`)
  console.error(`[composite-ablation] partial checkpoint: ${partialPath}`)
  console.error('')

  const executeSingleRun = async (plannedRun: PlannedRun): Promise<ResultRow> => {
    const { phase, expCase, condition } = plannedRun
    console.error(`  · ${condition.id} [start]`)

    let run: BenchmarkRun | null = null
    let candidate: Partial<Record<BmcDimensionId, string>> = {}
    let dims = 0
    for (let attempt = 1; attempt <= maxRunAttempts; attempt++) {
      run = await runStarlink(expCase.benchmark, condition.options)
      candidate = nodesToCandidate(run.output.bmc_nodes)
      dims = presentDimensionCount(candidate)
      if (!run.error && dims >= minDims) break
      if (attempt < maxRunAttempts) {
        console.error(`    retry=${attempt + 1}/${maxRunAttempts} after incomplete run (dims=${dims}/9, error=${run.error ?? 'none'})`)
      }
    }
    if (!run) throw new Error('Starlink run was not executed')

    const citationCount = collectCitationCount(run.output.bmc_nodes)
    const scores = await callCompositeJudge(
      expCase,
      condition,
      run,
      candidate,
      citationCount,
      judgeMode
    )
    console.error(`    score=${scores.composite.toFixed(2)} coverage=${scores.coverage.toFixed(1)} evidence=${scores.evidenceSupport.toFixed(1)} consistency=${scores.consistency.toFixed(1)} repair=${scores.repairQuality.toFixed(1)} dims=${dims}/9${scores.valid === false ? ' invalid-judge' : ''}`)
    return {
      phase,
      caseId: expCase.caseId,
      baseCaseId: expCase.baseCaseId,
      companyName: expCase.companyName,
      caseType: expCase.type,
      conflictTarget: expCase.injectedConflict?.target,
      condition: condition.id,
      removed: condition.removed,
      durationMs: run.duration_ms,
      handoffCount: run.output.handoff_count,
      nodeCount: run.output.bmc_nodes.length,
      citationCount,
      error: run.error ?? (dims < minDims ? `quality-gate: only ${dims}/9 dimensions after ${maxRunAttempts} attempt(s)` : undefined),
      scores
    }
  }

  // Group by case for readable console output
  let previousCaseKey = ''
  for (const plannedRun of plan.plannedRuns) {
    const { phase, expCase } = plannedRun
    const caseKey = `${phase}:${expCase.caseId}`
    if (caseKey !== previousCaseKey) {
      console.error(`[case] ${expCase.caseId} (${phase} · ${expCase.type}${expCase.injectedConflict ? ` · ${expCase.injectedConflict.target}` : ''})`)
      previousCaseKey = caseKey
    }
  }

  // Filter out already-completed runs (from --resume)
  const remaining = plan.plannedRuns.filter((pr) => !completedKeys.has(`${pr.expCase.caseId}:${pr.condition.id}`))
  const skippedCount = plan.plannedRuns.length - remaining.length
  if (skippedCount > 0) {
    console.error(`[composite-ablation] skipped ${skippedCount} already-completed run(s)`)
  }

  // Concurrent execution with bounded pool
  let cursor = 0
  const running = new Set<Promise<void>>()
  for (const plannedRun of remaining) {
    const p = executeSingleRun(plannedRun).then((row) => {
      rows.push(row)
      writePartial()
      running.delete(p)
    })
    running.add(p)
    cursor++
    if (running.size >= concurrency) {
      await Promise.race(running)
    }
  }
  await Promise.all(running)

  writeFileSync(mdPath, renderReport(rows, cases, conditions))
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        profile: plan.profile,
        status: 'complete',
        minDims,
        maxRunAttempts,
        weights: SCORE_WEIGHTS,
        cases: cases.map((c) => ({
          caseId: c.caseId,
          baseCaseId: c.baseCaseId,
          type: c.type,
          companyName: c.companyName,
          conflict: c.injectedConflict
        })),
        conditions,
        aggregate: aggregate(rows),
        rows
      },
      null,
      2
    )
  )
  console.error(`[composite-ablation] wrote ${mdPath}`)
  console.error(`[composite-ablation] wrote ${jsonPath}`)
}

main().catch((err) => {
  console.error('[composite-ablation] failed')
  console.error(err)
  process.exit(1)
})
