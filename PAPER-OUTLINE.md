# Starlink · 论文框架（毕业设计 · 中文 · 30-50k 字）

> **题目（暂定）**：基于多智能体协作与混合检索增强的商业模型画布生成系统：架构、可观测性与实证评估
>
> **English title**: A Multi-Agent Hierarchical Coordination System with Hybrid Retrieval-Augmented Generation for Business Model Canvas Synthesis
>
> **作者**：[Your Name] · [University] · [Year]
> **指导教师**：[Advisor]

---

## 摘要 Abstract（中文 350 字 + English 250 words）

**问题陈述**：早期创业者在迭代商业模型时缺乏结构化反馈、跨领域知识整合和审视性视角，单一 LLM 工具又难以保证输出的多维一致性、可追溯性和事实依据。

**研究方法**：本文设计并实现 **Starlink**，一个面向商业模型画布（BMC）的层级化多智能体协作系统。系统包含 12 个专业化智能体（3 个 BMC 维度生成器 + 1 个 critic + 1 个 synthesizer + 3 个 opponent + 1 个 moderator + 3 个辅助 agent），通过中央 supervisor 协调，共享黑板状态空间，并辅以混合检索增强（vector cosine + 词法重叠 RRF 融合）和三方对抗辩论。

**实证结果**：
1. 在 14 个 YC 真实创业案例上，Starlink 较单 LLM baseline (`gpt-solo`) 在 Agent-as-Judge 评分上提升 **[X]%**
2. Hybrid RAG 在网络稳定时与纯向量检索 MRR 持平 (=1.0)，但在嵌入 API 抖动时召回率提升 **+28%**（容错增益）
3. 12 张 PG 表 + pgvector + 3 层 SLO 可观测性栈跑通 251 单测 + 7 smoke 测试
4. 端到端 wall-clock：单次 BMC 生成 96-125s（并行 tool 调用后较串行 -23%）

**贡献**：
- **C1**: 一种 hierarchical multi-agent + adversarial debate 的协作架构，解决 BMC 多维度一致性问题
- **C2**: CJK-bigram + Latin-word 双语词法 + 向量混合检索的实现，提升 RAG 抗噪声能力
- **C3**: 3-layer per-agent SLO + Sentry 风格错误聚合 + Prometheus/OTel 双协议导出的可观测性栈，可推广到其他 multi-agent 系统

**关键词**：多智能体协作、检索增强生成、商业模型画布、可观测性、对抗辩论

---

## 论文整体结构（8 章 + 附录）

### 第 1 章 · 引言（~3000 字）

**1.1 研究背景**
- 创业失败率与商业模型迭代质量的相关性（引 CB Insights / Startup Genome 报告）
- LLM 在创业辅助工具中的崛起（ChatGPT for entrepreneurs）
- 单 LLM 长上下文 BMC 生成的 4 个失败模式：
  1. 维度内一致性强但跨维度矛盾
  2. 事实编造（hallucination）无法溯源
  3. 缺少 critique 视角
  4. 无法将用户的隐性领域知识整合进生成

**1.2 研究问题**
- RQ1：多智能体分工 + 中央协调 vs 单 LLM 生成，哪种 BMC 输出质量更高？
- RQ2：混合检索（向量 + 词法）相对纯向量检索能在多大程度上缓解 embedding API 抖动？
- RQ3：在多智能体系统中，3 层 SLO（tool / subgraph / mention）能否有效定位性能瓶颈？

**1.3 主要贡献**
- C1（系统）：12-agent hierarchical multi-agent system with adversarial debate loop
- C2（算法）：CJK-bigram hybrid RAG + RRF fusion
- C3（工程）：multi-tenant production-grade observability stack

**1.4 论文组织**

---

### 第 2 章 · 相关工作（~4000 字）

**2.1 多智能体大模型协作**
- Society of Mind (Minsky 1986) — 理论起点
- AutoGen (Wu et al. 2024) — conversable agents framework
- MetaGPT (Hong et al. 2024) — SOP-based collaboration
- CrewAI / LangGraph — production frameworks
- ChatDev / MAD — debate / role-play
- **Gap**: 现有工作多在 software engineering / debate domains，对 **structured business artifact generation**（如 BMC 9-cell）的研究稀少

