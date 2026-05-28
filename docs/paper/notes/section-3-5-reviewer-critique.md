# §3.5 — Reviewer-2-style critique

Written in the voice of a hostile-but-fair NeurIPS / ICML reviewer who has read [system-paper.md](../system-paper.md) §3.5 (Experiments and Analysis) end-to-end. Severity tags follow the standard major/moderate/minor convention. Items already conceded in the chapter are flagged `[conceded]`; new attacks are flagged `[new]`. Where the chapter's existing defence is solid, I say so.

---

## ⚠ The one numerical inconsistency that I would not let the author wave away

**[new · MAJOR]** The paper claims (§3.5.3, "central empirical result", and Fig 3-9 caption): "*This single dimension [`KEY_PARTNERSHIPS`] accounts for approximately 80 % of Starlink's total-score advantage.*"

The arithmetic does not support this.

- Starlink mean total: **19.8 / 27**. Baseline: **18.7 / 27**. Gap: **+1.1**.
- `KEY_PARTNERSHIPS`: baseline scores **0** in 12 / 12 cases; Starlink mean **2.0**.
- KP-attributable gain per case: **+2.0**.
- Observed total gain per case: **+1.1**.
- ⇒ Starlink *loses* roughly **0.9 points / case** distributed across the other eight dimensions combined.

So the KP gain is not 80 % of the advantage — it is **~180 %** of the advantage, with the other eight dimensions netting *negative*. The chapter has the right intuition (the win is structural, on one dimension) but the headline number sells the result wrong. A reviewer doing the math during peer review will notice and will use it to suggest the contribution is narrower than presented: "you gain a fixed +2 on KP and lose ~1 elsewhere; whether the net is positive is a property of the rubric weighting, not the orchestration."

**Suggested fix.** Replace "approximately 80 %" with the actual decomposition: "KP gain: +2.0 / case; loss across other 8 dimensions: ~−0.9 / case; net: +1.1 / case." This is *more* defensible than the current claim, because the per-case-loss has an honest explanation already in §3.5.3 ("longer output trips the judge's non-essential-content deduction on already-saturated cases"). The current "80 %" line invites a reviewer attack the corrected version avoids.

---

## Major issues

### 1. The judge model is never named  `[new]`
"The judge is held constant across every run reported in this chapter, so any score difference is attributable to the system under test rather than to the judging path" (§3.5.1) — but **which** judge? If the judge is an OpenAI-family model and `gpt-solo` is also OpenAI-family, you have a shared-bias confound. If the judge is the same family as one of the Starlink agents, ditto. The Agent-as-Judge protocol [40] explicitly recommends naming the judge and reporting cross-judge agreement. A reviewer will refuse to evaluate the +1.1-point claim until the judge identity is on the page.

**Fix:** name the judge in §3.5.1 *Metrics and judge*. Confirm it is *not* in the same model family as either baseline or system. Ideally re-run a subset under a second judge of a different family and report κ. If only one judge is available, at minimum disclose.

### 2. No inter-rater agreement, no human spot-check  `[new]`
The judge-calibration table (Table 3-5) verifies that the judge **does not reward content-free input**. It does not verify that the judge **discriminates 2 from 3 the way a human would** on real canvases. That is the load-bearing reliability claim — and the paper makes it implicitly without evidence. A 50-canvas human spot-check, with κ to the judge, is the standard expectation. Without it, the entire 0–3 ordinal scale is unanchored on the high end.

**Fix:** even a small human re-rating (one of the authors, plus one peer; n = 30 canvases; report κ) closes this hole. Without it, the contribution is "an LLM judges another LLM and likes it more when there are more LLMs."

### 3. The "+0.5 / +0.7" same-LLM-control gains are within judge noise  `[partly conceded]`
Table 3-9, primary backend: gpt-solo 19.8 → Multi-agent 20.3, Δ = +0.5 on n = 6. DeepSeek backend: Δ = +0.7. Both gaps are smaller than the judge's natural 1-point granularity over a 0–27 scale at n = 6. The chapter concedes this on the +1.1 headline ("at the edge of the judge's resolution with twelve cases"). It does **not** concede the same point for the same-LLM control, where the sample is half the size. The MiniMax +4.3 is real; the other two rows are not yet distinguishable from null. As written, the same-LLM section frames "modest advantage on stronger backends" as a finding when the honest read is "no signal."

**Fix:** add one sentence acknowledging that Table 3-9 rows 1 and 2 are within judge noise; the result that survives is the MiniMax row.

### 4. The central architectural claim is unablated  `[new]`
The chapter ablates retrieval grounding, the critic, and the bounded debate loop (§3.5.6). It does **not** ablate declarative coverage itself — i.e. running the system with capability declarations turned off so the supervisor is free to skip dimensions. That is the contribution's name on the cover, and there is no ablation that touches it. The "no-RAG" condition removes retrieval but keeps the dimension dispatch; that does not isolate declarative coverage.

