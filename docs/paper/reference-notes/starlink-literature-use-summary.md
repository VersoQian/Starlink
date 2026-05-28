# Starlink Literature Use Summary

This note records how the downloaded references are used in Chapter 2. It is not a replacement for the thesis text; it is a working map from literature to Starlink design choices.

| Reference | Main usable idea | How Starlink uses it | Thesis location |
| --- | --- | --- | --- |
| Bommasani et al. 2021, foundation models | Foundation models are broadly reusable, but homogenization can create shared failure points and deployment risks. | Starlink uses LLMs as generation engines, but wraps them with retrieval, shared state, coverage checks, and user inspection instead of trusting a single model response. | 2.2, 3.2, 3.4 |
| Zhao et al. 2023, LLM survey | LLMs have broad capabilities, but use cases require prompting, adaptation, evaluation, and tool support. | Starlink treats LLM capability as one component in a workflow. The system adds tools, state, and evaluation around the model. | 2.2, 3.4 |
| Luo et al. 2025, LLM agent survey | LLM agents can be analyzed through role design, planning/orchestration, memory, tool use, and evaluation. | Starlink maps these dimensions into explicit roles, LangGraph orchestration, workspace memory, tool bindings, and benchmark evaluation. | 2.3, 3.2 |
| Magentic-One 2024 | A generalist multi-agent system can use a central orchestrator to plan, assign work, and coordinate specialized agents. | Starlink uses a narrower supervisor pattern: the supervisor routes BMC tasks, checks missing dimensions, and invokes review when conflicts appear. | 2.3, 3.2.2 |
| Gao et al. 2023, RAG survey | RAG has evolved from simple index-retrieve-generate pipelines toward modular architectures with routing, memory, and task-specific components. | Starlink uses RAG at agent invocation time and connects retrieved chunks to canvas claims through citations. | 2.4, 3.3 |
| Singh et al. 2025, agentic RAG survey | Retrieval can become an agent-callable tool inside planning and multi-agent workflows. | Starlink binds knowledge bases to agents, allowing each agent to retrieve evidence from the sources relevant to its role. | 2.4, 3.3.3 |
| Yehudai et al. 2025, agent evaluation survey | Agent evaluation should consider trajectory, tool use, and failure attribution, not only final answers. | Starlink reports aggregate scores together with dimensional coverage, case-wise wins, traces, and observability mechanisms. | 2.6, 3.4, 4.5 |
| Du & Zhang 2025, generative AI and business-model change | Generative AI changes value creation, business-model formation, and value networks. | Starlink uses this as Chinese-language background for why AI-assisted business-model analysis is a relevant application area. | 2.1 |

Writing rule for Chapter 2: each subsection should answer two questions: what the literature contributes, and how Starlink uses that idea in the implemented system. Avoid making every subsection end with a gap claim.

## Detailed Reading Notes Used for Chapter 2

### Business model and decision-support literature

- Osterwalder and Pigneur define the Business Model Canvas as a fixed nine-part analytical artifact. Starlink uses this fixed structure as the target object of generation, validation, editing, and citation.
- Arnott and Pervan, together with design-science work by Hevner et al., support treating Starlink as a built and evaluated artifact rather than a conceptual proposal.
- Teece and Sjödin et al. support the idea that business models are design objects shaped by technology and feedback loops. Starlink applies this by turning AI-assisted business-model work into a structured software workflow.
- Du and Zhang provide Chinese-language background that generative AI changes value creation, value networks, and business-model formation. In the thesis, this supports why generative AI is relevant to BMC analysis, not as a new technical mechanism.

### LLM reasoning literature

- Bommasani et al. explain foundation models through emergence and homogenization: a broadly reusable model gives leverage, but its failure modes can propagate downstream. Starlink therefore treats the LLM as a component inside a workflow, not as the whole system.
- Zhao et al. organize LLM work around model capability, utilization, adaptation, and evaluation. Starlink follows the utilization/evaluation side: prompts, tools, retrieval, state, and experiments are wrapped around the model.
- CoT, Self-Consistency, ToT, GoT, ReAct, and Reflexion all show that intermediate steps, actions, search, or feedback can improve complex reasoning. Starlink does not copy any one prompting method directly; it uses the broader principle of staged reasoning through generator, critic, review, and synthesizer roles.

### Multi-agent literature

- Luo et al. describe LLM-agent systems through profile definition, memory, planning, action execution, orchestration, applications, and evaluation. Starlink maps these dimensions to concrete system parts: agent roles, workspace memory, LangGraph routing, tool bindings, BMC application, and benchmark evaluation.
- CAMEL, AutoGen, MetaGPT, and Magentic-One show different coordination styles: role-play, tool-integrated conversation, structured handoff, and central orchestration.
- Magentic-One is especially useful for explaining Starlink's supervisor. Its orchestrator plans, assigns work to specialized agents, tracks progress, and revises when needed. Starlink narrows that idea to BMC generation: the supervisor routes canvas agents, checks missing dimensions, and dispatches review when conflicts appear.
- Classical MAS work reminds the thesis not to treat more agents as automatically better. Starlink therefore keeps a bounded topology rather than open-ended multi-agent chat.

### RAG and hybrid retrieval literature

- Lewis et al. motivate retrieval as a way to ground generation in external knowledge.
- Gao et al. distinguish naive, advanced, and modular RAG. Starlink uses the modular view because retrieval is bound to agent roles and connected to memory, routing, and citations.
- Singh et al. describe Agentic RAG as retrieval inside planning, reflection, tool use, and multi-agent workflows. Starlink uses this idea by making knowledge bases callable by agents and by binding knowledge bases to relevant roles.
- DPR, ColBERT, and RRF support the dense retrieval and rank-fusion background. Starlink adds a bilingual lexical channel so Chinese-English business materials remain retrievable when embedding service quality degrades.

### Interface and observability literature

- Visual analytics and HCI guidelines support the idea that the interface should support reasoning, correction, and user control. Starlink uses this through editable canvas cells, citation chips, detail drawers, and HITL conflict handling.
- Luera et al. support the move beyond prompt-only interaction toward selection, object manipulation, and revision. Starlink applies this by making the canvas the main workspace instead of a decorative output view.
- Sculley et al. motivate operational visibility for complex ML systems. Yehudai et al. motivate evaluating and diagnosing agents through planning, tool use, memory, and trajectories. Starlink uses these ideas through tool, subgraph, and user-mention telemetry exposed in the canvas workspace.