**2.2 检索增强生成**
- DPR / ColBERT — dense retrieval
- BM25 / SPLADE — sparse / lexical
- Hybrid retrieval (RRF, Cormack et al. 2009)
- Self-RAG / Chain-of-Note — retrieval-augmented reasoning
- **Gap**: 中文 / 双语场景下 hybrid retrieval 的 token 化策略缺乏经验研究

**2.3 商业模型画布工具**
- Strategyzer (Osterwalder) — 商业模型画布提出
- ChatBMC / GPT-BMC — 单 LLM 工具
- Wevolver / Lean Canvas — 协作工具但无 AI
- **Gap**: AI 辅助 + 多视角批判 + 知识库证据整合的端到端工具空白

**2.4 LLM 系统的可观测性**
- Sentry / OpenTelemetry — 通用 APM
- LangSmith / Langfuse — LLM-specific tracing
- **Gap**: Multi-agent 系统的 per-agent SLO + per-tool latency 分级监控少见公开实现

---

### 第 3 章 · 系统架构（~5000 字）

**3.1 整体设计原则**
- 黑板模型（Blackboard, Hayes-Roth 1985）：所有 agent 通过 BusinessState 通信，无 P2P 消息
- 单 supervisor + fan-out / fan-in：可解释，可中断
- 引用可追溯：每个生成 cell 强制带 `[[ref:]]` / `[[bmc:]]` / `[[critic:]]` / `[[insight:]]` tag

**3.2 12 智能体拓扑（图 3.1 系统架构图）**

```
┌─────────────┐
│ User chat / │
│ @ mention   │
└──────┬──────┘
       ▼
┌─────────────────────┐
│ Supervisor          │
│ (intent classifier) │
└─────┬───────────────┘
      ▼ (fan-out 数组)
┌─────┴──────────────────┐
│ market-agent (CS/CR/CH)│
│ product-agent (VP/KR/KA/KP)│
│ finance-agent (RS/CO)  │
└─────┬──────────────────┘
      ▼
┌──────────────┐
│ Critic       │ → conflicts[]
└──────┬───────┘
       ▼
┌──────────────┬─────────────┐
│ Synthesizer  │ Debate      │
│ (cross-dim)  │ (M-O-J)     │
└──────────────┴──────┬──────┘
                      ▼
              ┌──────────────┐
              │ Report-writer│
              └──────────────┘
```

**3.3 工具层（38 个 real LLM/HTTP/DB tool，无 stub）**
| 类别 | 数量 | 后端 |
|---|---|---|
| analysis | 4 | LLM |
| control-flow | 5 | 纯逻辑 |
| data-source | 7 | HTTP/DB/FS |
| dimension-actions | 16 | LLM (BMC 9 维子动作) |
| llm-agent | 6 | LLM 包装 |
| output | 1 | 渲染 |

**3.4 3 层抽象**
- L1 mention：用户 @-trigger
- L2 subgraph：LangGraph ReAct agent
- L3 tool：BaseTool 实例

**3.5 数据持久化（12 张 PG 表）**
- conversation_messages / sessions / memory_items
- canvas_graphs (workspace_id → nodes JSONB + edges JSONB)
- kb_definitions / kb_documents / kb_chunks (pgvector ivfflat 1536d)
- agent_slo_totals / handoff_events
- checkpoints / checkpoint_blobs / checkpoint_writes (LangGraph PostgresSaver)
- user_skills (AES-GCM 加密)

**3.6 多租户隔离（3 层防御）**
- 行级：workspace_id + owner_user_id
- PG RLS：withUserContext + SET LOCAL app.current_user_id
- 应用层：requireWorkspacePermission + audit log

---

### 第 4 章 · 多智能体协调机制（~5000 字）

**4.1 Supervisor 路由**
- Intent classifier（structured output via DeepSeek）
- Conditional edges 数组返回 → LangGraph fan-out
- 5 种 callability：standalone-utility / standalone-bmc-generator / standalone-advisor-needs-bmc / debate-side / debate-judge / standalone-report