**Fix:** add a "no-coverage" condition: same generators, same critic, same debate loop, but the supervisor's dispatch logic is replaced by "let each agent decide whether to fire." Predicted outcome: KP and the MiniMax tail dimensions drop out, recovering the single-LLM pattern. This is the experiment that proves the design's central mechanism. Without it, a hostile reviewer says "you've shown that multi-agent helps; you haven't shown that the *declarative-coverage* part is what helps."

### 5. The "recall@5 = 1.514" units are wrong on their face  `[new]`
Recall@5 is bounded in [0, 1]. Table 3-6 reports **1.514** and **1.944**. Either this is a sum-of-recall@k across multiple queries (i.e. a denominator of 20 queries was dropped from the column label), or it is mean recall × some factor, or it is mislabeled. Whichever it is, the reader cannot tell, and a reviewer flags this immediately as "what is the unit?"

**Fix:** rename the column to whatever it actually measures (e.g. "mean recall@5 over 20 queries (no normalization)" or "sum recall@5 / 20") and re-check the +28.4 % figure against the corrected denominator.

### 6. YC bias  `[new]`
All twelve cases are YC-portfolio firms that are unusually well-documented in any 2024+ pretraining corpus. The single-LLM baseline gets a generous floor on every dimension *except* the structural-blind-spot one. On a seed-stage start-up with no Wikipedia page (which is the actual deployment target), the baseline will be worse and Starlink will look better. But it can also be worse for Starlink: retrieval will hit thinner KBs and conflicts will multiply. Either way, the YC dataset is not representative of the target population. The chapter does not address external validity at all.

**Fix:** even three out-of-distribution cases (a startup the model has never seen — pick one from a private 2026 cohort or anonymize a real client engagement) would close this hole.

---

## Moderate issues

### 7. The +1.1 headline is not accompanied by any statistical test  `[partly conceded]`
n = 12, ordinal rubric, paired comparison. A sign test on 9 wins / 3 ties / 0 losses gives p ≈ 0.004 (one-sided). A bootstrap CI on the +1.1 mean total is trivial to compute. The chapter only says "at the edge of the judge's resolution" and leaves it at that. A single sentence with a sign-test p-value or a bootstrap CI would put the headline on firmer ground.

### 8. The cross-vendor "35 / 36 cases" overstates what is being replicated  `[new]`
The 35 / 36 number is the reproduction of the **failure mode** of the baseline (KP = 0), not the reproduction of the multi-agent system's **win**. A reader can be forgiven for parsing the §3.5.3 cross-vendor section as evidence that the multi-agent system wins across vendors — which it has not been evaluated for. The system was rerun cross-vendor only under the same-LLM control (Table 3-9, n = 6).

**Fix:** explicit framing line: "The cross-vendor evidence is that the *single-LLM blind spot* generalises across providers, not that the *multi-agent system's win* does."

### 9. No prompt-engineering ceiling for the baseline  `[new]`
The single-LLM baseline sends "one templated prompt to one language model" (§3.5.1). A natural reviewer question: what if the prompt explicitly enumerates the nine BMC dimensions and says "produce a non-empty answer for each"? That is the cheap defence against the headline finding. If the prompt-engineered baseline closes the KP gap, the orchestration's contribution is overstated. If it does not, the architectural claim is much stronger and ought to be made on the record.

**Fix:** run one extra single-LLM condition with a prompt that enumerates all nine dimensions. Report the result honestly in either direction. Without it, a reviewer is entitled to suspect the gap is a prompt-engineering artefact.

### 10. Ablation table data contradict the ablation's narrative  `[partly conceded]`
Table 3-11 means: minimal **21.00** · no-RAG **21.17** · full **21.83** · no-debate **22.00** · no-critic **22.17**. The chapter claims retrieval grounding is the "load-bearing channel for must-cover coverage." But:

- no-RAG (21.17) is **higher** than minimal (21.00), so removing retrieval from minimal *helps*.
- full (21.83) is lower than no-debate (22.00) and no-critic (22.17), so the full pipeline is *dominated* by two of its ablations.
- The retrieval-grounding claim is then carried by "no-RAG drops worst-case", visible only in the figure not in the means.

The chapter concedes the no-critic / no-debate inversion as "within judge noise" but does **not** concede that the same noise threshold makes the no-RAG → full delta of 0.66 points (3 %) statistically indistinguishable from zero on n = 6. If 0.66 is noise for the critic, it is noise for retrieval too. The "load-bearing" framing does not survive symmetric scrutiny.

**Fix:** demote the "load-bearing channel" claim to "weak evidence consistent with the predicted signature, requires n ≥ 30 to confirm." Or run more cases.

### 11. "Algorithm 1, line 5" is referenced but never displayed  `[new]`
§3.5.3 says "*the supervisor dispatches that capability on every canvas request (Algorithm 1, line 5)*". There is no Algorithm 1 visible in §3.5. Either fix the cross-reference (e.g. point to §3.2.2 where the pseudocode lives) or display the algorithm.

