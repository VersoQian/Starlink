# CHAPTER 3: PROPOSED METHOD

This chapter presents the method used by Starlink to turn incomplete business input into a complete and inspectable Business Model Canvas. The starting point is the structure of the canvas itself. Its nine dimensions require different kinds of analysis, and a single language-model response can easily spend too much attention on obvious dimensions while leaving less salient ones underdeveloped. Starlink therefore treats canvas generation as a coordinated process rather than as one-shot text generation.

The method combines three parts. Specialized agents analyze different parts of the canvas. Their outputs are collected in a shared state so that missing dimensions and cross-dimension conflicts can be checked after each round. Retrieved evidence is attached to generated claims so that users can inspect, revise, and reuse the final canvas. In implementation, these mechanisms are realized with LangGraph, hybrid retrieval, and the canvas interface described in Chapter 4. The experiments at the end of this chapter examine whether the main mechanisms behave as intended: whether required dimensions are covered, whether retrieval remains useful when the embedding service degrades, and which components matter most in the measured setting.

## 3.1 System Overview

Figure 3-1 gives the overall structure of Starlink. The system is organized around a single workflow: the user begins with an incomplete business idea, the system enriches it with questions and retrieved evidence, specialized agents construct the canvas, and the result is displayed as an editable workspace. The reasoning core, retrieval layer, and canvas interface are parts of this workflow rather than independent features.

Figure 3-1: Starlink system overview with reasoning, retrieval, and canvas interaction layers.

The reasoning core provides division of labor. Instead of asking one model to fill all nine Business Model Canvas dimensions at once, Starlink assigns different analytical roles to different agents. Market-facing agents focus on customers, channels, and relationships. Product-facing agents focus on value propositions, key resources, key activities, and partnerships. Finance-facing agents focus on revenue streams and cost structure. Additional agents review conflicts, synthesize cross-cell relations, answer free-form questions, and write reports.

The retrieval layer provides evidence. Business analysis should not rely only on the model's internal knowledge, especially when the user has uploaded notes, reports, URLs, or company materials. Starlink retrieves relevant passages before generation and makes them available to the agents. The retrieval design combines semantic matching with a lexical channel that works well on mixed Chinese-English content. This lets the system continue retrieving useful evidence even when the embedding service is unstable.

The canvas interface makes the process inspectable. Generated results are not returned only as a block of text. Each claim appears inside a canvas cell, and citations allow users to move from a generated claim to the source evidence that supports it. The same workspace also shows conflicts, agent status, cell details, and report output. Chapter 4 describes this user-facing part in detail.

The full system is designed for a practical constraint: early business ideas are rarely complete. Starlink does not assume that the user already knows every customer segment, validation path, revenue mechanism, and risk. It helps complete these missing parts through questioning, evidence retrieval, multi-agent generation, and revision.

## 3.2 Multi-Agent Reasoning Core

The need for multiple agents comes from the canvas structure. Customer analysis, value-proposition design, partnership reasoning, and financial modeling do not rely on the same evidence or the same judgment. Starlink uses agent roles to keep these perspectives separate while still combining their outputs into one canvas.

LangGraph is used as the implementation framework for this coordination. The graph expresses which agent runs, which state it reads, where it writes its result, and when the next step should begin. This choice is practical rather than decorative: the system needs stable routing, shared state, replayable intermediate results, and a way to resume or inspect a run. LangGraph provides these mechanisms without requiring the system to implement a workflow engine from scratch.

Table 3-1 lists the agent roles. The supervisor sits above the worker agents and decides which role should run for the current user intent. The three domain generators produce the main canvas content. The critic checks for conflicts or weak assumptions. The synthesizer connects related cells and derives cross-cell insights. The opponent and moderator roles support limited review when a serious conflict is found. Utility agents handle general dialogue, deeper research, and report writing.

Table 3-1. Reasoning-core agent roles and their canvas interaction behavior.

The agent roster is not treated as a hyperparameter search result. It follows the analytical structure of the Business Model Canvas. The market group covers customer segments, channels, and customer relationships. The product group covers value propositions, key resources, key activities, and key partnerships. The finance group covers revenue streams and cost structure. The critic and synthesizer are needed because the canvas is not just nine independent text fields: choices in one dimension can contradict or depend on choices in another.

Table 3-2 shows how agent responsibilities cover the nine canvas dimensions. Reading down each column shows which agent is responsible for producing or checking that dimension. This matrix matters because it turns the fixed structure of the Business Model Canvas into a system-level requirement. If a required dimension has no responsible generator, the supervisor refuses to start. During a run, the same responsibility map is used to detect missing dimensions and send the right agent back to work.

