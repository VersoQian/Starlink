# Qualitative analysis · Starlink vs gpt-solo on Tier-A YC cases (N=12)

**Date**: 2026-04-28
**Source eval**: `yc-vs-runners-20260428-015915.md`
**Judge**: DeepSeek `deepseek-chat` with Agent-as-a-Judge prompt (Zhuge et al. 2024), 0–3 rubric per BMC dimension
**Cost**: ~ ¥0.45 / full N=12 run, 216 dim-level judge calls + 24 runner outputs

This document accompanies the N=12 headline numbers and does what
the N=8 analysis could not yet do at scale: **decompose the per-dim
mechanism of the gap with enough resolution to commit to a paper
claim**.

---

## 1. Headline numbers

| metric | N=8 (older) | **N=12 (new)** | direction |
|---|---|---|---|
| Starlink mean | 20.3 / 27 | **19.6 / 27** | ↓ 0.7 |
| gpt-solo mean | 18.4 / 27 | **19.1 / 27** | ↑ 0.7 |
| gap | +1.9 | **+0.5** | shrunk by 75% |
| Starlink win-rate | 7 / 8 (88%) | **7 / 12 (58%)** | down |
| gpt-solo's KP=0 rate | 8 / 8 | **12 / 12** | persists |

**The headline shrunk; the structural finding hardened.** The 1.9-point
gap at N=8 was partly driven by a few large-margin Starlink wins
(Coursera +4, Stripe +5) that did not survive the addition of 4 more
cases. At N=12 the gap is **+0.5 points (1.8% of the 27-point ceiling),
which is well within judge-LLM single-run variance** — a reviewer is
correct to be skeptical of the headline win.

The architectural claim survives in a different form: **gpt-solo's
KEY_PARTNERSHIPS score is 0 in 12 of 12 cases**, not because of
content failure but because the single-call JSON output structurally
omits the cell. This is the only mechanically reliable advantage of
multi-agent assignment over single-LLM in this evaluation.

---

## 2. Per-dimension decomposition

Recomputing per-dim means across the 12 cases:

| Dim | Starlink μ | gpt-solo μ | Δ (S − solo) | who wins |
|---|---|---|---|---|
| CUSTOMER_SEGMENTS (CS)       | 2.08 | 2.33 | **−0.25** | gpt-solo |
| VALUE_PROPOSITIONS (VP)      | 2.33 | 2.92 | **−0.58** | **gpt-solo** |
| CHANNELS (CH)                | 2.17 | 2.25 | −0.08 | tie |
| CUSTOMER_RELATIONSHIPS (CR)  | 2.08 | 2.17 | −0.08 | tie |
| REVENUE_STREAMS (RS)         | 2.33 | 2.25 | +0.08 | tie |
| KEY_RESOURCES (KR)           | 2.25 | 2.75 | **−0.50** | **gpt-solo** |
| KEY_ACTIVITIES (KA)          | 1.92 | 2.08 | −0.17 | gpt-solo |
| **KEY_PARTNERSHIPS (KP)**    | **2.00** | **0.00** | **+2.00** | **starlink** |
| COST_STRUCTURE (CT)          | 2.42 | 2.33 | +0.08 | tie |
| **Total / 27**               | **19.6** | **19.1** | **+0.5** |  |

**Reading**:
- **gpt-solo wins or ties 8 of 9 dimensions** (CS, VP, CH, CR, KR, KA + ties CR, CT).
- **Starlink wins 1 dimension**: KEY_PARTNERSHIPS, by exactly the magnitude its structural assignment guarantees (mean 2.0 vs hard zero).
- The single-cell KP advantage (+2.00 per case) more than offsets the per-cell content losses, but only by the smallest possible margin (+0.5 net).

Two of the per-cell losses are large enough to call out:

- **VP −0.58** — gpt-solo's value-proposition cells score 2.92 vs Starlink's 2.33. This is consistent across cases, not driven by outliers. Reading the rationales: gpt-solo writes denser, more specific VP statements (e.g. for Stripe: "developer-first APIs, transparent pricing, global infrastructure, fraud protection out of the box, vs Starlink's "developer experience, API, global"). Multi-agent splits the BMC across generators and Starlink's product-agent gets less of the prompt's information budget per cell than the single LLM does.
- **KR −0.50** — same pattern. gpt-solo writes richer KEY_RESOURCES (e.g. for Stripe lists "engineering, banking partners, brand, payments licenses" while Starlink lists "engineering team and brand trust"). The judge's rubric rewards completeness within the cell.

> **The honest reframing**: at N=12, multi-agent's one structural win
> (KP coverage) just barely outweighs its per-cell content disadvantage
> on dense / information-rich cells (VP, KR) where a single LLM has
> the full prompt context to draw from.

---

## 3. Three diagnostic case studies

### 3.1 Stripe — gpt-solo wins 23–19 (largest margin, +4 for solo)

**This case flipped from N=8** (where Starlink won by 1) to N=12 (gpt-solo
wins by 4). The flip is not because the runs got better or worse —
it's the same Starlink architecture, same gpt-solo prompt, same judge,
just **a different LLM-as-judge call run**.

| Dim | Starlink | gpt-solo | Δ |
|---|---|---|---|
| CS | 2 | 3 | −1 |
| VP | 2 | 3 | −1 |
| CH | 2 | 3 | −1 |
| CR | 2 | 3 | −1 |
| RS | 3 | 3 |  0 |
| KR | 2 | 3 | −1 |
| KA | 2 | 3 | −1 |
| **KP** | **1** | **0** | **+1** |
| CT | 3 | 2 | +1 |

gpt-solo scored 3/3 on **6 of 9** dimensions on Stripe — the dim where
the model has the most training-data prior. This is consistent with
Stripe being heavily documented in public sources; the single LLM
has more in-context recall for Stripe than for less-famous Brex.

**Implication for the paper**: the "famous-company memorisation"
hypothesis (rejected at N=8 because it didn't hold for Coinbase
or DoorDash) **does seem to hold for Stripe at N=12**. Stripe is a
fundamental outlier — gpt-solo writes near-perfect cells because
the LLM's Stripe knowledge is richer than what we put in the
prompt. A reviewer will rightly ask whether this case should be
held out from headline aggregates.

### 3.2 Replit — Starlink wins 20–16 (largest margin, +4 for Starlink)

| Dim | Starlink | gpt-solo | Δ |
|---|---|---|---|
| CS | 2 | 2 |  0 |
| VP | 3 | 3 |  0 |
| CH | 2 | 2 |  0 |
| CR | 2 | 2 |  0 |
| RS | 2 | 2 |  0 |
| KR | 2 | 3 | −1 |
| KA | 2 | 0 | **+2** |
| **KP** | **2** | **0** | **+2** |
| CT | 3 | 2 | +1 |

Replit is the cleanest illustration of the structural argument:
**gpt-solo lost 2 points on KEY_ACTIVITIES (in addition to KP=0)
because it omitted the cell entirely**, not because it generated
weak content. This is an extreme version of the KP pattern — when
the single LLM is doing 9 cells in one shot, it can drop *more
than one* cell, and Replit's prompt happened to push it past the
threshold.

**Implication**: **the KP=0 pattern is not the worst case; the
worst case is "gpt-solo dropped 2 cells"** (Replit) **or "Stripe
written so well that nothing else matters"**. The single-LLM
output distribution has heavier tails on both sides than the
multi-agent distribution.

### 3.3 Twitch — tied 20–20 (the new acquired case)

| Dim | Starlink | gpt-solo | Δ |
|---|---|---|---|
| CS | 3 | 2 | +1 |
| VP | 2 | 3 | −1 |
| CH | 2 | 2 |  0 |
| CR | 2 | 2 |  0 |
| RS | 2 | 2 |  0 |
| KR | 2 | 3 | −1 |
| KA | 2 | 3 | −1 |
| **KP** | **3** | **0** | **+3** |
| CT | 2 | 3 | −1 |

Twitch is **the perfect microcosm of the N=12 finding**: gpt-solo
wins or ties **8 of 9 dimensions**, but Starlink's perfect 3/3 on
KP (caught the Amazon parent + game-publisher partnerships) plus
gpt-solo's structural 0 on KP creates a +3 swing that exactly
cancels the −3 net loss on the other 8 cells. Score: tied.

**This is the cleanest acquired-outcome case study because the
KP cell is where Twitch's most distinctive business-model fact
lives** (Amazon parent + esports partnerships). A reviewer
asking "why is multi-agent's structural advantage paper-worthy"
gets a sharp answer here: the KP cell is where the most outcome-
relevant fact often lives, and dropping it loses the most
strategically important information.

---

## 4. What the paper can and cannot claim at N=12

### ✅ Claims supported by N=12

1. **"Multi-agent role assignment guarantees structural coverage of
   the 9-cell canvas in a way that single-LLM JSON-mode does not."**
   Evidence: gpt-solo KP=0 in 12/12 cases; gpt-solo also dropped
   KEY_ACTIVITIES in Replit. Mean cell-completion rate: Starlink 9/9
   in 12/12 cases, gpt-solo ≤ 8/9 in 12/12 cases.
2. **"In dimensions where the most strategically important
   business-model fact lives in KEY_PARTNERSHIPS — common in
   acquired / parent-subsidiary / regulated cases — multi-agent
   captures information the single-LLM systematically misses."**
   Evidence: Twitch (Amazon partnership), Coinbase (regulators), Brex
   (sponsor banks), Substack (Stripe + creator ecosystem).

### ⚠️ Claims that need significant caveats at N=12

3. **"Multi-agent writes higher-quality BMC content overall."**
   At N=12 this is **rejected by the data**: gpt-solo wins or ties 8 of
   9 dimensions on per-cell content quality. The total gap is +0.5
   points and is entirely driven by KP coverage.
4. **"Multi-agent debate / critic improves content quality."** No
   evidence at N=12. The advantage is structural only.

### ❌ Claims NOT supported by N=12

5. **"Starlink wins on famous, well-documented companies via
   coordination"** — at N=12, **Stripe and Airbnb both flipped to
   gpt-solo wins** by 4 points each, suggesting that famous-company
   prompts are exactly where the single LLM's training-data prior
   helps it most.
6. **"Multi-agent gives qualitatively better cells."** The judge
   rationales repeatedly favour gpt-solo's cells for being "denser"
   or "more specific." Multi-agent's cells are competitive but
   shorter — partly because each generator gets only 1/3 of the
   information budget and prompt-context, and outputs only 1-3
   cells from its assigned subset.

---

## 5. Statistical considerations

At N=12 with judge-LLM scoring (0-3 ordinal per dim, 9 dims, single
run), the per-cell variance is high enough that **a 0.5-point total
gap is not statistically significant**. We have *not* run the
necessary multi-seed eval to attach confidence intervals, but back-
of-envelope: with σ ≈ 0.5 per cell × 9 cells ≈ σ_total ≈ 1.5 per
case, the standard error on a 12-case mean difference is
σ_total / √12 ≈ 0.43, putting the 0.5-point gap at ~ 1.2 σ.
**That's not p < 0.05.**

**Implication**: a credible paper writeup at N=12 should not lead
with the total-score gap. It should lead with the **per-dim
decomposition**, where the KP +2.00 finding is mechanistic and
does not depend on aggregate variance.

A reviewer-defensible framing:
> "We compare multi-agent and single-LLM BMC generation on 12 real
> YC cases. Total scores are statistically indistinguishable
> (Starlink 19.6 ± 1.5 vs gpt-solo 19.1 ± 1.5, p ≈ 0.2). However,
> the architectures differ systematically: the single-LLM JSON
> output structurally omits the KEY_PARTNERSHIPS cell in 12 of 12
> cases (mean score 0/3), while the multi-agent system that assigns
> KEY_PARTNERSHIPS to a dedicated generator produces a populated
> cell in every case (mean 2.0/3). On the 8 other dimensions,
> single-LLM writes higher-quality content (ties or wins on each).
> The architectural choice is therefore a coverage-vs-quality
> tradeoff, not a Pareto improvement."

---

## 6. Limitations

1. **Single judge call per (case × runner × dim)**. We have not
   measured judge-LLM variance. The Stripe N=8→N=12 flip is suspicious
   for this reason. **A multi-seed eval (e.g., 3 judge calls, take
   the mean) would tighten N=12 estimates substantially** and is the
   most cost-effective next step (~3× cost, ~30 min wall).
2. **Ground truth is our annotations, not expert-validated**. Tier B
   (Prolific MBA annotators × 3) and Tier C (entrepreneurship faculty
   × IRB) are unbuilt. Inter-annotator α is unknown.
3. **N=12 is too small for sector-stratified inference**. The 4 new
   cases (Twitch / Segment / Brex / Substack) added gaming, b2b-saas,
   non-API-fintech, and media — but with 1-3 cases per sector, we
   cannot make sector-conditioned claims.
4. **`workspace_knowledge` is empty in this eval**; the RAG /
   pgvector retrieval path is not exercised. Both runners receive
   the same flat-text question. A paired eval with KB-augmented
   prompts is the next planned ablation.
5. **`--minimal-context` ablation not yet run**. This flag (added
   alongside this report) strips the description from the question;
   running it will measure how much the prompt-richness contributes
   independently of architecture.

---

## 7. Comparison to the N=8 narrative

| N=8 claim | N=12 status |
|---|---|
| "Starlink wins 7 of 8 cases" | At N=12, Starlink wins 7 of 12 (58%); the gap shrunk |
| "1.9-point margin is real" | At N=12, margin = 0.5 points, within judge variance |
| "KP +2.25 dominates the gap" | At N=12, KP +2.00 *more than* dominates (other dims net negative) |
| "Coverage > content" reframe | **Confirmed and strengthened** |
| "Famous companies = solo wins" | **Now supported** (Stripe and Airbnb both flipped) |
| "Stratification too thin" | Still true at N=12; need 30+ for cell-level claims |

---

## 8. What to do next

In priority order:

1. **Multi-seed judge** (3 runs / cell, take mean) — tightens variance
   estimates without needing more cases. Cost: ~3× judge calls.
2. **`--minimal-context` ablation** — already coded; one cron run
   away. Compares prompt-richness contribution independent of
   architecture.
3. **Force-coverage gpt-solo variant** — explicit prompt requirement
   "you MUST output 9 cells in this exact order." Tests whether the
   KP=0 pattern is structural or just under-prompted. **If this
   eliminates the gap entirely, the multi-agent advantage is
   reduced to "we made the prompt right by construction."**
4. **N=20 expansion** — fill the underrepresented sectors
   (healthtech, climate, biotech, agriculture each at 0). The
   stratification roadmap in `_TEMPLATE.ts` lists candidates.
5. **Real RAG eval** — populate the kb-task-service KB (or
   bypass it with a LangChain.js retriever against pgvector) with
   chunked docs for each company, then compare RAG-on / RAG-off
   inside Starlink. Until this runs, the paper cannot claim the
   "RAG-augmented multi-agent" framing for Starlink.

---

## 9. Reproduction recipe

```sh
# Build
pnpm --filter @starlink/server build

# Full N=12 eval (current)
DATABASE_URL="postgres://nobody:nobody@127.0.0.1:5432/nodb" \
DEEPSEEK_API_KEY=sk-... LLM_API_KEY=sk-... \
LLM_BASE_URL=https://api.deepseek.com/v1 LLM_MODEL=deepseek-chat \
ORCHESTRATION_MODE=registry HITL_ENABLED=false \
LANGGRAPH_CHECKPOINTER_ENABLED=false \
MEMORY_WRITE_ENABLED=false MEMORY_READ_ENABLED=false \
  node packages/server/dist/benchmark/eval/yc-vs-runners.js

# Prompt-richness ablation (next)
... node packages/server/dist/benchmark/eval/yc-vs-runners.js --minimal-context

# Single case for debugging
... yc-vs-runners.js --case=yc-twitch-2014
```

Reports are written to `packages/server/benchmark/reports/` with
timestamps; `--minimal-context` runs append `-minctx` to the
filename so paired runs do not collide.
