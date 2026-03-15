## 2 Datasets and Evaluation Metrics

### 2.1 Datasets and Benchmarks

In the study of generative business decision support systems, the selection of datasets and benchmarks is essential for evaluating whether a system can perform reliable reasoning, use evidence correctly, and produce practically useful analytical outputs. Unlike traditional recommendation or general question-answering tasks, there is still no unified benchmark specifically designed for a generative business canvas system that simultaneously evaluates collaborative reasoning, knowledge grounding, process transparency, visual structuring, and user intervention. Therefore, existing studies usually rely on a combination of business-oriented reasoning benchmarks, financial question-answering datasets, business intelligence benchmarks, and manually constructed business cases [1][2][3][4].

A representative benchmark in this area is **BizBench**, which is designed to assess quantitative reasoning ability in business and finance scenarios [1]. Its significance lies in the fact that business analysis is not only a language understanding problem. Many tasks require a system to process numerical information, extract intermediate values from tables or reports, interpret formulas, and complete multi-step reasoning procedures. In this sense, BizBench provides strong evidence that business-oriented intelligent systems should be evaluated in a way that reflects the mixed nature of domain reasoning, where textual understanding, numerical operations, and professional knowledge are tightly intertwined [1].

Another important benchmark is **FinanceBench**, which focuses on evidence-grounded financial question answering [2]. Built on public company filings and expert-supported evidence annotations, FinanceBench emphasizes not only whether a system can provide a correct answer, but also whether the answer can be traced back to the original financial document [2]. This is highly relevant to business decision support, because many practical tasks rely on annual reports, SEC filings, earnings statements, and market disclosures. In such scenarios, unsupported but fluent answers are not useful for real decision-making, which makes evidence-grounded evaluation particularly necessary [2][7].

Compared with FinanceBench, **FinanceReasoning** places even greater emphasis on numerical reasoning and multi-step financial inference [3]. Its contribution lies in improving the credibility, comprehensiveness, and challenge level of financial reasoning tasks. This benchmark is especially important because a large portion of business analysis does not stop at factual retrieval. Instead, it requires ratio analysis, trend estimation, cost comparison, profitability assessment, and scenario-based calculation. Therefore, FinanceReasoning better reflects the analytical depth required by realistic business support systems [3].

For business intelligence scenarios, **BI-Bench** provides another useful perspective [4]. Unlike pure QA datasets, BI-Bench evaluates whether systems can generate meaningful business insights for **descriptive, diagnostic, predictive, and prescriptive** analytical tasks [4]. This design is important because it aligns more closely with real decision support workflows. Business users are often more concerned with the relevance, depth, and usefulness of analytical outputs than with exact matching of short answers. In this sense, BI-Bench represents a shift from answer-centric evaluation toward insight-centric evaluation [4].

In addition, broader benchmark suites such as **FinBen** reflect a growing trend toward multi-task financial evaluation [5]. Instead of measuring only one capability, these benchmark collections combine multiple task types, including QA, reasoning, and document understanding. This trend is significant for the current topic because a generative business canvas system is expected to support heterogeneous analytical tasks rather than only one narrow benchmark category [5].

However, current datasets still remain fragmented. Existing business and finance benchmarks often focus on one particular aspect, such as factual QA, numerical reasoning, BI insight generation, or document interpretation [1][2][3][4][5]. Very few datasets directly evaluate a system as an integrated analytical workspace in which multiple agents collaborate, external knowledge is dynamically incorporated, and reasoning is represented visually for user intervention. For this reason, many studies supplement public benchmarks with self-constructed business case collections based on annual reports, market news, company profiles, product descriptions, industry analyses, and strategic planning materials [1][4][16][17].

Overall, current datasets are sufficient for evaluating business-oriented reasoning, financial QA, and business intelligence outputs at a partial level, but they are still insufficient for directly assessing a generative business canvas system as a transparent, interactive, and collaborative decision support environment. This limitation also indicates that future work may need to build more comprehensive benchmark settings that integrate benchmark-style reasoning tasks with scenario-based analytical workflows and visual interaction evaluation [4][16][17].

### 2.2 Evaluation Metrics