Table 3-2. Capability coverage matrix.

### 3.2.1 Agents and Capabilities

Figure 3-2 visualizes the agent topology. The supervisor receives the user intent and routes the request to the appropriate agent group. For ordinary canvas generation, the three domain generators run in parallel. For conflict checking, the critic can run directly. For general conversation or deep research, the request bypasses the BMC generation path and uses the corresponding utility agent.

Figure 3-2: Reasoning-core topology: twelve worker agents under a supervisor router.

Each agent is configured with a role, prompt, model tier, tool bindings, and resource limits. Among these fields, the most important one is the responsibility list: it states which parts of the canvas the agent is expected to produce or review. The system uses this list both as documentation and as a runtime check.

The production ToolRegistry contains thirty-eight tools under the server environment configuration. These tools include data access, LLM-agent wrappers, analysis helpers, output rendering, control-flow helpers, and dimension-specific actions. Agents do not all receive the same tool set. Each agent is bound only to the tools it needs for its role. This keeps the tool surface small enough for stable prompting and prevents one agent from becoming responsible for the entire canvas.

Figure 3-3: Tool registry and agent-tool bindings.

The coverage check works in two places. At startup, the supervisor checks whether every BMC dimension has at least one responsible generator. During generation, the supervisor checks the shared state after each round. If a dimension is still empty, the supervisor identifies the responsible agent and includes that dimension in the next round's guidance. This repair step is bounded so that the system does not loop indefinitely. If a dimension is still incomplete after the budget is reached, the run records the remaining gap instead of hiding it.

Figure 3-4: Coverage check across startup and runtime phases.

This mechanism does not claim that every generated cell is correct. It claims something narrower and more useful: the system can detect when the fixed nine-cell structure has not been filled. A single-LLM baseline has no comparable mechanism. It can be asked to produce nine cells, but the system has no separate responsibility map or state check to enforce the request.

### 3.2.2 Coordination Mechanism

Dividing the work creates a coordination problem. Agents must not produce isolated answers that cannot be combined. Starlink solves this by using a shared state. The shared state can be understood as a structured worksheet: each agent writes to the fields it is responsible for, and the system merges the updates according to fixed rules.

The shared state stores the user question, workspace context, current round, agent guidance, retrieved evidence, generated canvas cells, conflicts, cross-cell insights, and graph edges. Domain outputs are merged by identifier so that a revised cell replaces the older version of the same cell without deleting unrelated cells. Control fields such as the current round or supervisor directive use the latest value. This keeps parallel generation safe: market, product, and finance agents can update their own fields without overwriting one another.

Definition 1 (merge by identifier). When two lists of generated objects are merged, objects with different identifiers are kept, and an object with the same identifier is replaced by the newer version. This rule is used for canvas cells, edges, agent avatars, and conflict objects.

Definition 2 (state update). Every agent result is applied to the shared state through the same update operation. The operation chooses the merge rule for each field and produces the next state. Because every update passes through this operation, the run can be replayed and inspected from its recorded state changes.

Routing connects the responsibility map to the actual run. The supervisor reads the current state, classifies the user intent, and chooses the next active agents. A canvas-generation intent usually activates the three domain generators. A conflict-detection intent activates the critic. A general question activates the general responder. If the critic reports a high-severity conflict, the review path can be entered before the canvas is accepted.

Figure 3-5: Supervisor routing flowchart.

The review path is limited by design. When a serious conflict is found, a role-specific opponent challenges the original position, and a moderator decides whether the conflict is resolved or requires revision. The result is written back into the shared state and considered by the supervisor in the next round. The loop is capped at three rounds because early prototypes showed little additional benefit after that point while adding cost and latency.

Figure 3-6: One round of the limited review loop.

Human review can run alongside this server-side process. When a high-severity conflict is raised, the user can accept the suggested repair, revise it, or mark it as resolved. The user's choice becomes part of the next supervisor cycle. This design keeps the system from treating automatic debate as a replacement for user judgment.

### 3.2.3 Output Stability and Provenance

The system needs generated content to be usable by the canvas, not merely fluent. An agent output is useful only if it can be parsed into the expected cell, citation, conflict, or report structure. Starlink therefore uses structured output whenever the model provider supports it. When strict structured output is not available, a tolerant parser handles common wrappers such as Markdown code fences before parsing JSON.