### 12. The MiniMax Twitch zero-canvas case is averaged into the mean without disclosure  `[new]`
"One MiniMax case (Twitch) returned an empty JSON entirely and is recorded as 0 / 27" (§3.5.3). On n = 12 with a single 0 / 27 outlier, the MiniMax baseline mean (13.6) is dragged down by roughly 1 point. The chapter should report MiniMax mean with-and-without the parsing-failure case, or treat the empty-JSON case as a parsing failure rather than a content score of zero.

### 13. Token-cost framing is qualitative where it should be a number  `[new]`
"Token usage runs roughly five to ten times the single-LLM baseline" (§3.5.4). Five-to-ten is a 2× range, in dollars that is e.g. $0.05 vs $0.40 per canvas. For an entrepreneurial-tool target user, this is decision-relevant. The number is in the raw report files already; lift it into the table.

---

## Minor issues

### 14. The hardware spec is decorative  `[new]`
"Consumer laptop (M1-class CPU, 32 GB RAM); the system is not GPU-resident, since all language-model and embedding calls are routed to external services" (§3.5.1). If no compute runs locally, this is irrelevant; remove or fold into deployment context (Chapter 4).

### 15. Model identifiers are anonymised in §3.5.1 / 3.5.3 but the specific name "v4-flash" appears in §3.5.6  `[new]`
Inconsistent. Either name every model or none. Anonymisation of vendors A and B is fine; partial naming reads as ad-hoc.

### 16. §3.5.5 is a paragraph of anecdote presented in an experiments section  `[partly conceded]`
"Roughly half of the resolved defects" — n, defect definition, and the comparison baseline are all absent. The chapter concedes the lack of controlled comparison. The honest move is to retitle §3.5.5 as "Engineering Notes" and pull it out of the experiments-and-analysis section. Right now it dilutes the actual results.

### 17. Figure 3-9 right-panel exaggerates the gap  `[new]`
The caption says "*This single dimension accounts for approximately 80 % of Starlink's total-score advantage*". As shown above, the math is closer to 180 %. The figure shouldn't carry a number the data don't support; recompute and replot before submission.

### 18. The "+5.9 %" relative number is hand-engineered  `[minor]`
"+1.1 points (+5.9 %)" — 1.1 / 18.7 ≈ 5.88 %. The denominator is the baseline mean, fine. But percentage gains on ordinal scales are misleading; consider reporting only the raw delta and the per-dimension breakdown.

### 19. No comparison to BM25-only retrieval  `[new]`
The retrieval evaluation (§3.5.2) compares dense vs hybrid. It does not compare against BM25-alone, which is the natural straw-man for the "lexical channel saves us under jitter" claim. If BM25-alone matches the hybrid under jitter, the rank-fusion machinery is not contributing.

### 20. Memo: "raw reports" filenames in §3.5.3 are useful but unstable  `[minor]`
File names like `yc-vs-runners-20260513-054934.md` are great for reproducibility but will rot fast. A canonical pointer (a stable filename, a Zenodo doi, or a `data/` subdirectory in the repo) is more defensible.

---

## What the chapter does well (so I don't sound only adversarial)

- The KP-zero blind-spot finding is the right kind of result: structural, mechanism-attributed, and reproducible across vendors. The argument that this is *coverage repair* rather than *quality lift* is the single best framing decision in the chapter — keep it.
- The judge-calibration table on degenerate inputs (Table 3-5) is more rigour than most agent papers show. Don't downplay it; just add the human spot-check and the second judge to close the rest of the loop.
- The cost trade-off ("explicit cost of coverage repair and citation-grounded audit trail") is correctly named as a feature of the design space, not as a defect to be hidden.
- The same-LLM control on the MiniMax backend (+4.3 points) is the single cleanest result in the chapter and is worth more than the headline +1.1. It deserves to be promoted to the abstract.
- The honest concessions (n = 12 at the edge of judge resolution; n = 6 not enough to detect small mean effects; no-critic / no-debate within noise) are the right concessions, and they are made in the right register. Don't lose them.

---

## Priority list (what to fix before submission)

1. **Recompute and rephrase the "80 %" claim** (Major #fix-1). Single biggest credibility risk in the chapter.
2. **Name the judge model** (Major #1). One sentence.
3. **Add a human spot-check + κ** on n = 30 canvases (Major #2). One afternoon's work.
4. **Run the "no-coverage" ablation** (Major #4). The contribution's name demands it.
5. **Fix the recall@5 unit** (Major #5). One column rename or one division.
6. **Run the prompt-engineered baseline** (Moderate #9). Closes the only remaining "is it just the prompt?" attack.
7. Acknowledge that Table 3-9 rows 1–2 are within noise (Moderate #3).
8. Reframe the cross-vendor 35 / 36 result (Moderate #8).
9. Drop hardware spec (Minor #14); resolve model-name inconsistency (Minor #15); demote §3.5.5 to engineering notes (Minor #16).

Items 1, 2, 5 are low-effort and high-credibility. Item 4 (the no-coverage ablation) is the one a reviewer would call "the missing experiment that would have convinced me."