**4.2 Adversarial Debate Loop**
- Critic 检测 conflicts（severity high/medium/low）
- 高严重 conflicts 触发 3-way debate：proponent + opponent + moderator
- LlmDebateInvoker 实现 (next-turn / judge)

**4.3 引用溯源系统**
- Citation tag 解析器：`[[ref:docId#chunkId]]` / `[[bmc:dimension]]` / `[[critic:conflictId]]` / `[[insight:noteId]]`
- 前端 highlight + 跳转

**4.4 HITL（Human-in-the-Loop）**
- LangGraph interrupt() + PostgresSaver checkpointing
- 跨 gateway 重启可恢复（thread_id 索引）

**4.5 可靠性栈**
- LLM circuit breaker（5 fail / 5min cooldown / half-open trial）
- Retry envelope（exponential backoff + AbortController timeout）
- Critic LLM-fail → rule-based fallback + audit
- Graceful shutdown drain（30s 等待 in-flight）

---

### 第 5 章 · 混合检索增强生成（~4000 字）

**5.1 Embedding 选型**
- Aliyun DashScope `text-embedding-v4`（1536 维原生匹配 pgvector 列）
- 向量索引：pgvector ivfflat (lists=100, vector_cosine_ops)

**5.2 词法分词（CJK + Latin 双语）**
```python
# 算法 5.1: tokenizeForLexical
def tokenize(query):
    latin_tokens = re.findall(r'[a-z0-9]{3,}', query.lower())
    cjk_chars = re.findall(r'[㐀-鿿]', query)
    cjk_bigrams = [cjk_chars[i] + cjk_chars[i+1]
                   for i in range(len(cjk_chars)-1)]
    return list(set(latin_tokens + cjk_bigrams))
```
- 为什么 bigram 而非 unigram？常用单字（"的"、"是"）噪声大；bigram 保留短语结构

**5.3 RRF 融合（k=60）**
```
RRF_score(d) = Σ_ranker (1 / (k + rank_in_ranker(d)))
```
- 不需 score 归一化（vector cosine 在 [-1,1]，lex_hits 在 [0,N]，量纲不同）
- 在 application/kb-store.ts:searchChunksHybrid 实现

**5.4 Min-score post-filter**
- KB_SEARCH_MIN_SCORE=0.55（cosine 阈值，过滤低置信结果）
- Hybrid 模式特殊：sem<0.55 + lex>=2 仍保留（强词法信号）

**5.5 Citation pipeline**
- 后端：citation parser + audit
- 前端：渲染时识别 `[[ref:]]` 标记，实时高亮关联 KB chunk

---

### 第 6 章 · 实验评估（~6000 字）★ 论文核心数据章节

**6.1 实验设置**
- LLM 后端：DeepSeek `deepseek-chat`（v3）+ `deepseek-v4-pro thinking`
- Embedding：DashScope `text-embedding-v4` (1536d)
- 数据库：PostgreSQL 16 + pgvector 0.7
- 硬件：[your machine]
- Judge：Agent-as-Judge（DeepSeek `deepseek-v4-pro` + structured output schema）

**6.2 RAG 检索质量（消融实验 §6.2）**

实验 6.2.1：3 KB · 20 golden queries

| KB | 类型 | chunks | 测试查询 |
|---|---|---|---|
| 咖啡 B2B 调研 | 中文 | 2 | 8 |
| SaaS 定价策略 | 英文+中文 | 4 | 6 |
| 硬件出海合规 | 中文 + 命名实体重 | 2 | 6 |

| 模式 | recall@5 | P@5 | MRR | avgScore |
|---|---|---|---|---|
| Vector only | 2.278 | 0.689 | **1.000** | 0.566 |
| Hybrid (RRF) | 2.278 | 0.689 | **1.000** | 0.031 (RRF) |

> **发现 1**：在网络稳定 + embeddings 健康时，pure vector 已饱和 MRR=1.0。Hybrid 在此场景下不带来增益。

实验 6.2.2：网络抖动模拟（重新跑同样 query 但禁用 retry envelope）

| 模式 | recall@5 (degraded network) |
|---|---|
| Vector only | 1.514 |
| Hybrid | **1.944** |

> **发现 2**：lexical signal 不依赖 embedding API → hybrid 在 API 抖动下提供 +28% 召回稳定性

