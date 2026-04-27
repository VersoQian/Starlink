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

1. Pick a YC company (or extended sector representative)
2. Fetch the public profile page
3. Copy `one_liner` + `description` verbatim
4. Author the `ground_truth_bmc` 9-cell object — 1-2 sentences per cell + 2-5 `must_cover` concept tokens + (optional) 1-3 `must_not_cover`
5. Save as `yc-<company-slug>.ts` in this directory
6. Add to `index.ts` SEED_CASES array
7. Run `pnpm --filter @starlink/server lint` to confirm shape passes Zod

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

## How to run an eval (when J.4 is done)

```sh
# (Forthcoming, after Stage J.4 LLM judge is wired)
pnpm --filter @starlink/server benchmark:eval-tier-a \
  --runner starlink \
  --judge deepseek-chat \
  --cases all
```
