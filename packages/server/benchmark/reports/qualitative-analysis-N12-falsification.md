# Falsification result · multi-agent's structural advantage was a prompt-engineering artefact

**Date**: 2026-04-28
**Source eval**: `yc-vs-runners-20260428-035240.md` (N=12 × 3 runners)
**Triggered by**: user question "差距这么小是不是应该加强 Agent 的推理链路"
**TL;DR**: a one-line prompt addition to single-LLM (`gpt-solo-forced`)
beats the multi-agent system on 7 of 12 cases by an average of +2.4
points, while running 2.3× faster. The "multi-agent guarantees
structural coverage" claim from the N=8 / N=12 reports is
**conclusively refuted**.

This document supersedes the strong-form claims in
`qualitative-analysis-N8.md` and `qualitative-analysis-N12.md`.

---

## 1. The experiment

### 1.1 Two simultaneous changes

To answer "should we deepen agent reasoning?" we ran two
interventions in the same N=12 sweep:

**A. Blackboard expansion (Starlink-side improvement)**.
The registry-mode invocation of market/product/finance subgraphs
was previously projecting a narrow slice of the BusinessState
(only `traceId / question / roundNumber / knowledgeEvidence`).
Round-2+ agents could not see siblings' outputs or the critic's
feedback. Fixed by `projectBlackboardForGenerator(state, self)`
in `business-langgraph.ts:1483-1543`, plus expanded
`BmcGeneratorState` schema in `bmc-generator-subgraph.ts:44-77`,
to carry `contextPrompt + crossContextPrompt +
supervisorDirectivePrompt + own previous nodes`.

**B. Force-coverage gpt-solo (baseline strengthening)**.
A `forceNineCells` option in `runGptSolo` adds one paragraph to
the prompt: *"你必须输出全部 9 个 CC-BMC 维度，按以下顺序…
任何维度缺失都视为输出无效."* Registered as third runner
`gpt-solo-forced` in `yc-vs-runners.ts`.

If multi-agent's advantage at N=8/N=12 was real architecture
(coverage as an emergent property of role assignment), B should
not close the gap. If it was prompt engineering (single-LLM
silently dropped a cell because the prompt didn't explicitly
demand all 9), B would close it.

### 1.2 Result

| runner | mean total | std (case) | wins | mean KP | mean chars | mean latency |
|---|---|---|---|---|---|---|
| starlink (blackboard-fixed) | 19.3 / 27 | 2.4 | 2 / 12 | 2.00 | 4536 | 29.4s |
| gpt-solo (vanilla) | 19.0 / 27 | 2.3 | 3 / 12 | **0.17** | 754 | 10.1s |
| **gpt-solo-forced** | **21.7 / 27** | 1.5 | **7 / 12** | **2.42** | 1192 | **12.6s** |

`gpt-solo-forced` Pareto-dominates the multi-agent system on
this dataset: higher total score, higher per-cell quality on KP
(the dimension we built multi-agent specifically to cover),
faster, and more concise. **The prompt engineering hypothesis
wins decisively.**

---

## 2. Per-dimension decomposition

| Dim | starlink μ | gpt-solo μ | gpt-solo-forced μ | force vs starlink |
|---|---|---|---|---|
| CUSTOMER_SEGMENTS         | 2.08 | 2.25 | 2.33 | **+0.25** |
| VALUE_PROPOSITIONS        | 2.58 | 2.75 | 2.92 | **+0.34** |
| CHANNELS                  | 2.17 | 2.25 | 2.33 | **+0.16** |
| CUSTOMER_RELATIONSHIPS    | 2.17 | 2.33 | 2.17 | tie |
| REVENUE_STREAMS           | 2.17 | 2.17 | 2.17 | tie |
| KEY_RESOURCES             | 2.33 | 2.42 | **2.67** | **+0.34** |
| KEY_ACTIVITIES            | 1.92 | 2.42 | 2.42 | **+0.50** |
| **KEY_PARTNERSHIPS**      | **2.00** | 0.17 | **2.42** | **+0.42** |
| COST_STRUCTURE            | 1.92 | 2.25 | 2.25 | **+0.33** |
| **Total / 27**            | **19.3** | **19.0** | **21.7** | **+2.4** |

