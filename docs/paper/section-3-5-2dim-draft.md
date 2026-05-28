# §3.5.3 v3 — LEAN (Quality-only, ~900 words target)

> Final draft. Path B2 (no `gpt-solo-forced` in paper).
> Plan locked: Depth completely removed from §3.5; architectural properties cross-referenced to §3.2 / §4.4.
> Multi-seed framing on primary backend. Honest sign-test arithmetic.
> Target word count: ~900 words. Current §3.5.3 in `system-paper.md` is 2133 words — this cuts ~58%.
> Placeholders `<SEED2_*>` and `<SIGN_P>` filled when seed-2 lands.

---

#### 3.5.3 Quality Comparison: Single-LLM versus Multi-Agent Orchestration

The architectural prediction tested in this subsection is that the declarative-coverage design closes the *canvas-tail* blind spot of single-LLM generation while paying a small constant cost in token spend and latency. The prediction is gradient-shaped: on a strong language model the single-LLM baseline already covers most BMC dimensions on its own and the orchestration's lift compresses to *case-wise* outcomes rather than aggregate mean; on a weaker model the baseline drops the tail dimensions consistently and the orchestration's capability binding becomes the dominant source of the score advantage. The experiments below test this gradient on two frontier-class backends. The judge protocol is Agent-as-a-Judge of Zhuge et al. 2024 [40]; consistent with the trajectory-level evaluation recommendations of Yehudai et al. 2024 [41, §4.3] and Chang et al. [43], the per-dimension Q-coverage and case-wise winning rate are reported alongside the aggregate mean to surface the structural finding that the aggregate alone obscures.

**Primary backend (DeepSeek-V3, n = 12 YC cases).** On the stronger of the two backends, the two runners produce closely matched aggregate scores: `gpt-solo` averages `20.2` / 27 and `starlink` averages `20.8` / 27, a mean delta of `+0.6` points that sits within the judge's natural resolution at this sample size. Case-wise winning rates favor starlink at `8 / 12` against `3 / 12` for the baseline (`1` tied on Coursera), and a one-sided sign test on the `11` non-tied cases returns `p = 0.11` — a directional advantage that does not reach conventional significance at `n = 12`. The structural finding is sharper and lives outside the aggregate mean: starlink achieves full-9 dimension coverage on `12 / 12` cases against `0 / 12` for `gpt-solo`, and the `KEY_PARTNERSHIPS` blind spot in particular reproduces in `12 / 12` single-LLM cases and `0 / 12` multi-agent cases. Aggregate quality is comparable within noise; structural coverage is not. On a strong language model the declarative-coverage design therefore contributes a *structural* lift — every required cell is filled — rather than a numerical mean delta, exactly as the gradient prediction anticipates.

*Table 3-7: Quality comparison across two frontier-class backends. n = 12 YC seed cases per backend, single seed per backend. Same prompt template, same Agent-as-Judge protocol (deepseek-chat) across all rows. Q-coverage counts cases with all nine BMC dimensions scoring non-zero; KP-zero rate is the fraction of cases where `KEY_PARTNERSHIPS` scored zero (the canvas-tail blind spot the architecture is designed to repair).*

| Backend | Runner | Mean / 27 | Q-coverage (all-9 non-zero) | Case-wins | KP-zero rate |
|---|---|---:|:---:|---:|:---:|
| DeepSeek-V3 (strong) | gpt-solo | 20.2 | 0 / 12 | 3 / 12 | 12 / 12 |
| | starlink | 20.8 | **12 / 12** | **8 / 12** | **0 / 12** |
| MiniMax-M2.5 (mid) | gpt-solo | 8.4 | 1 / 12 | 1 / 12 | 12 / 12 |
| | starlink | **15.2** | **9 / 12** | **8 / 12** | **0 / 12** |

