# Qualitative analysis · Starlink vs gpt-solo on Tier-A YC cases (N=8)

**Date**: 2026-04-27
**Source eval**: `yc-vs-runners-20260427-131446.md`
**Judge**: DeepSeek deepseek-chat with Agent-as-a-Judge prompt (Zhuge et al. 2024), 0–3 rubric per BMC dimension
**Cost**: ~ ¥0.30 / full N=8 run, 144 dim-level judge calls + 16 runner outputs

This document accompanies the headline result and digs into:
1. **Where the 1.9-point gap actually comes from** — per-dimension decomposition shows it's not what the headline implies
2. **Three case studies** at the extremes of the win/loss distribution
3. **Implications for the multi-agent claim** — what it does and doesn't prove

---

## 1. Per-dimension decomposition

The headline "Starlink wins 7 of 8 cases, mean 20.3 vs 18.4" is correct, but **misleadingly attributes the gap to general quality**. Decomposing the means by BMC dimension paints a sharper picture:

| Dim | Starlink μ | gpt-solo μ | Δ (Starlink - solo) |
|---|---|---|---|
| CUSTOMER_SEGMENTS (CS) | 2.38 | 2.13 | +0.25 |
| VALUE_PROPOSITIONS (VP) | 2.38 | 2.63 | **−0.25** |
| CHANNELS (CH) | 2.38 | 2.13 | +0.25 |
| CUSTOMER_RELATIONSHIPS (CR) | 2.13 | 2.38 | **−0.25** |
| REVENUE_STREAMS (RS) | 2.50 | 2.13 | +0.38 |
| KEY_ACTIVITIES (KA) | 2.25 | 2.63 | **−0.38** |
| KEY_RESOURCES (KR) | 2.00 | 2.13 | **−0.13** |
| **KEY_PARTNERSHIPS (KP)** | **2.25** | **0.00** | **+2.25** |
| COST_STRUCTURE (CT) | 2.00 | 2.25 | **−0.25** |
| **Total / 27** | **20.25** | **18.38** | **+1.87** |

**Reading**: of the 9 dimensions, gpt-solo actually beats Starlink on **5** (VP, CR, KA, KR, CT) and ties or loses narrowly on 3 more (CS, CH, RS). The entire 1.9-point margin comes from one cell: **Key Partnerships, where gpt-solo scored 0 in 8 of 8 cases**.

> Conceptually, the result is not "multi-agent writes better BMC content." It's "multi-agent guarantees 9-cell coverage; single-LLM systematically drops at least one cell." If KP coverage were enforced through prompting alone (e.g., a strict JSON-schema validator on gpt-solo's output forcing all 9 cells), the headline gap would likely shrink to ~ 0.

This is a more honest framing of the architectural advantage:

- ✅ **Strong claim, supported**: multi-agent assignment of dimensions to specific generators eliminates structural drop-out. Each generator owns a fixed dimension list; a generator cannot silently omit its assigned cell. Starlink's market-agent owns KP, so KP is always populated.
- ✅ **Strong claim, supported**: the *coverage* effect is more important than per-cell quality at N=8. Reviewers should not over-interpret single-cell wins.
- ⚠️ **Claim that needs caveats**: "Starlink writes higher-quality BMC content." On the 8 cells where both runners actually produce content, gpt-solo wins or ties on most of them (5/8). Starlink's per-cell content is competitive, not categorically better.
- ❌ **Claim NOT supported**: "Multi-agent debate / critic improves content quality." We have no evidence for this from these numbers. The advantage is purely structural (assignment → coverage), not deliberative.

---

## 2. Case studies

### 2.1 DoorDash (S13) — gpt-solo wins 21–20 (the only Starlink loss)

**The setup**: 3-sided gig marketplace where courier pay is the dominant cost line. Both runners had access to the same public profile.

**Where Starlink lost the point**:

```
Dim        Starlink   gpt-solo    Note
KEY_ACT    1          2          Starlink missed regulatory engagement entirely
COST       2 (capped) 2          Starlink mentioned "inventory cost"
                                 (must_not_cover token); judge applied
                                 the rubric inconsistently here
                                 (cap-at-1 rule should have made it 1)
```

**Quoted judge rationale on Starlink's KEY_ACTIVITIES** (score=1):
> "Candidate covers marketplace operations (order matching) and dispatching (route optimization), but misses regulatory engagement entirely."