`gpt-solo-forced` wins or ties **all 9 dimensions**, including
the KP dimension that was the entire basis for the N=8 / N=12
"multi-agent guarantees structural coverage" narrative.

The KP win is the most striking: forced single-LLM's KP mean of
2.42 is **higher** than the blackboard-fixed multi-agent's 2.00.
Force-coverage doesn't just close the gap — it overshoots.

---

## 3. Why the blackboard fix didn't help much

We expected the blackboard expansion to lift Starlink's per-cell
content quality (specifically VP and KR, where N=12 found gpt-solo
winning by −0.58 and −0.50 respectively). Comparing Starlink at
N=12 (pre-fix) vs N=12 (post-fix):

| Dim | pre-fix μ | post-fix μ | Δ |
|---|---|---|---|
| VP | 2.33 | 2.58 | +0.25 |
| KR | 2.25 | 2.33 | +0.08 |
| KP | 2.00 | 2.00 | 0 |
| Total | 19.6 | 19.3 | −0.3 |

The fix delivered a small VP improvement that's within run-to-run
judge variance. **It did not close the per-cell quality gap with
gpt-solo, let alone gpt-solo-forced.** Most likely interpretation:
the diversity → consensus loop is not the bottleneck. The
bottleneck is that each generator agent produces only 2-3 cells
per its assigned slice, and the LLM's per-cell output budget
(short, terse cells) is the actual constraint. The full prompt
context lets gpt-solo-forced spend its output budget across all 9
cells with longer, denser content per cell.

The blackboard fix is still the **right architectural choice** —
the previous narrow projection was a real bug, agents *should*
see each other's outputs, and round-2+ deliberation is the
correct mental model. But on a single-shot BMC generation task
where ground truth doesn't strongly require iterative
disagreement-resolution, the deliberation loop simply doesn't
contribute much.

---

## 4. What this means for the paper claim

### The original strong claim (now refuted)

> "Multi-agent assignment guarantees structural coverage of the
> 9-cell canvas in a way that single-LLM JSON-mode does not."

