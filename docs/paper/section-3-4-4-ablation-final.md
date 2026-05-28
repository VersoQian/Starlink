### 3.4.4 Design Ablation

The ablation tests retrieval grounding, the critic, and the limited review loop. Five conditions are compared on a six-case set that contains two normal BMC cases and four hidden-conflict cases. The hidden conflicts are written as ordinary business assumptions in the user prompt. The corresponding conflict note is used only during evaluation, so the tested system is not told directly that a conflict exists.

The experiment uses a composite rubric because the mechanisms are designed for different effects. Coverage measures whether the nine BMC dimensions and must-cover concepts appear. Evidence support measures whether important claims are linked to relevant source passages. Consistency measures whether the final canvas still contains cross-cell contradictions. Repair quality measures whether a detected problem is revised in a focused way without unnecessary rewriting.

Composite Score = 0.30 x Coverage + 0.25 x Evidence Support + 0.25 x Consistency + 0.20 x Repair Quality.

Table 3-7 reports the aggregate result. Full Starlink obtains a composite score of 4.53. Removing retrieval grounding produces the largest drop, from 4.53 to 3.48. The evidence subscore falls from 4.00 to 1.83, which matches the intended role of RAG: it supplies source-backed concepts and citation paths for the generated canvas. The minimal condition also falls below full, with a composite score of 3.84 and a lower evidence score of 2.58.

The critic has a more targeted effect. Removing it lowers the composite score from 4.53 to 4.02. The consistency score drops from 5.00 to 4.33, and repair quality drops from 3.92 to 2.83. This is the expected direction: the critic is not mainly a coverage mechanism. Its purpose is to expose contradictions across canvas cells and give the supervisor a reason to route revision work.

The debate result needs a more careful reading. The no-debate condition has a composite score of 4.57, slightly above full by 0.04. This difference is too small to treat as evidence that debate improves the final canvas in this setting. It also should not be read as proof that debate is harmful or useless. In Starlink, the limited debate loop is a repair-review mechanism that runs after the critic surfaces a conflict. On this small set, the final-canvas rubric rewards resolved outputs, but it does not strongly distinguish whether the repair came from ordinary revision or from adversarial review. The result therefore suggests that the debate loop is not a reliable mean-score booster under the current measurement. Its value is better framed as a bounded review step for disputed repairs, not as a guaranteed quality improvement.

Figure 3-10 visualizes the same result. The left panel shows the composite scores. The right panel separates evidence, consistency, and repair. This separation is important because a single mean score can hide which mechanism actually changed. Retrieval mainly affects evidence support. The critic mainly affects consistency and repair. Debate has a weaker measured effect in this run.

Table 3-7. Composite design ablation on normal and hidden-conflict cases.

Figure 3-10: Composite design ablation with mechanism-sensitive subscores.

The ablation therefore supports a limited conclusion. Retrieval grounding is the clearest measured contributor. The critic contributes to cross-cell consistency and repair routing. The limited debate loop is best treated as a bounded review step rather than as a guaranteed mean-score booster.

Artifacts:

- LaTeX main table: `docs/paper/tables/table3-7-composite-ablation.tex`
- LaTeX mechanism table: `docs/paper/tables/table3-8-ablation-mechanism-reading.tex`
- Figure: `docs/paper/figures/fig3-10-composite-ablation.png`
- Source report: `packages/server/benchmark/reports/composite-ablation-2026-05-27T07-40-30-051Z-completed.json`