**Quoted judge rationale on gpt-solo's KEY_ACTIVITIES** (score=2):
> "Covers marketplace operations, dispatching, and regulatory implicitly through rider management and merchant relations, but misses explicit regulatory engagement."

**Architectural implication**: This is a *coverage failure inside a covered cell*. Starlink's market-agent generated KEY_ACTIVITIES content but chose not to discuss regulatory engagement (gig-worker classification, AB5, etc) — a substantive content gap, not a structural one. Gpt-solo by chance mentioned related concepts in its general gig-worker framing.

This case demonstrates that **multi-agent's coverage guarantee is at the cell level, not the concept level**. A generator can produce a mediocre KEY_ACTIVITIES cell that hits some must_cover tokens but misses others. Starlink does not currently have a critic mechanism that catches "you generated KA but forgot regulatory" — only the supervisor's pass on dimensional completeness.

**Why this matters for the paper**: a reviewer will ask "why does Starlink's per-cell quality not dominate?" The honest answer is that **per-cell quality is per-agent quality**, and a single generator agent doing one BMC dimension is not categorically smarter than a single LLM doing all 9. The win comes from structure (assignment) not depth (deliberation).

### 2.2 Coursera — Starlink wins 20–16 (the largest gap, +4)

**The setup**: Online learning platform with universities + employers as content partners. Public-IPO outcome.

**Decomposition of the +4 gap**:

```
Dim        Starlink   gpt-solo    Source of gap
RS         3          1          gpt-solo violated must_not_cover ("ads-only")
                                 — capped at 1
KP         3          0          gpt-solo dropped the cell entirely
Other 7 dims: tied or ±1 each   small variance, net ~ 0
```

**Quoted judge rationale on gpt-solo's REVENUE_STREAMS** (score=1):
> "Candidate covers subscription, tuition, and enterprise but violates must_not_cover by mentioning ads-only revenue."

This is **two separate failure modes** in one case:
- **Drop-out** (KP=0): structural, expected, addresses 8/8 of our N=8 baseline
- **Constraint violation** (RS=1): semantic — gpt-solo mentioned "ads" as a revenue mechanism, which is incorrect for Coursera (Coursera does not run an ads-driven model)

The constraint violation is interesting because it's the kind of mistake a critic-style review would catch: "wait, does Coursera actually run ads? No, it's subscriptions + tuition + B2B. Strike the ads mention." Starlink has a critic stage that *could* catch this; gpt-solo has no second pass.

But Starlink's critic in this run did NOT trigger any conflict for Coursera (handoff log shows 4 handoffs, no debate rounds). So even with the architectural capability, the critic's recall on subtle factual errors is imperfect.

**Architectural implication**: Starlink's win on Coursera **is partly luck** in that gpt-solo happened to make a self-inflicted mistake (mentioning ads). On a domain where gpt-solo doesn't make that mistake (e.g., Stripe), the gap closes to 2 points (almost entirely from KP).

### 2.3 Airbnb — tied 19–19 (the closest case)

**The setup**: Two-sided marketplace, public IPO.

```
Dim        Starlink   gpt-solo    Note
CS         3          2          Starlink wins by being more granular
VP         2          3          gpt-solo wins by mentioning "Experiences"
CH/CR/RS   2 each     2 each     tied
KA         2          2          tied — neither caught explicit regulatory
KR         2          3          gpt-solo wins (mentioned algorithms, network effects)
KP         2          0          Starlink wins by *having* it
CT         2          3          gpt-solo wins (mentioned R&D, global team)
TOTAL      19         19
```

**The structural KP advantage exactly cancels gpt-solo's content-quality wins on KR + CT.** This is the cleanest illustration of the trade-off: **multi-agent's structural coverage trades against single-LLM's per-cell richness when the LLM does cover that cell.**

**Quoted judge rationale on gpt-solo's COST_STRUCTURE** (score=3):
> "Covers all must_cover concepts (marketing, engineering, customer support) and adds non-obvious details like R&D and global team compensation."

Gpt-solo's single-prompt invocation gives the model the entire BMC at once, allowing it to add cross-cutting nuance ("global team compensation") that's plausible across dimensions. Starlink's generators see only their assigned dimensions; the synthesizer doesn't fold richer cross-cutting nuance back into individual cells.