**Status**: **REFUTED at N=12 against gpt-solo-forced.** A
one-paragraph prompt change ("you must output all 9 cells in this
order") fully eliminates the KP=0 pattern AND lifts every other
dimension. The structural property is **not a moat** — it's a
prompt-engineering choice the single-LLM baseline simply hadn't
been given.

### The honest residual claim

What multi-agent *does* still provide on this dataset:

1. **Audit trail**: 10-category handoff log per case showing who
   wrote what when, supervisor decisions, debate turns. Single-LLM
   has none of this. **Useful for compliance / interpretability**,
   not for output quality.
2. **Interrupt + HITL hooks**: critic-detected high-severity
   conflicts can interrupt and request human review. Single-LLM
   has no hook for this.
3. **Round-based revision**: state-graph supervisor can re-invoke
   agents on conflicts. Single-LLM is one-shot.
4. **Per-agent cost / latency budget**: in principle, market-agent
   could use a cheaper model for CS/CH/CR while finance-agent uses
   a stronger one for cost analysis. We don't currently exploit
   this.

None of (1)–(4) are about *quality* of the generated BMC. The
defensible reframing of the architecture is: **multi-agent buys
auditability + extension surface, at the cost of latency and
quality, on a task where structured prompting alone solves the
coverage problem.**

### What multi-agent might still win on (untested)

The tasks where multi-agent does plausibly outperform a strongly-
prompted single LLM:

- **Tool-using generation**: where each agent invokes specialised
  tools (web search, database query, simulation). Single-LLM
  prompting can't substitute for tool execution.
- **Long-horizon iterative refinement**: where ground truth
  *requires* multi-turn disagreement-resolution. CC-BMC at one-shot
  doesn't qualify.
- **Mixed-modality**: where different agents read different input
  formats (text, code, charts). Out of scope here.
- **HITL-integrated**: where humans review and re-route between
  rounds. We have the hooks; we haven't run a HITL-enabled eval.

If the paper wants to keep the multi-agent framing, **the eval
needs to move to one of these task types**. The current
single-shot BMC generation task does not discriminate between
the architectures.

---

## 5. The four cases where Starlink still ties or wins

Two cases gave Starlink a clean win (`yc-pebble-2016` 21–14
vs gpt-solo, 21–21 vs forced; `yc-substack-2024` 20–16 vs solo,
20–19 vs forced). Both share a structural feature worth noting:

- **Pebble** is a shut-down hardware case. The detailed description
  emphasises operational failure modes that may benefit from
  finance-agent's cost-structure focus and critic's conflict
  detection. gpt-solo (vanilla) underperformed badly (14/27).
  Forced solo recovered to 21 (tied with Starlink), but Starlink's
  spread across CR (3), CT (2), KA (2) was richer than forced's.
- **Substack** is a media case where the must_not_cover token
  ('advertising') trips simpler outputs. Starlink's per-agent
  specialisation may make it less likely to violate domain
  constraints. **This is the cleanest "domain expertise"
  argument** for multi-agent and is worth a focused follow-up:
  test on cases with strict must_not_cover constraints (regulated
  industries, sin sectors, etc.) where single-LLM training-data
  memorisation might violate them.

These two cases are **the only paper-worthy multi-agent wins** in
the N=12 dataset.

---

## 6. What to do next (revised priority)

Given the falsification, the implementation roadmap from the prior
analysis (`qualitative-analysis-N12.md` §8) is partially obsolete.
Updated priorities:

1. **Pivot the paper claim**. Drop "multi-agent improves quality"
   entirely. Either (a) reframe as systems paper about the
   handoff-log + HITL + audit-trail surface, or (b) move eval to
   tool-using / long-horizon task types where single-LLM cannot
   compete by prompt engineering alone.
2. **Test multi-agent in tool-using mode**. Wire web-search +
   memory-search + dimension-action tools into market/product/
   finance agents (we have 49 tools registered, none currently
   actively used by generators). Re-run on cases that benefit from
   external lookup. If multi-agent + tools beats gpt-solo-forced,
   the architecture has a real moat.
3. **Skip "deepening agent reasoning"** as a pure-prompting
   exercise. The per-cell quality bottleneck is output budget, not
   reasoning capability — adding a self-reflection step inside
   each agent will make Starlink slower without making it better.
4. **Multi-seed judge** (3 runs per cell, take mean). At N=12 the
   per-case stdev is 1.5–2.4 points — total-score gaps under 1.5
   points are within noise. Multi-seed tightens this.
5. **HITL eval**. The interrupt hooks exist. Build a small
   evaluation where a human reviewer corrects after round 1 and
   the multi-agent re-deliberates. This is a task type where
   single-LLM has no analogue.
6. **Force-coverage as published baseline**. From now on, every
   eval comparison should use `gpt-solo-forced` as the canonical
   single-LLM baseline, not `gpt-solo`. The vanilla version
   undersells what a one-line prompt change can do, and any
   reviewer would point this out.

---

## 7. Limitations

Same as `qualitative-analysis-N12.md` §6: single-judge call,
N=12 too small for stratified inference, RAG path unexercised,
ground truth = our annotations. The falsification is robust to
these because the gap between gpt-solo-forced and Starlink (+2.4
points, 7-of-12 wins) is large relative to the per-case stdev
(1.5 points), and the KP mechanism is mechanistic rather than
aggregate.

A reviewer could fairly demand:
- Multi-seed judge (do this next)
- Confidence intervals via bootstrap (cheap)
- Test on tasks beyond single-shot BMC generation (the real fix)

---

## 8. Reproduction recipe

```sh
pnpm --filter @starlink/server build

DATABASE_URL="postgres://nobody:nobody@127.0.0.1:5432/nodb" \
DEEPSEEK_API_KEY=sk-... LLM_API_KEY=sk-... \
LLM_BASE_URL=https://api.deepseek.com/v1 LLM_MODEL=deepseek-chat \
ORCHESTRATION_MODE=registry HITL_ENABLED=false \
LANGGRAPH_CHECKPOINTER_ENABLED=false \
MEMORY_WRITE_ENABLED=false MEMORY_READ_ENABLED=false \
  node packages/server/dist/benchmark/eval/yc-vs-runners.js \
  --runners=starlink,gpt-solo,gpt-solo-forced
```
