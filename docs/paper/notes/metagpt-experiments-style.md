# MetaGPT §4 Experiments — writing-style notes

Source: Hong et al., *MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework*, arXiv:2308.00352 (latest version on `arxiv.org/html/2308.00352v7`). Cited in this thesis as `[27]` in [references.bib:170](../references.bib).

These notes are reference material for the targeted rewrite of [system-paper.md](../system-paper.md) §3.5.  No claim or number from the Starlink experiments is changed; only register and table-integration.

---

## 1. Section structure (verbatim)

```
4   Experiments
4.1 Experimental setting
    Datasets
    Evaluation Metrics
    Baselines
4.2 Main Result
    Performance
4.3 Capabilities Analysis
4.4 Ablation study
    The Effectiveness of Roles
    The Effectiveness of Executable Feedback Mechanism
```

Observation: MetaGPT keeps **setting → main result → capability analysis → ablation** as a strict spine, with named sub-subsections that lead with `The Effectiveness of …`.

---

## 2. The three tables in §4

| MetaGPT table | Caption | Columns | What it does |
|---|---|---|---|
| Table 1 | "The statistical analysis on SoftwareDev" | Statistical Index · ChatDev · MetaGPT w/o Feedback · MetaGPT | Head-to-head with the most-direct prior system; lists 7-8 metrics including executability, running time, tokens, LOC, productivity, human-revision cost |
| Table 2 | "Comparison of capabilities for MetaGPT and other approaches" | Framework capability · AutoGPT · LangChain · AgentVerse · ChatDev · MetaGPT | Qualitative ✓/✗ matrix of 7 capabilities — exactly the same shape as Starlink Table 2-1 |
| Table 3 | "Ablation study on roles" | Engineer · Product · Architect · Project · #Agents · #Lines · Expense · Revisions · Executability | Incremental role addition, with each row turning one role on |

---

## 3. Writing register — the four patterns to imitate

### Pattern A — present tense, "outperforms", direct juxtaposition
> "Figure 4 demonstrates that MetaGPT outperforms all preceding approaches in both HumanEval and MBPP benchmarks."

> "As shown in Table 1, MetaGPT outperforms ChatDev on the challenging SoftwareDev dataset in nearly all metrics."

Register: present tense, active voice, name the system first, name what it beats, name the dataset, no hedging.

### Pattern B — ablation interpretation that asserts the design choice
> "The addition of roles different from just the Engineer consistently improves both revisions and executability."

Register: assert the *direction* of the effect ("improves both"), use the word the rubric measures ("revisions", "executability"). No "we observe a small lift of X points" softening.

### Pattern C — mechanism conclusion follows results
> "These results illustrate how our designed feedback mechanism can produce higher-quality code."

Register: results lead, mechanism interpretation closes the paragraph. "These results illustrate" is the pivot phrase from numbers to design claim.

### Pattern D — "As shown in" + bridge connective for second tables
> "Moreover, as shown in Table 1, MetaGPT outperforms ChatDev on the challenging SoftwareDev dataset in nearly all metrics."

Bridge connectives: `Moreover` · `Furthermore` · `Additionally` · `As shown in` · `It is evident that`. Used to chain a second table or figure to the first claim.

---

## 4. What to apply to Starlink §3.5

| MetaGPT pattern | Where to apply in §3.5 |
|---|---|
| §-lead in present tense with the claim first | Open §3.5.2, §3.5.3, §3.5.6 each with one sentence that states the empirical finding before any setup prose |
| "As shown in Table N" bridge | Replace longer table introductions (e.g. "The interesting result appears under jitter:") with the MetaGPT-style bridge |
| "Effectiveness of X" sub-subsection title | The "Effectiveness of declarative coverage" framing is implicit; do **not** rename the existing subsections, but use the phrase "the effectiveness of …" inside the §3.5.3 / §3.5.6 prose where it pays off |
| Results-then-mechanism closing sentence | Close §3.5.2 and §3.5.6 with "These results illustrate how / why …" sentences |

---

## 5. What **not** to copy from MetaGPT

- MetaGPT pretty-prints values with implicit precision (e.g. running time without confidence intervals). Starlink already does the right thing with `±` and n-of-12 framing; don't downgrade.
- MetaGPT does not report cross-vendor robustness, judge calibration, or jitter-injected reliability. Those are this thesis's contributions; they deserve to stay foregrounded, not shortened in the name of stylistic conformity.
- MetaGPT's tone is occasionally promotional ("higher-quality code"). Keep the conditional / claim-bounded register Starlink uses for the "+1.1 points is at the edge of judge resolution" admission.