**Architectural implication**: this is a real downside of multi-agent assignment. **Specialization can reduce cross-cell synthesis quality.** Future work: a post-synthesis "enrichment pass" where each cell is refined with cross-cutting context.

---

## 3. Reframed paper claims

Given the per-dim decomposition, the paper's empirical claims should be staged carefully:

| Claim | Strength | Caveat |
|---|---|---|
| Starlink wins 7/8 cases on Tier-A YC dataset under Agent-as-a-Judge eval | Strong | Win-rate, not score-per-cell, is the right framing |
| The advantage is dominated by structural 9-dim coverage | Strong | KP gap = 2.25; total gap = 1.87 |
| Multi-agent's per-cell content quality matches or exceeds single-LLM | NOT supported | gpt-solo wins on 5/9 dims when restricted to non-coverage effects |
| Multi-agent's critic + debate improves content correctness | NOT tested | Coursera's RS violation went uncorrected; critic fired but found no conflict |
| Single-LLM systematically drops dimensions in JSON output mode | Strong | KP=0 in 8/8 cases is a structural artifact of how single-LLM treats the multi-cell instruction |

The defensible thesis is therefore narrower than the headline:

> "Multi-agent BMC generation guarantees 9-dimensional coverage as a structural property of agent-dimension assignment, eliminating the dimensional drop-out that single-LLM JSON output exhibits in 100% of our N=8 evaluation cases. Per-cell content quality between the two architectures is comparable on cells where both produce output."

This is a **cleaner, more defensible claim** than "multi-agent writes better BMCs." It also points at concrete next-research directions:
1. Does dimensional drop-out reproduce on other LLMs (GPT-4, Claude, Gemini)?
2. Can a JSON-schema validator + retry pattern close the gap for single-LLM?
3. Can Starlink's critic be tuned to catch semantic errors (the Coursera ads case) — currently it only catches inter-cell conflicts?

---

## 4. Limitations of this analysis

- **Single judge**: DeepSeek-judge at temp 0.2. Inter-judge consensus (GPT-4o + Claude) would tighten variance. Stage J.4-extended.
- **Single run per case**: judge non-determinism (same input, slightly different score) can shift case-level wins by 1–2 points. We observed Stripe flip 5→8 between two runs (gpt-solo 22→20, Starlink 17→22). 3-run variance analysis would clarify what's signal vs noise.
- **N=8 is still small**: all stratification claims are under-powered. Need N≥30 (Tier B target) for sector-conditioned analysis.
- **Ground truth = our annotations**: drift risk. Two human annotators per case + Krippendorff α (Tier B) would address this.
- **No human annotator comparison**: would also be useful to see how a *human MBA student* scores on this rubric (the natural ceiling).

---

## 5. What changed vs. the prior N=5 framing

The N=5 commit message claimed "gpt-solo wins on famous companies via memorisation; Starlink wins on long-tail." This narrative does NOT survive N=8:

- Stripe: gpt-solo 22 → 20, Starlink 17 → 22. Starlink now wins on the most-famous company in the dataset.
- Airbnb: gpt-solo 21 → 19, Starlink 18 → 19. Tied at N=8.

The "memorisation effect" was overfitting. The real story is the structural coverage finding above, which is **stronger and more generalisable** than the original narrative.

This is a useful reminder to rerun evals when the dataset grows: small-N narratives often don't survive.

---

## Appendix · How to reproduce

```sh
DATABASE_URL="postgres://nobody:nobody@127.0.0.1:5432/nodb" \
DEEPSEEK_API_KEY=sk-... LLM_API_KEY=sk-... \
LLM_BASE_URL=https://api.deepseek.com/v1 LLM_MODEL=deepseek-chat \
LANGGRAPH_CHECKPOINTER_ENABLED=false \
HITL_ENABLED=false ORCHESTRATION_MODE=registry \
MEMORY_READ_ENABLED=false MEMORY_WRITE_ENABLED=false AUTH_MODE=disabled \
node packages/server/dist/benchmark/eval/yc-vs-runners.js
```

Output goes to `packages/server/benchmark/reports/yc-vs-runners-<ts>.md`. Total wall-clock ~ 11 minutes, ~ ¥0.30 in DeepSeek calls.