Generated cells also need a stable presentation shape. Each canvas cell carries a short summary, a fuller explanation, metadata, and optional citations. The summary lets the canvas remain readable. The fuller explanation is shown in the detail panel. Metadata records the responsible agent, confidence level, domain, tags, and stage. This separation avoids overloading the main canvas view while keeping detailed reasoning accessible.

Provenance is handled through citation markers. When a claim is supported by retrieved evidence, the generated text includes a reference to the source document and chunk. If a claim is not supported by retrieved evidence, it is marked as such. This rule makes unsupported assumptions visible rather than silently mixing them with sourced claims.

Figure 3-7: Citation lifecycle from retrieved evidence to canvas interaction.

### 3.2.4 Memory and Evolution

Starlink also uses memory to make later runs more consistent with earlier work. Memory is stored at different scopes. Session memory is visible only within one conversation. Workspace memory is shared across the current workspace. User memory can follow the same user across workspaces after consolidation.

Memory is not treated as an unrestricted prompt dump. The system retrieves relevant memory items and renders them into a compact context block. This prevents older information from overwhelming the current task while still allowing recurring preferences, accepted assumptions, and prior decisions to influence later generation.

This memory layer supports progressive work. A user may refine a customer segment in one session, upload a new report later, and then ask the system to revise the canvas. The system can use prior accepted content and newly retrieved evidence together instead of starting from scratch.

### 3.2.5 Canvas Generation Flow

Algorithm 1 summarizes the canvas-generation flow. The user request is converted into a shared state containing the question, workspace context, bound knowledge bases, and available memory. The supervisor classifies the intent and selects the active agents. For canvas generation, the market, product, and finance agents generate their assigned dimensions, using retrieved evidence where available. The critic checks the combined result. Serious conflicts can trigger the limited review path. The synthesizer then adds cross-cell relations and the final canvas is persisted and sent to the frontend.

Algorithm 1: Progressive Business Model Canvas generation.

The important property of this flow is that every partial result becomes part of the same shared state. The system therefore does not depend on one long response containing the whole answer. It can check what has already been produced, identify what is missing, and revise only the affected parts.

## 3.3 Bilingual Hybrid Retrieval

Generated business claims need evidence. This is especially important when users upload company notes, market reports, product documents, or URLs. Starlink retrieves relevant passages before agent generation and exposes them as citations in the generated cells.

The retrieval design combines two channels. The semantic channel uses embeddings to find passages that are close in meaning to the query. The lexical channel uses direct text matching and is designed for mixed Chinese-English material. Chinese text is split into character bigrams, while Latin text is split into words above a minimum length. The two ranked lists are combined with Reciprocal Rank Fusion, a standard rank-fusion method.

Figure 3-8: Hybrid retrieval pipeline.

The lexical channel is not introduced to replace semantic retrieval. Under healthy conditions, semantic retrieval is already strong. The lexical channel is a reliability measure. If the embedding service degrades or returns low-quality fallback vectors, direct lexical matches can still recover evidence that would otherwise be lost.

### 3.3.1 Pipeline and Ingestion

Starlink supports text seeds, URL fetches, file uploads, and administrative SQL insertion as ingestion paths. Uploaded materials are chunked into passages with overlap so that retrieval can return focused evidence rather than entire documents. URL ingestion includes safeguards against server-side request forgery and DNS rebinding.

Each chunk keeps its document identifier, workspace identifier, visibility setting, source metadata, text content, and embedding vector when available. These fields allow retrieval to respect workspace boundaries and support citation tracing after generation.

### 3.3.2 Bilingual Tokenization and Rank Fusion

The bilingual tokenizer is deliberately simple. It avoids language detection and instead applies Unicode-aware rules. CJK characters contribute overlapping bigrams. Latin sequences contribute lowercase words after stop-word and length filtering. This produces useful lexical keys for bilingual documents where Chinese and English terms often appear together.

Semantic and lexical results are combined by Reciprocal Rank Fusion. RRF rewards chunks that rank well in either channel and does not require score normalization between cosine similarity and lexical overlap. This matters because the two channels produce different kinds of scores. A chunk can survive when it has a strong semantic match, a strong lexical match, or both.

Algorithm 2: Hybrid retrieval for one query.

Under healthy embedding service, the semantic channel often dominates. Under forced embedding degradation, the lexical channel carries most of the remaining recall. The goal is therefore retrieval reliability rather than a guaranteed quality improvement in every condition.

