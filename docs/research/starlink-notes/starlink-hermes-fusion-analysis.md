# Hermes 框架深度解析 × Starlink 融合评估

> **目的**：解析 Hermes Agent（Nous Research）的多智能体协同机制，评估与 Starlink（LangGraph + CC-BMC）的融合可行性。
> **结论先给**：**不融合框架，选择性借用 5 个设计制品**（2 工程师周即可落地）。
> **相关文档**：
> - `starlink-agent-improvement-plan.md` v1.1（整体改进方案）
> - `starlink-langgraph-upgrade-plan.md` v1.0（LangGraph 纵向升级）
> - 本文（Hermes 横向借鉴）

---

## 目录

1. [定位：哪一个 Hermes](#1-定位哪一个-hermes)
2. [Hermes Agent 项目画像](#2-hermes-agent-项目画像)
3. [多智能体协同机制 · 深度解析](#3-多智能体协同机制--深度解析)
4. [Hermes 的三大独创设计](#4-hermes-的三大独创设计)
5. [Hermes vs LangGraph / AutoGen / CrewAI / MetaGPT](#5-hermes-vs-langgraph--autogen--crewai--metagpt)
6. [与 Starlink 的融合评估](#6-与-starlink-的融合评估)
7. [具体融合方案](#7-具体融合方案)
8. [与整体路线图的关系](#8-与整体路线图的关系)
9. [参考文献](#9-参考文献)

---

## 1. 定位：哪一个 Hermes

"Hermes" 在 AI agent 生态里**不止一个**，必须先锁定。调研到 7 个候选：

| # | 名称 | 组织 · 年 | 多智能体协同相关度 |
|---|---|---|---|
| ⭐ 1 | **Hermes Agent** | Nous Research · 2026-02 | **9/10**（本文主角） |
| 2 | **Hermes Function-Calling v1** | Nous Research · 2024 | 5/10（schema 标准，不是协同机制） |
| 3 | **Hermes: LLM Framework for Autonomous Networks** | Huawei · arXiv 2411.06490 | 6/10（电信域 chain-of-agents） |
| 4 | **HERMES: Modular Multi-Agent for Clinical Text** | AAAI FSS 2025 | 4/10（临床 NLP） |
| 5 | Hermes (schnetzlerjoe) | LlamaIndex 投研 | 3/10 |
| 6 | HERMES (healthcare edge) | arXiv 2601.12610 | 2/10 |
| 7 | Hermes 2/3/4 LLMs | Nous/Teknium | 3/10（是模型不是框架） |

**锁定 #1 的依据**：
- GitHub 4 万 Star，2026-02 开源后快速起势
- 中文社区（Zhihu / 36kr / 腾讯云开发者）热度显著，**明确与 LangGraph / CrewAI 对比**
- 明确"**multi-agent orchestration**"的设计议题
- Issue #344 公开提出"Multi-Agent Architecture"提案，有代码级讨论
- **精确仓库定位**：[https://github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)

### 1.1 2026 Self-Hostable Agent Harness 双雄格局

这一节是为了**建立坐标系**：理解 Hermes 的设计取舍，必须看它的对标——**OpenClaw**。

| 维度 | **Hermes Agent** (Nous Research) | **OpenClaw** (openclaw.ai) |
|---|---|---|
| 起源 | 2026-02，脱胎于 Hermes LLM 系列 | 2025-11 由 Peter Steinberger 发起（原 Clawdbot → OpenClaw），2026 年 2 月 Peter 加入 OpenAI 后转非营利基金会接管 |
| GitHub Stars | ~40K | ~345K（2026 年 AI 类 Top 1） |
| 核心卖点 | **持续学习 / 记忆延续**（skill synthesis + checkpoint replay） | **永远在线 + 消息网关驱动**（Signal/Telegram/Discord/WhatsApp 作为 UI） |
| 多 Agent 协同 | Coordinator + L0–L3 ladder + archetype pool（Issue #344 在落地） | 更强的多 Agent orchestration + skills 插件生态（SKILL.md 标准） |
| 持久化 | SQLite + FTS5 | 多后端可选 |
| 心智模型 | **Agent is a living process**（长驻、自我改进） | **Agent is a personal assistant**（事件驱动、IM 操控） |

**为什么这个对标对 Starlink 有意义**：
1. Hermes 和 OpenClaw **共同定义了 2026 年"自托管个人超级 Agent"的设计空间**。它们的共性（SKILL.md、checkpoint 持久化、消息网关）已经成为事实标准，即使 Starlink 不采纳它们作为运行时，也应该**对齐它们的制品接口**（e.g. 支持 agentskills.io 格式的 skill 描述文件，未来可互操作）。
2. 两者都不是 "web 应用场景"——Starlink 恰恰是 web 应用。**结论不变：借制品，不借框架**。
3. Hermes 的 L0–L3 isolation ladder 和 OpenClaw 的 skills 生态是**两者各自独创**的部分，本文重点分析 Hermes 那一侧；OpenClaw 的 skills 生态若未来需要，再单独评估。

Function-Calling schema（#2）虽然不是协同机制，但是 Hermes 生态里**最可直接借用**的一块，本文作为附带项。

---

## 2. Hermes Agent 项目画像

### 2.1 基本信息
- **仓库**：[github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- **定位**：Self-hosted, self-improving AI agent harness
- **技术栈**：Python + SQLite（持久化）+ ChatML 消息格式
- **当前能力**：
  - ✅ 单 Agent 闭环（完整 tool use、checkpoint、skill synthesis）
  - ✅ 简单 delegation（`delegate_task` 派生 throwaway 子 agent）
  - 🚧 真正的多 Agent 架构（Issue #344，**proposal 阶段，部分合并**）

### 2.2 Hermes 和 Starlink 的"天然落差"
| 维度 | Starlink | Hermes |
|---|---|---|
| 语言栈 | TypeScript + Node | Python |
| 图引擎 | LangGraph StateGraph | 自研 Workflow DAG Engine |
| 持久化 | Postgres | SQLite |
| 多 Agent 拓扑 | 固定（3 domain + critic） | 动态（coordinator 分解任务） |
| 前端 | React + GraphQL | 聊天网关（Telegram/Discord/WeCom） |
| 成熟度 | 生产运行中 | 多 Agent 部分为 roadmap |

**第一直觉**：不是"能不能替换"的问题——**Hermes 的编排层比 Starlink 弱**（LangGraph 是更成熟的图引擎）。问题应是"Hermes 有什么**设计理念**是 LangGraph 没有的"。

---

## 3. 多智能体协同机制 · 深度解析

> 本章是本文最有价值的部分。以下机制基于 Hermes Issue #344 公开提案 + docs 当前实现 + CAMEL-AI Workforce 的 lineage。

### 3.1 L0–L3 Isolation Ladder ⭐（最核心贡献）

Hermes 把「agent 间共享多少状态」**显式抽象为 4 个档位**，要求协同边上明确标注：

```
┌─────────────────────────────────────────────────────────────┐
│  L0 · Isolated                                               │
│  ─────────────                                               │
│  Agent A ──► Agent B                                         │
│      │                                                       │
│      └── 零上下文传递。B 只收到 goal 字符串，独立运行        │
│                                                              │
│  用例：完全独立的子任务（查天气 + 查新闻）                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  L1 · Result-Passing                                         │
│  ───────────────────                                         │
│  Agent A ──► Agent B                                         │
│      │   (auto-injected upstream summary)                    │
│      └── A 的结果自动作为 B 的 "context" 字段注入            │
│                                                              │
│  用例：流水线式任务链（研究 → 总结 → 发布）                   │
│  ✅ Starlink 当前 supervisor → domain agent 大致在这一档      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  L2 · Shared Scratchpad                                      │
│  ──────────────────────                                      │
│  Agent A ──┐                                                 │
│            ├──► K/V Scratchpad ◄──┐                          │
│  Agent B ──┘                       │                         │
│                              Agent C reads all                │
│                                                              │
│  所有 agent 读写同一块 K/V；类似 MetaGPT 消息池               │
│  用例：并行 agent 间需要看到彼此的中间结论                     │
│  ✅ Starlink synthesizer 隐式做了这个，但缺显式契约             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  L3 · Live Dialogue                                          │
│  ──────────────────                                          │
│  Agent A ◄════════════════════════════► Agent B              │
│             turn-based debate                                │
│             (each turn visible to both)                      │
│                                                              │
│  同步 turn-by-turn 对话；类似 AutoGen group chat             │
│  用例：辩论、协商、创意对撞                                    │
└─────────────────────────────────────────────────────────────┘
```

**为什么这个很重要**：  
LangGraph / AutoGen / CrewAI **都隐式做了这 4 档，但从不显式命名**。当你的 BMC 图里有 7 条边，每条边的状态传递语义不同时，设计错位就会发生（e.g. 你以为是 L1，实际被写成 L2，副作用泄漏）。

**对 Starlink 的直接价值**：**零代码成本**，立刻改善设计清晰度。见 §7.2。

### 3.2 LLM-based Coordinator Router

Hermes 多 Agent 的入口是一个 **Coordinator agent**，它**不是规则路由**，而是 LLM 决策：

```
User Query
    │
    ▼
┌──────────────────┐
│   Coordinator    │  LLM 读取 query + 可用 archetype 列表
│   (LLM-based)    │  决定：分解任务 / 直接路由 / 自己干
└────────┬─────────┘
         ▼
    DAG of tasks
  (topological sort)
```

6 个预制 archetype：
- **Coordinator**（本体）
- **Researcher**（信息收集）
- **Developer**（代码）
- **Browser**（web 交互）
- **Reviewer**（质检）
- **Synthesizer**（整合）

**与 Starlink 对比**：Starlink 的 supervisor 也是 LLM-based 路由，但目标集合**硬编码为 3 个**（market/product/finance）。Hermes 是**开放集**，每次根据任务动态组合。

**是否可借**：目前不建议。Starlink 的 BMC 场景**固定 9 维度 / 3 agent** 是领域约束，不是架构缺陷。开放集 router 是 Hermes 的通用 agent 定位，不符合 Starlink 的领域特化定位。

### 3.3 Workflow DAG Engine + Ready-Step Groups

Hermes 自研了一个轻量 DAG 引擎：
- **拓扑排序** + **环检测** + **ready_steps(completed)** 接口
- **Convoy mode**：并行腿 + synthesis 合并
- **Parallel within ready-step groups**（ThreadPoolExecutor）
- **Stuck detection**（activity-monitor 超时）+ 可配置重试

**评估**：这是个"重造轮子"的场景。LangGraph 的 `StateGraph` + 隐式 fan-out + `Send` 动态分发**严格更强**。Hermes 自研引擎是因为 Python 生态需要一个脱离 LangChain 依赖的最小内核。

**对 Starlink**：❌ **不借**。你已有更好的。

### 3.4 Agent Pool + 生命周期

Hermes 每个 archetype 默认预热 10 个 clone（lazy init），避免冷启动。生命周期来自 **CAMEL-AI Workforce** 的 5 步：
```
Decompose → Assign → Execute → Complete → Handle Failures
```

**评估**：agent pooling 是过早优化，BMC 场景单会话并发不大。**不借**。

### 3.5 Checkpoint-Based Execution

- 每次 tool call 后 snapshot 到 `~/.hermes/checkpoints/`
- 50-snapshot 上限的循环缓冲
- 可 replay 任意历史点

**对 Starlink**：已经通过 LangGraph `PostgresSaver` 解决（见 LangGraph 升级方案 §5.2），**不借**。

### 3.6 执行并发模型

| 维度 | Hermes | Starlink |
|---|---|---|
| 并发模型 | Sync within phase, parallel within ready-step | StateGraph 隐式 fan-out |
| 嵌套 | `max_spawn_depth: 1`，`role='orchestrator'` 才能嵌套 | Subgraph（Phase 2 后） |
| HITL | 网关层（IM 消息） | GraphQL + `interrupt()` |

**结论**：各有优势，不互换。

---

## 4. Hermes 的三大独创设计（真正值得借）

排除上面"框架级重造"的部分后，Hermes 有 **3 个设计制品** 是 LangGraph 没有的、可以直接借到 Starlink：

### 4.1 Hermes Function-Calling Schema ⭐⭐⭐⭐⭐（最高 ROI）

Nous 定义的 **模型无关** tool call 格式，可以用在任何 LLM 上：

```xml
<tools>
[
  {
    "type": "function",
    "function": {
      "name": "analyze_bmc_dimension",
      "description": "Analyze a BMC dimension",
      "parameters": {
        "type": "object",
        "properties": {
          "domain": {"type": "string", "enum": ["customerSegments", ...]},
          "confidence": {"type": "number"}
        },
        "required": ["domain", "content", "confidence"]
      }
    }
  }
]
</tools>

<!-- LLM 输出: -->
<tool_call>
{"name": "analyze_bmc_dimension", "arguments": {"domain": "customerSegments", "content": "...", "confidence": 0.82}}
</tool_call>

<!-- 系统回送: -->
<tool_response>
{"status": "accepted"}
</tool_response>
```

**为什么重要**：
1. **比 JSON-in-prose 鲁棒**——`<tool_call>` XML 标签比"请输出 JSON"提示更难被模型忽略
2. **跨模型兼容**——OpenAI / Anthropic / 本地 LLaMA / DeepSeek 都可用同一套 prompt
3. **训练数据公开**（Hermes-Function-Calling-v1 Dataset），说明商用模型也能稳定识别
4. **直接针对 Starlink 痛点**：你现在 `extractAndParseJSON` 正则贪婪匹配会爆炸（见 LangGraph 升级方案 §3.4 L1711-1754），换成 `<tool_call>` XML 就不炸了

**Starlink 融合点**：作为 `withStructuredOutput` 的**补充或降级路径**。见 §7.1。

### 4.2 Inception Prompting（交接加固）

Hermes 对 agent → sub-agent 的 prompt 交接做**系统化硬化**（Issue #375）。核心模式：

```
你现在是一个 {ROLE} agent。

【上下文锚定】
  - 上游 agent: {UPSTREAM_AGENT}
  - 你被启动的原因: {WHY_YOU_WERE_CALLED}
  - 上游提供的全部事实（不要裁剪）:
    {FULL_UPSTREAM_CONTEXT}

【你的任务】
  {GOAL}

【失败模式防御】
  - 如果上下文矛盾，不要选择一方，显式报告矛盾
  - 如果信息不足，不要编造，调用 request_more_info
  - 如果置信度 < 0.6，输出 {status: "need_human"}

【输出契约】
  必须通过 <tool_call> 返回 {OUTPUT_SCHEMA}
```

**关键点**：
- **不裁剪上游上下文**（直击 Starlink 80-char 截断问题）
- **显式枚举失败模式**（而不是希望模型不犯错）
- **契约放在 prompt 结尾**（LLM 对末尾指令最敏感）

**Starlink 融合点**：供 supervisor → market/product/finance 这三条边用的 prompt 模板。见 §7.4。

### 4.3 Skill Synthesis（程序性记忆）

Hermes 把**完成的任务**自动沉淀为**可复用的 markdown skill**（agentskills.io 标准）：

```markdown
---
name: analyze-saas-market-segment
tags: [bmc, market, saas]
success_rate: 0.87
---

## 使用条件
输入问题包含 SaaS 相关关键词且需要客户细分分析

## 步骤
1. 识别核心买家角色（使用 jobs-to-be-done 框架）
2. 按 ACV 区间分层（SMB / Mid / Enterprise）
3. 对每层输出 {pain, gain, willingness_to_pay}

## 示例 I/O
输入：...
输出：...
```

**用法**：下次遇到相似任务，agent 先**检索可用 skill**，找到就按 skill 执行。

**关键洞察**：这是**半自动版的 MIPROv2**——不用 RL，靠积累 → 检索 → 复用。

**Starlink 融合点**：BMC 分析有大量**可复用模式**（SaaS、硬件、2B/2C）。如果把每次成功的 BMC run 沉淀为 skill，下一次相似问题可以直接套模板。见 §7.5。

---

## 5. Hermes vs LangGraph / AutoGen / CrewAI / MetaGPT

| 维度 | **Hermes** | LangGraph | AutoGen | CrewAI | MetaGPT |
|---|---|---|---|---|---|
| 编排模型 | Coordinator + DAG + archetype | StateGraph（显式图） | Group Chat（LLM 选发言人） | Crew + Flow | SOP 流水线 |
| 状态传递 | **L0-L3 显式分档** ⭐ | Channel + Reducer | MessageStream | Pydantic State | 共享 Message Pool |
| 工具调用 | **Hermes Function-Calling XML** ⭐ | LangChain Tool | Function Calling | LangChain Tool | Action 类 |
| 冲突解决 | **Independent Judge**（fail-closed gate） | 条件边 + 自定义 | 投票 / 结束条件 | 层次化 | Critic Review |
| 记忆 | FTS5 + Skill Synthesis | Checkpointer + Store | Memory Module | RAG | 短期/长期分离 |
| Prompt 加固 | **Inception Prompting** ⭐ | 开发者自理 | 开发者自理 | Agent Profile | Role+Goal+Constraints |
| 成熟度 | 早期（multi-agent roadmap 中） | GA | GA | GA | GA |
| 生态锁定 | Python + SQLite | Python/TS + 任意 DB | Python | Python | Python |
| 对 Starlink 的可借性 | **3 个制品** | 已在用 | 借 MemoryStream | 借 Flow/Crew 分层 | 借消息池 |

**观察**：
- **编排层**：Hermes 弱于 LangGraph。不借。
- **设计制品（schema、prompt 模板、协同语义）**：Hermes **强于 LangGraph**。可借。
- Hermes 和 MetaGPT 其实是相似的"设计先行"风格，但 Hermes 更偏"制品可复用"。

---

## 6. 与 Starlink 的融合评估

### 6.1 融合判断总则

```
┌───────────────────────────────────────────────────────┐
│  Hermes 的"框架层" → 不融合                            │
│  （LangGraph + Postgres + GraphQL 的组合已更成熟）      │
│                                                       │
│  Hermes 的"设计制品层" → 精选借用                      │
│  （schema、prompt 模板、设计词汇是纯净无依赖的）        │
└───────────────────────────────────────────────────────┘
```

原则：**借 artifact，不借 runtime**。

### 6.2 高 ROI：借走这 5 样

| # | 借什么 | 解决 Starlink 的什么问题 | 工时 | 优先级 |
|---|---|---|---|---|
| 1 | **Function-Calling XML schema** | `extractAndParseJSON` 贪婪正则崩溃 | 1-2 天 | 🔥🔥🔥 |
| 2 | **L0-L3 Isolation Ladder（设计词汇）** | 7 条边的语义不明、耦合混乱 | 0.5 天文档 | 🔥🔥🔥 |
| 3 | **Independent-Judge Critic（替换当前 critic）** | Critic 只会"看一眼"，没有 fail-closed 闸门 | 3-5 天 | 🔥🔥 |
| 4 | **Inception Prompting（上下文加固模板）** | 80-char 截断、上下文丢失 | 1 天 | 🔥🔥 |
| 5 | **Skill Synthesis（BMC 模板库）** | BMC 分析模式重复，没有复用 | 1 周 | 🔥 |

**总工程量**：约 **2 工程师周**（14 人日），可并入 `starlink-langgraph-upgrade-plan.md` 的 Phase 2-3。

### 6.3 不借：这 5 样

| # | 不借什么 | 原因 |
|---|---|---|
| 1 | Hermes Workflow DAG Engine | LangGraph StateGraph 严格更强 |
| 2 | Coordinator LLM Router | Starlink supervisor 已是；且 BMC 是固定 3-agent，不需要开放集 |
| 3 | Agent Pool (10 clone 预热) | 过早优化，Starlink 单会话并发不大 |
| 4 | Gateway (Telegram/Discord/WeCom) | Starlink 用 GraphQL Subscription |
| 5 | SQLite 持久化 | Starlink 已有 Postgres |

### 6.4 反向思考：Hermes 有 Starlink 没有的优势吗？

**有，但不独占**：
- ✅ L0-L3 明确分层 — 只有 Hermes 命名了
- ✅ Function-Calling XML — Nous 原创
- ✅ Skill Synthesis — 概念不新，但 Hermes 落地最完整

**没有 Hermes 独占且 Starlink 不可补的优势**。所以决定：**借制品 ✅ 借框架 ❌**。

---

## 7. 具体融合方案

### 7.1 借 Function-Calling XML Schema

**定位**：作为 `withStructuredOutput` 的**加固层**与**降级路径**。

**双轨策略**：
```ts
// packages/server/src/graphs/agents/shared/domain-analyst.ts

import { z } from 'zod'
import { DomainAgentOutputSchema } from '@/domain/bmc/schemas'

async function runDomainAgent(state: BusinessStateType) {
  // 路径 A：原生 structured output（首选，仅 GPT-4 / Claude 系原生支持）
  if (supportsStructuredOutput(llmClient)) {
    return await llmClient
      .withStructuredOutput(DomainAgentOutputSchema)
      .invoke(messages)
  }

  // 路径 B：Hermes XML 降级（本地模型、开源模型、老模型）
  const schema = zodToJsonSchema(DomainAgentOutputSchema)
  const systemPrompt = buildHermesPrompt({
    tools: [{ type: 'function', function: schema }],
    role: 'Market_Agent',
    goal: '...',
  })
  
  const response = await llmClient.invoke(messages)
  return parseHermesToolCall(response.content, DomainAgentOutputSchema)
}

// 解析器（Hermes XML → typed object）
function parseHermesToolCall<T>(content: string, schema: z.ZodSchema<T>): T {
  const match = content.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/)
  if (!match) throw new AgentOutputError('No <tool_call> found')
  const parsed = JSON.parse(match[1])
  return schema.parse(parsed.arguments)  // Zod 校验
}
```

**收益**：
- 默认走原生 structured output（最稳）
- 对开源模型（本地部署、成本优化）有降级路径
- XML tag 比"请输出 JSON"更难被忽略
- 支持 Hermes 生态的 fine-tuned 模型（Hermes 3/4 专门训练过这个格式）

### 7.2 L0-L3 Isolation Ladder 作为 Starlink 的设计词汇

**落地**：在 `flow-templates.ts` 的 `FlowEdge` 上加一个字段：

```ts
// packages/shared/src/flow/types.ts
export const isolationLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3'])

export const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourcePort: z.string(),
  target: z.string(),
  targetPort: z.string(),
  isolationLevel: isolationLevelSchema.default('L1'),  // ← 新字段
})
```

**Starlink BMC 边的标注建议**：

```
input-1    →[L1]→  market-agent      (上游 question 完整传递)
input-1    →[L1]→  product-agent
input-1    →[L1]→  finance-agent

market     →[L2]→  synthesizer       (共享草稿板：聚合 3 个 agent 的 cards)
product    →[L2]→  synthesizer
finance    →[L2]→  synthesizer

synthesizer  →[L1]→  critic          (完整产物传递)
critic       →[L1]→  supervisor      (反馈回传，loop-back)
```

**收益**：
- 每条边的语义显式化
- GraphCompiler 校验：L0/L1 不能写共享 state，L2 必须读 scratchpad
- 未来加新 Agent 时，先标 L-level 再写代码，避免耦合错位
- **纯文档/类型层改动，运行时零成本**

### 7.3 Critic 升级为 Independent-Judge（Fail-Closed Gate）

**当前 critic**：输出 conflicts，无硬闸门；high severity 时 loop back supervisor，但只是"再转一圈看看"。

**Hermes 模式**：Critic 作为**独立法官**，输出**硬判决**：
```ts
const JudgeVerdictSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL', 'NEEDS_HUMAN']),
  conflicts: z.array(ConflictSchema),
  fail_criteria: z.array(z.string()).optional(),    // 为什么 FAIL
  retry_instructions: z.record(z.string()).optional(),  // 定向反馈给哪个 agent
})
```

**新 critic 节点**：
```ts
async function critic(state, config) {
  const verdict = await chatModel
    .withStructuredOutput(JudgeVerdictSchema)
    .invoke([
      { role: 'system', content: INDEPENDENT_JUDGE_PROMPT },
      { role: 'user', content: buildJudgeContext(state) },
    ])
  
  if (verdict.verdict === 'PASS') {
    return { conflicts: [], verdict }
  }
  
  if (verdict.verdict === 'NEEDS_HUMAN') {
    // 触发 LangGraph interrupt（见 LangGraph 升级方案 §5.5）
    const decision = interrupt({
      type: 'judge_escalation',
      verdict,
      conflicts: verdict.conflicts,
    })
    return { conflicts: verdict.conflicts, userDecision: decision }
  }
  
  // FAIL: 定向反馈给失败的 agent（不是整轮重跑）
  return {
    conflicts: verdict.conflicts,
    retryInstructions: verdict.retry_instructions,  // { marketAgent: "请明确 ACV 区间" }
  }
}
```

**配合 router**：supervisor 新增条件——如果 state 有 `retryInstructions.marketAgent`，只重跑 market（不重跑全部 3 个）。

**收益**：
- Fail-closed：未通过判决不能 END
- 定向重试：减少无效重复
- `NEEDS_HUMAN` 触发 HITL 闭环，与 LangGraph interrupt 天然衔接

### 7.4 Inception Prompting 硬化上下文交接

**为 supervisor → domain agent 的 prompt 做模板化**：

```ts
// packages/server/src/graphs/agents/shared/inception-prompt.ts

export function buildDomainAgentPrompt(params: {
  role: 'Market_Agent' | 'Product_Agent' | 'Finance_Agent'
  roleGoal: string
  upstreamAgent: string
  upstreamContext: {
    question: string
    evidence: Evidence[]
    crossContext: BMCCard[]   // ← 完整对象，不截断！
    roundNumber: number
    previousFailures?: Conflict[]
  }
  outputSchema: z.ZodSchema
}): string {
  return `你现在是 ${params.role}。

【上下文锚定】
- 上游 agent: ${params.upstreamAgent}
- 你被启动的原因: ${params.upstreamContext.roundNumber > 1 
    ? '上一轮 critic 发现冲突，需要定向修正'
    : '首次分析'}
- 本轮是第 ${params.upstreamContext.roundNumber}/3 轮

【用户原始问题】
${params.upstreamContext.question}

【知识库证据（完整，不要裁剪）】
${params.upstreamContext.evidence.map(formatEvidence).join('\n\n')}

【其它 agent 的当前分析（完整对象）】
${JSON.stringify(params.upstreamContext.crossContext, null, 2)}

${params.upstreamContext.previousFailures ? `
【上一轮的冲突（你需要解决）】
${params.upstreamContext.previousFailures.map(formatConflict).join('\n')}
` : ''}

【你的任务】
${params.roleGoal}

【失败模式防御】
- 如果证据矛盾，不要选择一方，在输出的 notes 字段显式报告矛盾
- 如果信息不足，在输出的 confidence < 0.6 并在 notes 里说明缺什么
- 不要编造证据 ID；evidenceRefs 只能引用【知识库证据】里存在的 ID

【输出契约】
必须通过 structured output 返回，schema 见调用方。
`
}
```

**关键点对比 Starlink 当前**：

| 当前 | Inception 加固后 |
|---|---|
| `.substring(0, 80)` 截断 crossContext | 完整 JSON 对象传递 |
| Prompt 里混合 system/user/goal | 分区块，命名清晰 |
| 无失败模式声明 | 显式 3 条失败防御 |
| Schema 作为提示 | Schema 绑定到 LLM 调用层 |

### 7.5 Skill Synthesis：BMC 模板库

**长期改造**，不是 Phase 2 范围。但值得列出设想：

**Phase 3 后**，每次成功的 BMC run 异步抽取为 skill：

```sql
-- 新表（Postgres）
CREATE TABLE bmc_skills (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,              -- "saas-b2b-mid-market"
  tags TEXT[],                     -- ['saas', 'b2b', 'mid_market']
  template JSONB NOT NULL,         -- 9 个维度的参数化模板
  success_rate REAL,               -- 历史成功率
  embedding VECTOR(1536),          -- 问题描述的向量
  created_at TIMESTAMP,
  usage_count INT DEFAULT 0
);
```

**检索流程**：
```
user query → embedding → pgvector KNN 搜 bmc_skills → 相似度 > 0.85 的 skill
  │
  ├── 有命中: supervisor 从 skill.template 初始化，domain agent 只做 delta
  └── 无命中: 走完整流程；成功后 LLM 抽取为新 skill
```

**收益**：
- 复用工作：BMC 分析有大量"同类项目"
- 冷启动加速：从零推理 → 模板修改，延迟和成本都降
- 形成资产：workspace 级 skill 库是真正的业务沉淀

**工作量**：1 工程师周。**放到 Phase 4**，等 Phase 1-3 稳定后再做。

---

## 8. 与整体路线图的关系

本文的 5 项融合与现有两份文档的映射：

| Hermes 融合项 | 并入哪个 Phase | 在哪个文档里 |
|---|---|---|
| §7.1 Function-Calling XML schema | LangGraph 升级 Phase 1（D3）— 作为 structured output 的**降级路径** | `starlink-langgraph-upgrade-plan.md` §5.3 扩展 |
| §7.2 L0-L3 Isolation Ladder | 主方案 Phase 2 — 加入 `flowEdgeSchema` | `starlink-agent-improvement-plan.md` §5 可增补 |
| §7.3 Independent-Judge Critic | LangGraph 升级 Phase 2（D6）— 替换 critic 节点实现 | `starlink-langgraph-upgrade-plan.md` §5.5 扩展 |
| §7.4 Inception Prompting | LangGraph 升级 Phase 2（D5）— 抽出 `inception-prompt.ts` | `starlink-langgraph-upgrade-plan.md` §5.4 Subgraphs 时同步做 |
| §7.5 Skill Synthesis | 主方案 Phase 4（可选研究期） | `starlink-agent-improvement-plan.md` §7 Phase 4 |

**总增量工作量**：14 人日 = **2 工程师周**，可吸收进既定路线图**不额外延期**（Phase 2 多 2 天，Phase 4 多 5 天）。

---

## 9. 参考文献

### Hermes 项目
- [NousResearch/hermes-agent · GitHub](https://github.com/NousResearch/hermes-agent)
- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/docs/)
- [Subagent Delegation docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation)
- [Issue #344 · Multi-Agent Architecture Proposal](https://github.com/NousResearch/hermes-agent/issues/344)
- [Issue #356 · Independent Judge Acceptance Criteria](https://github.com/NousResearch/hermes-agent/issues/356)
- [Issue #375 · Inception Prompting](https://github.com/NousResearch/hermes-agent/issues/375)
- [Issue #406 · Nightwire Fail-Closed Gates](https://github.com/NousResearch/hermes-agent/issues/406)

### Hermes Function-Calling
- [NousResearch/Hermes-Function-Calling · GitHub](https://github.com/NousResearch/Hermes-Function-Calling)
- [Hermes-Function-Calling-v1 · HuggingFace Dataset](https://huggingface.co/datasets/NousResearch/hermes-function-calling-v1)
- [Hermes 3 Technical Report · arXiv 2408.11857](https://arxiv.org/pdf/2408.11857)

### 相关学术与调研
- [Hermes: LLM Framework for Autonomous Networks · arXiv 2411.06490](https://arxiv.org/abs/2411.06490)
- [HERMES · AAAI FSS 2025](https://ojs.aaai.org/index.php/AAAI-SS/article/view/36936)
- [Multi-Agent Coordination Survey · arXiv 2502.14743](https://arxiv.org/abs/2502.14743)
- [CAMEL-AI Workforce](https://github.com/camel-ai/camel) — Hermes 多 agent 生命周期的 lineage
- [Agent Skills 标准](https://agentskills.io/)

### 中文参考
- [Zhihu · Hermes Agent 全面调研](https://zhuanlan.zhihu.com/p/2022015752258027715)
- [36kr · Hermes Agent 四万星](https://36kr.com/p/3764418640003840)
- [腾讯云开发者 · Hermes Agent 架构全解](https://cloud.tencent.com/developer/article/2652528)

### Starlink 内部锚点
- `packages/server/src/services/business-langgraph.ts` L1711-1754 — `extractAndParseJSON`（§7.1 替代目标）
- `packages/server/src/services/business-langgraph.ts` L569/1253/1408 — 80-char 截断（§7.4 消除目标）
- `packages/server/src/services/business-langgraph.ts` L1375-1502 — 当前 critic（§7.3 重构目标）
- `packages/shared/src/flow/types.ts` — `flowEdgeSchema`（§7.2 扩展目标）

---

**文档维护者**：Claude（Opus 4.7）
**关联文档**：
- `starlink-agent-improvement-plan.md` v1.1（横向框架对比 + 前端方案）
- `starlink-langgraph-upgrade-plan.md` v1.0（LangGraph 纵向升级）
- 本文：Hermes 横向借鉴
