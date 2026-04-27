# Tier A Benchmark — YC + extended cases

Real-startup benchmark dataset for Starlink's BMC pipeline. Replaces the
synthetic / authored-probe cases under `corpus/cases/` with public,
verifiable startup info + hand-authored ground-truth BMCs.

## Status

- **Tier A**: 5 hand-curated seed cases ✅ (this scaffold)
- **Tier A target**: 30-50 cases stratified by sector + outcome
- **Tier B**: Recruit 3-5 MBA annotators via Prolific → ~50 cases × 3 annotators × 45 min × $20/hr ≈ $2,250. Compute Krippendorff's α inter-annotator agreement.
- **Tier C**: Domain-expert annotated (Wharton/INSEAD/IESE entrepreneurship faculty), IRB-blessed, ~200 cases. Released as CC-BMC-Bench v1.0 on HuggingFace.

## Current cases (5)

| case_id | sector | outcome | notes |
|---|---|---|---|
| `yc-stripe-2024` | fintech | active | Reference "ceiling" — heavily documented |
| `yc-airbnb-2024` | marketplace | public | Two-sided marketplace pattern |
| `yc-replit-2024` | devtools | active | Multi-segment freemium + AI-cost-heavy |
| `yc-pebble-2016` | hardware | shut-down | Negative example — tests outcome-conditioned BMCs |
| `extended-coursera-2024` | edtech | public | NOT YC (extended sector representative) |

## Schema

`yc-company-schema.ts` — Zod schema. Each case has:

- **Provenance**: `case_id`, `company_name`, `yc_batch`, `source_url` (back to public listing), `fetched_at`
- **Public profile**: `one_liner`, `description` (verbatim from source), `website`
- **Hand-curated meta**: `sector`, `outcome`, `stage_at_outcome`, `outcome_year`
- **Ground-truth BMC**: 9-dimension object with `ground_truth` + `must_cover` + `must_not_cover` per cell
- **Annotator meta**: `annotator_id`, `annotation_quality` (`draft` | `reviewed` | `expert-validated`), free-text `notes`

## How to add a case (manual, Tier A)

**Use `_TEMPLATE.ts`**:

1. Copy `_TEMPLATE.ts` to `yc-<company-slug>.ts` (e.g. `yc-doordash-2024.ts`)
2. Replace every `__FILL__` placeholder with real content
3. Pick `case_id`, `company_name`, `yc_batch`, `source_url`
4. Copy `one_liner` + `description` verbatim from the YC profile page
5. Author the `ground_truth_bmc` 9-cell object — 1-2 sentences per cell + 2-5 `must_cover` concept tokens + (optional) 1-3 `must_not_cover`
6. Set `annotator_id` and `annotation_quality: 'draft'`
7. Add the new export to `index.ts` SEED_CASES array
8. Run `pnpm --filter @starlink/server lint` to confirm Zod passes
9. (Optional) Smoke-test: `node packages/server/dist/benchmark/eval/yc-judge-smoke.js --case=yc-<company-slug>-2024`

The template's bottom comment includes a **stratification target** for the next 25 cases — pick a company that fills an underrepresented sector + outcome cell.

## How to add a case (semi-automated, Tier B+ — TODO)

Stage J.4-J.5 work:

1. Build a YC directory scraper (`scripts/scrape-yc-directory.ts`) — fetches one-liner + description + batch + status from public listing
2. Recruit Prolific annotators → distribute `ground_truth_bmc` template + `must_cover` guidelines
3. 3 annotators per case → measure Krippendorff's α
4. Cases with α ≥ 0.6 promoted to `annotation_quality: 'reviewed'`

## Evaluator

The companion `eval/agent-as-judge.ts` consumes these cases. See its file
header for the rubric + LLM judge prompt template.

Current state: heuristic stub (token overlap). Real LLM judge call lands
in Stage J.4.

## Licensing notes

- YC company info is public on `ycombinator.com/companies` — we cite via
  `source_url`, do **not** redistribute YC's content. Each case stores
  only the verbatim public profile + our own annotations.
- Coursera (the extended case) profile sourced from `about.coursera.org`,
  also public.
- Our annotations + scoring scripts are part of this repo (whatever
  license the repo carries).

## How to run an eval

After J.4 (LLM judge wired) and J.5++ (Starlink-vs-baselines runner), three CLIs exist:

```sh
# Build first
pnpm --filter @starlink/server build

# 1. Smoke-test the judge alone (calibration: echo / null / generic)
DEEPSEEK_API_KEY=sk-... \
  node packages/server/dist/benchmark/eval/yc-judge-smoke.js --all

# 2. Real Starlink-vs-baseline comparison on 5 cases
DATABASE_URL="postgres://nobody:nobody@127.0.0.1:5432/nodb" \
DEEPSEEK_API_KEY=sk-... LLM_API_KEY=sk-... \
LLM_BASE_URL=https://api.deepseek.com/v1 LLM_MODEL=deepseek-chat \
ORCHESTRATION_MODE=registry HITL_ENABLED=false \
LANGGRAPH_CHECKPOINTER_ENABLED=false \
  node packages/server/dist/benchmark/eval/yc-vs-runners.js

# 3. Single case for fast iteration
... yc-vs-runners.js --case=yc-stripe-2024 --runners=gpt-solo
```

## J.5++ baseline results (2026-04-27)

First real "Starlink vs single-LLM" measurement on Tier-A YC cases.
Full report: `benchmark/reports/yc-vs-runners-20260427-091117.md`.

| runner | mean total | mean avg | mean output | mean duration |
|---|---|---|---|---|
| **starlink** | 20.4/27 | 2.27 | 4951 chars | 35.3s |
| gpt-solo | 19.8/27 | 2.20 | 808 chars | 11.0s |

Per-case winner:
- gpt-solo: Stripe, Airbnb (well-known, LLM-memorized)
- **starlink**: Replit, Pebble, Coursera (less-public, multi-agent generalises)

Notable systematic finding: **gpt-solo scored 0 on Key Partnerships in 4/5 cases** — single-LLM dropped dimensions in its JSON output. Starlink's multi-agent enforces 9-dim coverage because each generator has assigned dimensions (this is a paper-worthy architectural insight).