### 3.3.3 Agent-KB Binding and Execution Trace

Knowledge bases are explicitly bound to agents. A compliance knowledge base may be useful for the critic and product agent, while an industry-trend knowledge base may be more useful for deep research. Bindings can enable automatic retrieval on every invocation, or they can remain available for optional tool use.

The automatic mode matches user expectation: binding a knowledge base to an agent should make that agent use the knowledge base. To prevent prompt growth, each invocation has a bounded evidence budget. The system retrieves only the top passages needed for the current agent call.

A complete canvas run therefore has a traceable evidence path. The supervisor selects the agents. Each bound agent retrieves evidence. The generator emits canvas cells with citation markers. The critic and synthesizer read the combined state. The final canvas is persisted and sent to the frontend. The same path is used in the evaluation below; only the case content and retrieved evidence change.

## 3.4 Experiments and Analysis

The experiments in this chapter check whether the proposed mechanisms behave as intended. They focus on parts that can be measured directly: retrieval stability, dimension coverage, and the contribution of major components. The frontend workflow is demonstrated separately in Chapter 4.

### 3.4.1 Experimental Setup

The evaluation follows a design-science view of the system. Starlink is the implemented artifact. A single-LLM runner serves as the baseline. Agent-as-Judge scoring is used to compare generated canvases under a fixed rubric. The case set contains twelve YC seed-stage companies: Stripe, Airbnb, Replit, Pebble, Coursera, Notion, Coinbase, DoorDash, Twitch, Segment, Brex, and Substack.

Each case contains a business question, a small knowledge base, and a ground-truth Business Model Canvas constructed from public materials. The ground truth records must-cover concepts for each dimension. The judge scores each of the nine dimensions from 0 to 3. A score of 0 means the dimension is missing or wrong. A score of 1 means partial coverage. A score of 2 means the expected concepts are covered with plausible specifics. A score of 3 means the answer adds defensible nuance beyond the ground truth.

The single-LLM baseline sends one templated prompt to one model and parses the returned nine-cell canvas. It does not use retrieval, agent decomposition, shared state, or cross-step revision. The Starlink variants toggle retrieval, the critic, and the review loop to test the effect of major components. The retrieval evaluation compares hybrid retrieval with pure vector retrieval under healthy and degraded embedding conditions.

### 3.4.2 Retrieval Quality and Embedding-Service Degradation

The retrieval evaluation uses three knowledge bases and twenty BMC queries drawn from the same corpus. For each query, relevant chunks are marked by reading the indexed corpus and identifying passages that contain must-cover concepts for the target dimension. Recall@5 measures how many relevant chunks appear in the top five results.

Under healthy embedding service, vector retrieval already performs strongly. Top-1 retrieval is correct on every query, and the hybrid retriever has little room to improve the score. Under forced embedding degradation, the difference becomes visible. The hybrid retriever recovers +28.4% recall@5 over the pure-vector baseline, as shown in Table 3-5.

Table 3-5. Retrieval comparison under healthy and degraded embedding conditions.

This result supports the intended role of the lexical channel. It is not a universal quality booster. It is a reliability measure that protects evidence retrieval when the semantic channel becomes unreliable.

### 3.4.3 Quality Comparison

The quality comparison reports aggregate judge score, per-dimension coverage, and case-wise wins. This is necessary because the aggregate mean can hide structural omissions. A canvas can receive a reasonable total score while still leaving one important dimension empty.

Table 3-6. Results of quality comparison.

On the stronger DeepSeek-V3 backend with twelve cases, Starlink and the single-LLM baseline have close aggregate means. The mean difference is +0.6 in favor of Starlink, and the one-sided sign test on the non-tied cases gives p = 0.11. The stronger finding is structural: Starlink produces content for all nine dimensions on every completed run, while the baseline produces no content for Key Partnerships on every completed run. On this backend, Starlink's advantage is therefore not a large mean-score jump. It is the recovery of a required canvas dimension.

On the mid-capability MiniMax-M2.5 backend, the gap becomes larger. Starlink leads by +6.8 aggregate points on the completed runs, and the baseline systematically leaves Key Partnerships, Key Activities, and Key Resources under-covered. Three rate-limited cases are treated as ties because both runners were affected. The interpretation is that the multi-agent structure helps more when the underlying model is more likely to under-allocate attention to less salient canvas dimensions.