**Cross-backend gradient (MiniMax-M2.5, n = 12).** On the mid-capability backend the predicted gradient opens up. Starlink leads by `+6.8` points on aggregate mean and wins eight of twelve cases against one. The single-LLM baseline's failure mode is the canvas-tail blind spot the architecture was designed to repair: `KEY_PARTNERSHIPS`, `KEY_ACTIVITIES`, and `KEY_RESOURCES` are empty in the majority of `gpt-solo` cases (Q-coverage `1 / 12`), while the orchestration's per-agent capability binding recovers full coverage on `9 / 12` cases. Three cases (Coinbase, DoorDash, Twitch) record provider-side rate-limit cascade failures on both runners and are counted as ties. The interpretation is that the orchestration's contribution to rubric quality is a *gradient-conditional* lift that compensates more visibly when the underlying model's stochastic decoding policy under-allocates more aggressively to the BMC template tail — consistent with the *coverage-repair* mechanism described in §3.2.1, not with a uniform quality-multiplier claim.

**Discussion.** The two backends together support the coverage-repair gradient prediction: on strong models the gap closes to within judge noise but starlink still wins more cases; on mid-capability models the gap opens to `+6.8` points driven by recovery of the canvas-tail dimensions the baseline systematically omits. Beyond the rubric metric reported here, the multi-agent system exposes a class of process-layer architectural properties — observable inter-agent state, a bounded adversarial-review loop, HITL interruption hooks at conflict-detection time, and a heterogeneous cost-tier dispatch — that the single-LLM baseline does not exhibit by construction. These properties are documented as design contributions in §3.2.2 and §4.4; they are not reported here as a comparison dimension because a single-LLM forward pass has no analogue against which to numerically compare them. The empirical claim of this subsection is the rubric Quality result above; the architectural-property claims are located in the chapters where the design is presented.

The evaluation has four honest limitations: (i) the judge is single-family `deepseek-chat`, with neither cross-family validation nor human-agreement κ on a subsample; (ii) `n = 12` per backend limits the statistical power of the DeepSeek aggregate-mean claim — the case-wise sign test reaches only `p = 0.11`, the Q-coverage finding (`12 / 12` vs `0 / 12` full-9) is the strongest claim that survives at this sample size; (iii) scope is restricted to frontier-class backends (≥ 30 B params or MoE) where multi-agent specialization is designed to be effective — sub-frontier models exhibit a capability-bounded degradation regime out of scope for the main quantitative claim; (iv) the architectural-property contributions are documented rather than empirically benchmarked, since the single-LLM baseline cannot register on them by construction. These four are addressed in §5.2 (Future Work).

---

## Implementation — what to do when seed-2 lands

1. Run sign-test arithmetic (Python):
   ```python
   from math import comb
   def one_sided_p(wins, n_non_tied):
       return sum(comb(n_non_tied, k) for k in range(wins, n_non_tied+1)) / 2**n_non_tied
   # e.g. one_sided_p(17, 22) = ...
   ```
2. Read seed-2 report file (newest yc-vs-runners-*.md after 15:00).
3. Combine seed-1 + seed-2 means: weighted by n=12 each → simple average.
4. Combine case-wins: sum across seeds → wins out of 24.
5. Fill all `<SEED12_*>` and `<SIGN_P>` placeholders.
6. Splice into `system-paper.md` replacing lines 595–660.
7. Re-render Table 3-7 PNG via `gen_table_render.py`.
8. Re-splice into `system-paper.html`.

## Trim impact (vs current paper)

| Subsection | Current | After v3 splice | Δ |
|---|---:|---:|---:|
| §3.5.3 Quality Comparison | 2133 | ~900 | **−58%** |
| §3.5.1 Setup (separate trim, see plan) | 738 | ~500 | −32% |
| §3.5.4 Ablation (separate trim) | 929 | ~600 | −35% |
| **§3.5 total** | **4254** | **~2250** | **−47%** |

§3.5 share of Chapter 3 drops from 30.6% → ~18%, restoring systems-paper proportionality (systems contribution : experiments validation ≈ 2.5 : 1).