The evaluation of a generative business canvas system should not rely on a single metric. Since this type of system integrates large language model reasoning, multi-agent collaboration, knowledge grounding, and visual interaction, existing studies suggest that a complete evaluation framework should include correctness metrics, grounding metrics, collaboration metrics, canvas-oriented metrics, human-centered metrics, and efficiency metrics [6][8][9].

#### 2.2.1 Correctness Metrics

For benchmark-style reasoning and question-answering tasks, the most commonly used automatic metrics include **Accuracy**, **Exact Match (EM)**, and **F1 Score** [2][3][6]. Accuracy measures the proportion of correctly solved tasks and can be written as:

\[
\mathrm{Accuracy} = \frac{N_{\mathrm{correct}}}{N_{\mathrm{total}}}
\]

where \(N_{\mathrm{correct}}\) denotes the number of correct predictions and \(N_{\mathrm{total}}\) denotes the total number of evaluated samples.

Exact Match is suitable when the predicted answer is expected to exactly match the reference answer. F1 Score is more appropriate when partial overlap between prediction and reference answer should also be considered, especially in evidence-based or extraction-style tasks [2][6]. These metrics are widely used in financial QA and benchmark-based reasoning studies because they provide a clear measure of final output correctness.

However, such metrics mainly evaluate the final answer, not the reasoning path that leads to it. For this reason, they are necessary but insufficient for evaluating a business canvas system.

#### 2.2.2 Grounding and Reliability Metrics

Because business decision support requires evidence-based conclusions, correctness metrics should be complemented by **grounding-related metrics**. These include **grounding accuracy**, **evidence support rate**, **faithfulness**, and **hallucination rate** [2][7][8].

Grounding accuracy evaluates whether the generated analysis is supported by retrieved documents or structured external knowledge. Evidence support rate focuses on how much of the system’s output can be traced to verifiable evidence. Faithfulness measures whether the generated conclusion remains consistent with the supporting evidence instead of introducing distortions. Hallucination rate reflects how often the system produces unsupported or fabricated information [7][8].

These metrics are particularly important in business and finance scenarios. A response may appear logically coherent while still being unreliable if the evidence chain is weak or incorrect. Therefore, when evaluating a system designed for business analysis, evidence quality should be treated as a core dimension rather than an optional add-on [2][7][8].

#### 2.2.3 Task Completion and Static Collaboration Metrics

For multi-agent systems, output correctness alone does not capture the quality of collaboration. A commonly used metric is **Task Success Rate**, which measures whether a complete task is solved successfully rather than whether only a local answer is correct [9][10][11]. It can be written as:

\[
\mathrm{Task\ Success\ Rate} = \frac{N_{\mathrm{success}}}{N_{\mathrm{tasks}}}
\]

where \(N_{\mathrm{success}}\) is the number of successfully completed tasks and \(N_{\mathrm{tasks}}\) is the total number of evaluated tasks.

Another useful metric is **reasoning consistency**, which reflects whether multiple agents converge toward a coherent conclusion:

\[
\mathrm{Consistency} = \frac{1}{n}\sum_{i=1}^{n} I\left(y_i = y^{*}\right)
\]

where \(y_i\) denotes the output of the \(i\)-th agent, \(y^{*}\) denotes the final agreed conclusion, and \(I(\cdot)\) is the indicator function. Consistency is important because a collaborative system should ideally reduce contradictions among partial analyses [9][11]. Nevertheless, consistency is still a relatively static indicator. It tells us whether agents eventually agree, but not how efficiently or how robustly they reach that agreement.

#### 2.2.4 Dynamic Collaboration Metrics for Multi-Agent Systems

To better capture the practical value of multi-agent collaboration, the evaluation framework should also include **dynamic collaboration metrics**. These metrics reflect the efficiency and corrective capability of the collaborative process rather than only its final state [9][10][11][12].

One useful indicator is **Turn-to-Consensus**, which measures the average number of interaction rounds required for agents to reach a stable conclusion:

\[
\mathrm{Turn\text{-}to\text{-}Consensus} = \frac{1}{M}\sum_{i=1}^{M} T_i
\]

where \(T_i\) denotes the number of interaction rounds required to reach consensus in task \(i\), and \(M\) is the total number of tasks. A lower value indicates that the system can coordinate more efficiently.

Another important indicator is **Correction Rate**, which measures the proportion of incorrect or weak initial conclusions that are successfully revised during collaboration:

\[
\mathrm{Correction\ Rate} = \frac{N_{\mathrm{corrected}}}{N_{\mathrm{errors}}}
\]

where \(N_{\mathrm{errors}}\) denotes the number of identified initial errors and \(N_{\mathrm{corrected}}\) denotes the number of such errors that are successfully corrected through multi-agent interaction.

A related measure is **Disagreement Resolution Rate**, which evaluates how often divergent views among agents can eventually be reconciled into a coherent analytical output. These dynamic indicators are important because the value of multi-agent reasoning lies not only in having multiple viewpoints, but also in how effectively those viewpoints are negotiated, refined, and corrected [10][11][12].

#### 2.2.5 Canvas-Oriented Evaluation Metrics

Since the proposed system is a **business canvas system** rather than a pure text-based reasoning engine, evaluation must also include metrics related to the quality of canvas representation itself. This dimension is often missing in existing benchmarks, but it is essential for a system whose core interaction carrier is a visual and spatial workspace [13][14][15][16][17].

One important criterion is **Spatial Coherence**, which measures whether nodes and relations are arranged in a clear and interpretable way on the canvas. Poor layout design may obscure otherwise valid analysis, while good layout can improve process traceability and user understanding [15][16][17].

Another criterion is **Module Alignment**, which evaluates whether business modules are logically connected in a meaningful way. For example, in a business model context, customer segments should align with value propositions, channels, and revenue streams instead of appearing as isolated analytical fragments. A simplified form of module alignment can be written as:

\[
\mathrm{Canvas\ Alignment} = \frac{N_{\mathrm{aligned}}}{N_{\mathrm{relations}}}
\]

where \(N_{\mathrm{aligned}}\) denotes the number of logically valid inter-module relations and \(N_{\mathrm{relations}}\) denotes the total number of evaluated relations.

A third criterion is **Visual Readability**, which concerns whether the canvas is easy to inspect and interpret. In practice, this may depend on factors such as edge crossings, node overlap, and distribution balance:

\[
\mathrm{Visual\ Readability} = f(C, O, D)
\]

where \(C\) denotes edge crossings, \(O\) denotes node overlap, and \(D\) denotes distribution balance across the canvas. Although this expression is conceptual, it reflects the important idea that the quality of visual organization should itself be treated as part of system performance [13][15].

A fourth criterion is **Process Traceability on Canvas**, which measures whether a user can easily follow the path from evidence to intermediate reasoning nodes and then to final recommendations. This criterion is especially important because one of the major motivations of a business canvas system is to make the reasoning process visible and inspectable rather than hiding it behind a single output [14][16][17].

Taken together, these metrics imply that the canvas should not be treated as a decorative interface layer. Its spatial organization, semantic alignment, and visual logic are part of the analytical effectiveness of the system itself.

#### 2.2.6 Human-Centered Metrics

In decision support, human evaluation remains indispensable. A system may achieve acceptable benchmark scores while still failing to be useful in practice if users cannot understand, trust, or control it. Therefore, recent literature increasingly emphasizes **human-centered criteria**, including:

- usefulness of the generated analysis
- interpretability of intermediate reasoning
- transparency of evidence-conclusion relations
- controllability of the interaction process
- user trust in the final recommendation [13][14][15]

For a business canvas system, these criteria are especially important because the goal is not simply to automate analysis, but to support human-AI collaborative reasoning.

#### 2.2.7 Efficiency Metrics

Finally, efficiency should also be evaluated. Since multi-agent collaboration, retrieval, and graph-based reasoning may increase computational complexity, practical systems should be assessed in terms of **latency**, **token consumption**, and **cost per task** [8][9][12]. This is important because an analytically stronger system may still be impractical if it introduces excessive cost or response time.

### 2.3 Summary of Evaluation Perspective

In summary, the current literature suggests that the evaluation of a generative business canvas system should be fundamentally multi-dimensional. It should cover:

- correctness of analytical results
- grounding and evidence support
- task completion and collaborative stability
- dynamic coordination efficiency
- canvas-level spatial and semantic quality
- human-centered usefulness and transparency
- computational efficiency [4][8][9][13][15]

This broader evaluation perspective reflects an important shift in recent research. The problem is no longer only whether a model can produce a correct answer, but whether an integrated system can deliver a reliable, interpretable, evidence-grounded, and visually manageable analytical process for real business decision support.