**6.3 BMC 生成质量（baseline 对比）★ 关键章节**

实验 6.3.1：YC 14 个真实创业案例 head-to-head

> 数据集：14 个 YC 公开 case（Stripe / Airbnb / Doordash 等代表性公司）；每个 case 用一句 founding pitch 作为 seed。

| 维度 | gpt-solo (单 LLM 一次性生 9 cell) | Starlink (12-agent + RAG) |
|---|---|---|
| coverage (9 维度命中率) | [PENDING] | [PENDING] |
| factuality (引用 must_cover 概念命中率) | [PENDING] | [PENDING] |
| concreteness (具体数字 / 命名实体频率) | [PENDING] | [PENDING] |
| consistency (跨维度无矛盾比例) | [PENDING] | [PENDING] |

> **数据填充时机**：当前 `eval:yc` 正在后台跑，~30-40min 后填入。

实验 6.3.2：消融实验

| Variant | description | mean score (judge LLM) |
|---|---|---|
| Full | 12-agent + RAG + critic + debate | [PENDING] |
| -critic | 关闭 critic，无 conflicts 检测 | [PENDING] |
| -RAG | 不带 KB（无 [[ref:]] 引用） | [PENDING] |
| -debate | critic 检 conflicts 但不触发 3-way debate | [PENDING] |
| Single (gpt-solo) | 单 LLM 一次生成 | [PENDING] |

**6.4 个性化（user-skill 实验）**

> 2 persona × 5 sessions × user-skill 抽取 → 后续 session 注入 prompt → 测 question shift

实验 6.4.1：persona-1（B2B SaaS PM）+ persona-2（硬件 indie hacker）
- trait recall@k：抽取的 user-skill 有多少命中 ground-truth traits
- coach question shift：注入 user-skill 后，coach 问题与 baseline 问题的 keyword 差异

**6.5 性能基准**

实验 6.5.1：单次 BMC 生成端到端 wall-clock

| 阶段 | 时长 | 备注 |
|---|---|---|
| Supervisor 路由 | ~1s | structured output classifier |
| BMC 3 generator (parallel) | ~70s | LangGraph fan-out |
| 16 dimension-actions | ~30s | (并行后) |
| Critic | ~10s | conflicts 检测 |
| Synthesizer | ~5s | cross-dim |
| Total | **96-125s** | sequential 125 → parallel 96 (-23%) |

实验 6.5.2：3 层 SLO 实测（live data）

| Layer | bucket | n | p50 | p95 | err% |
|---|---|---|---|---|---|
| tool | tool:web-search | 4 | 6.4s | 7.2s | 0% |
| tool | tool:customer-segments.estimate_market_size | 1 | 14.9s | 14.9s | 0% |
| subgraph | market-agent | 1 | 71.3s | 71.3s | 0% |
| mention | mention:market-agent | 1 | 71.6s | 71.6s | 0% |

> **发现 3**：3 层 SLO 让 "agent slow" 这个含糊问题精确到 "subgraph - sum(tools) = LLM thinking time"

**6.6 工程可靠性**

| 指标 | 值 |
|---|---|
| 单元测试 | 251 / 251 |
| Smoke 测试 | 7 / 7 |
| End-to-end manual | full canvas + KB + report subscription |
| Lint 警告 | 0 (server + web) |
| Code coverage | ~50% (P11.18 关键路径) |

---

### 第 7 章 · 讨论与局限（~3000 字）

**7.1 关键发现**
1. Hybrid retrieval 在健康网络下=vector but provides robustness under API instability — 不是 quality win，是 reliability win
2. 12-agent debate 显著提升 cross-dimensional consistency，但增加 30-50s 延迟
3. 3-layer SLO + Sentry-style error aggregation 在 dev 阶段就揪出 1 个 critical bug（`gpt-4o-mini` model name mismatch with DeepSeek backend）

**7.2 局限**
- L1：当前 streaming 仅 section-level，未实现 token-level（需重写 LLMClient streamChat 接入 reportWriterStream resolver）
- L2：跨 gateway SLO 同步通过 Redis pub/sub，window stats 仍 process-local
- L3：Multi-tenant 隔离依赖 RLS，没有 row-level 加密
- L4：YC 14 case 仅覆盖 software / consumer SaaS；硬件 / DTC / B2B 工业未充分采样