Together, the two backends support a bounded claim. Starlink does not always produce a large aggregate-score advantage over a strong single model. Its clearer contribution is structural coverage: the system is less likely to leave required dimensions empty, and that benefit becomes more visible when the model backend is less capable.

### 3.4.4 Design Ablation

The ablation tests retrieval grounding, the critic, and the limited review loop. Five conditions are compared on a six-case set that contains two normal BMC cases and four hidden-conflict cases. The hidden conflicts are written as ordinary business assumptions in the user prompt. The corresponding conflict note is used only during evaluation, so the tested system is not told directly that a conflict exists.

The experiment uses a composite rubric because the mechanisms are designed for different effects. Coverage measures whether the nine BMC dimensions and must-cover concepts appear. Evidence support measures whether important claims are linked to relevant source passages. Consistency measures whether the final canvas still contains cross-cell contradictions. Repair quality measures whether a detected problem is revised in a focused way without unnecessary rewriting. The composite score is calculated as:

Composite Score = 0.30 x Coverage + 0.25 x Evidence Support + 0.25 x Consistency + 0.20 x Repair Quality.

Table 3-7 reports the aggregate result. Full Starlink obtains a composite score of 4.53. Removing retrieval grounding produces the largest drop, from 4.53 to 3.48. The evidence subscore falls from 4.00 to 1.83, which matches the intended role of RAG: it supplies source-backed concepts and citation paths for the generated canvas. The minimal condition also falls below full, with a composite score of 3.84 and a lower evidence score of 2.58. This shows that the mechanisms are not only decorative additions to the generation flow.

The critic has a more targeted effect. Removing it lowers the composite score from 4.53 to 4.02. The consistency score drops from 5.00 to 4.33, and repair quality drops from 3.92 to 2.83. This is the expected direction: the critic is not mainly a coverage mechanism. Its purpose is to expose contradictions across canvas cells and give the supervisor a reason to route revision work.

The debate result needs a more careful reading. The no-debate condition has a composite score of 4.57, slightly above full by 0.04. This difference is too small to treat as evidence that debate improves the final canvas in this setting. It also should not be read as proof that debate is harmful or useless. In Starlink, the limited debate loop is a repair-review mechanism that runs after the critic surfaces a conflict. On this small set, the final-canvas rubric rewards resolved outputs, but it does not strongly distinguish whether the repair came from ordinary revision or from adversarial review. The result therefore suggests that the debate loop is not a reliable mean-score booster under the current measurement. Its value is better framed as a bounded review step for disputed repairs, not as a guaranteed quality improvement.

Figure 3-10 visualizes the same result. The left panel shows the composite scores. The right panel separates evidence, consistency, and repair. This separation is important because a single mean score can hide which mechanism actually changed. Retrieval mainly affects evidence support. The critic mainly affects consistency and repair. Debate has a weaker measured effect in this run.

Table 3-7. Composite design ablation on normal and hidden-conflict cases.

Figure 3-10: Composite design ablation with mechanism-sensitive subscores.

The ablation therefore supports a limited conclusion. Retrieval grounding is the clearest measured contributor. The critic contributes to cross-cell consistency and repair routing. The limited debate loop remains useful as a process safeguard when repairs are contested, but this experiment does not show a stable aggregate-score gain from debate alone.

## 3.5 Chapter Summary

This chapter described how Starlink constructs a Business Model Canvas from incomplete user input. The reasoning core divides the canvas among specialized agents. The shared state collects their outputs and makes missing dimensions visible. The retrieval layer attaches evidence to generated claims and remains useful when the embedding service degrades. Together, these mechanisms support canvas construction as a staged, evidence-grounded, and inspectable process.

The experiments support this design with measured but limited claims. On the strong DeepSeek-V3 backend, aggregate scores are close, but Starlink recovers the missing Key Partnerships dimension on every completed case. On the mid-capability MiniMax-M2.5 backend, the gap widens to +6.8 points on the completed runs. Under forced embedding degradation, hybrid retrieval recovers much of the recall lost by pure vector retrieval. The ablation suggests that retrieval grounding is the clearest measured contributor, while the critic improves consistency and repair routing. The limited debate loop is best treated as a bounded review step rather than as a guaranteed mean-score booster.

Read against the gaps identified in Chapter 2, this chapter addresses the reasoning and retrieval parts of the system. It explains how Starlink divides work, checks canvas coverage, attaches evidence, and evaluates these mechanisms. The next chapter turns to the user-facing system: how the canvas interface, citations, memory, reports, and runtime status make the generated result usable in practice.