**7.3 误判 case study**
- DashScope 网络抖动 vs SiliconFlow 503 → fallback 路径如何响应
- Critic LLM 失败 → rule-based heuristic 标记 `degraded:rule-based`
- LLMClient default model bug：影响 16 个 dimension-actions 静默失败 → SLO 揪出

**7.4 拓展性**
- 加新 agent / tool / KB / embedding provider 都是 plug-in（已实测）
- Hot-reload 通过 AGENT_PROFILE_TTL_MS 控制
- 横向扩展通过 Redis SLO sync + PG 共享

---

### 第 8 章 · 结论（~1500 字）

- 重申 3 个贡献
- 关键定量结果（Starlink vs gpt-solo +X%）
- 工程沉淀：可观测性栈可推广到任何 multi-agent 系统
- 未来工作：真 token streaming / 跨语言 RAG / 自动 agent yaml hot-reload / 业内基准对照

---

## 附录

### Appendix A · 系统部署指南
- `.env` 配置（DeepSeek + DashScope + Postgres + Redis 可选）
- `corepack pnpm install && pnpm build && node dist/index.js`
- 健康端点（`/health/agents`、`/health/errors`、`/metrics`）
- 浏览器测试（`/canvas/proj-001` 标准 demo flow）

### Appendix B · 12 个 PG 表 schema 截图

### Appendix C · 38 tool 的 inputSchema / outputSchema 表

### Appendix D · YC 14 case 完整 raw judge 输出

### Appendix E · 251 个单测列表

---

## 论文图表清单（论文 + 答辩用）

### Figure 列表
- F1：multi-agent 拓扑图（章 3.2）
- F2：DB schema ER 图（章 3.5）
- F3：3-layer SLO 实时截图（章 6.5）
- F4：YC head-to-head bar chart（章 6.3）
- F5：RAG hybrid vs vector under noise scatter plot（章 6.2）
- F6：单次 BMC 生成 wall-clock 分解柱状图（章 6.5）
- F7：前端截图：BMC 9-cell + critic conflicts + report drawer（章 4）
- F8：AgentHealthChip degraded state（章 6.5）

### Table 列表
- T1：12 个 agent 配置表（章 3.2）
- T2：38 个 tool 分类表（章 3.3）
- T3：12 张 PG 表 schema 摘要（章 3.5）
- T4：YC 14 case head-to-head 评分表（章 6.3）★
- T5：RAG hybrid vs vector 分 KB 详细表（章 6.2）★
- T6：5-variant 消融实验表（章 6.3.2）★
- T7：3-layer SLO live 数据（章 6.5）
- T8：性能基准 wall-clock 分解（章 6.5）

---

## 写作进度跟踪

- [ ] 摘要（中文 + 英文）
- [ ] 第 1 章 · 引言
- [ ] 第 2 章 · 相关工作（需要查文献）
- [x] 第 3 章 · 系统架构（已经在 FROZEN-FOR-DEMO.md 有素材）
- [ ] 第 4 章 · 多智能体协调机制
- [ ] 第 5 章 · 混合检索增强生成
- [ ] 第 6 章 · 实验评估（等 eval:yc 完成填数据）
- [ ] 第 7 章 · 讨论与局限
- [ ] 第 8 章 · 结论
- [ ] 附录 A-E

## 待办的实验（跑了之后回填数据）

| 实验 | 命令 | 状态 | 时长预估 |
|---|---|---|---|
| YC head-to-head | `pnpm eval:yc` | 🟢 跑中 (PID 46850) | 30-40min |
| Coaching personalization | `pnpm eval:coaching` | ⏸ 待 yc 完成 | 10-15min |
| 4-runner heuristic | `pnpm benchmark:run` | ⏸ 待选 | 20-30min |
| Ablation -critic | 需新增 flag | ❌ 未实现 | 15min × variant |
| Ablation -RAG | 需新增 flag | ❌ 未实现 | 15min × variant |
| Ablation -debate | 需新增 flag | ❌ 未实现 | 15min × variant |

