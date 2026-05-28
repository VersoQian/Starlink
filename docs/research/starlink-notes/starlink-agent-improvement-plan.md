# Starlink Agent 框架 · 改进方案 v1.1

> 基于对 Starlink 源码（`business-langgraph.ts`、`graph-executor.ts`、`flow-templates.ts`、`comfy-store.ts`、`cc-bmc-card-node.tsx` 等）的完整阅读，
> 结合 MetaGPT / AutoGen-AG2 / CrewAI / OpenAI Agents SDK / Magentic-One / LangGraph（最新）/ DSPy / PydanticAI 的 Agent 框架横向调研，
> 以及 React Flow v12 / Rete.js / tldraw / Liveblocks / Jotai / JSONForms 等**前端画布与状态管理生态**调研，
> 以 Anthropic《Building Effective Agents》五大规范模式为方法论锚点，给出一份可落地的改进路线。
>
> 日期：2026-04-22 · v1.1（补充前端框架选型章节）

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状诊断](#2-现状诊断)
3. [主流 Agent 框架横评](#3-主流-agent-框架横评)
4. [可借鉴的核心模式](#4-可借鉴的核心模式)
5. [改进策略 · Agent 层（后端）](#5-改进策略--agent-层后端)
6. [改进策略 · 无限画布（前端）](#6-改进策略--无限画布前端)
   - 6.1 [前端生态横评](#61-前端生态横评)
   - 6.2 [推荐前端栈（最终答案）](#62-推荐前端栈最终答案)
   - 6.3 [5 层架构重构](#63-5-层架构重构)
7. [分阶段实施路线图](#7-分阶段实施路线图)
8. [风险、取舍与不做什么](#8-风险取舍与不做什么)
9. [参考文献](#9-参考文献)

---

## 1. 执行摘要

Starlink 当前的 CC-BMC 多 Agent 系统有三个根本性问题：

| 问题 | 根因 | 对应改进 |
|---|---|---|
| **Agent 间不一致** | `business-langgraph.ts` 把上游分析截断到 80 字符 | 引入"类型化消息 + 消息池"（§5.1） |
| **JSON 解析脆弱** | Domain agents 用裸 prompt + 正则兜底 | 全量切 `withStructuredOutput` / PydanticAI 式契约（§5.2） |
| **两套 runtime 并存** | 硬编码 `business-langgraph.ts` vs 通用 DAG 引擎 | 统一到通用引擎，BMC 走 `BMC_TEMPLATE`（§5.3） |

前端同样存在"写死"的结构问题：13 个硬编码 Node 组件、9 个 BMC domain 颜色、`Math.random()*500` 的定位逻辑、1124 行的 God Store。

**改进思路**：
- **后端**：向 MetaGPT 学消息池、向 PydanticAI 学类型契约、向 CrewAI 学 Flows/Crews 分层、向 LangGraph 最新版（2025）学 `Store`+`subgraphs`+`interrupt`。
- **前端**：**保留 React Flow v12**（已是 2025 SOTA），5 层解耦（Schema → Layout Engine → UniversalNode → Store 瘦身 → Canvas Controls），补 Jotai/JSONForms/Liveblocks 三件套解决流式更新、schema-driven 配置、多人协作。
- **方法论**：对齐 Anthropic 五大模式（routing / parallelization / orchestrator-workers / evaluator-optimizer / prompt chaining），先跑 eval 再谈复杂度。

**优先级**（按 ROI 排序）：
1. 🔥 取消 80 字截断 + 全量 structured output（半天，立即见效）
2. 🔥 删除 `business-langgraph.ts`，BMC 走 `BMC_TEMPLATE` + `GraphExecutor`（2-3 天）
3. ⚡ 引入 LangGraph 新特性：`Store`（持久记忆）、`subgraphs`（封装 domain agent）、`interrupt`（HITL）
4. ⚡ 前端 5 层重构（4.5 天）
5. 🔬 Critic 反馈闭环 + DSPy 做 prompt 优化（需先建 eval set）

---

## 2. 现状诊断

### 2.1 后端：三个并行的 Agent 实现

在源码里我们找到了**三份 MarketAgent**：

| 位置 | 类型 | 状态 |
|---|---|---|
| `packages/server/src/services/business-langgraph.ts` | 内联在 StateGraph 里 | **当前生产路径** |
| `packages/server/src/agents/market-agent.ts` | 独立类 | 代码里标注 "Week 1 Day 3-4, NOT yet wired" —— 死代码 |
| `packages/server/src/tools/llm-agent/market-agent.tool.ts` | ToolDefinition | 注册在 ToolRegistry，但 BMC 流程不经过它 |

这说明架构意图是清晰的（让 domain agent 变成可复用的 Tool），但迁移没完成。

### 2.2 后端：两套编排 runtime

```
┌─────────────────────────────────────────────────────────────┐
│  路径 A（当前 BMC 走的）：                                   │
│  conversation-store.ts                                       │
│    → new BusinessLangGraphService()  ← 直接 new，绕过 registry│
│    → business-langgraph.ts 里硬编码的 StateGraph              │
│    → supervisor → [market|product|finance] → synthesizer      │
│    → critic                                                   │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  路径 B（前端 comfy 编排走的，但 BMC 不走）：                 │
│  FlowDefinition (visual graph)                               │
│    → GraphCompiler.compile() ──→ ExecutionPlan               │
│    → GraphExecutor.execute()                                 │
│    → ToolRegistry.getTool(step.toolName)                     │
│                                                              │
│  flow-templates.ts 里已经有 BMC_TEMPLATE，                   │
│  它完整描述了 input → 3 agents → aggregator → critic → renderer │
│  —— 但无人调用。                                             │
└─────────────────────────────────────────────────────────────┘
```

这是**最严重的架构债**：两套 runtime 都试图做同一件事，但从不对话。

### 2.3 后端：弱语义的消息传递

`business-langgraph.ts` 的 CrossContext 构造（核心瓶颈）：

```ts
// 大意：把其它 domain agent 的产出塞给当前 agent 作上下文
crossContext = otherAgents.flatMap(a => a.nodes)
  .map(n => `[${n.domain}] ${n.content.substring(0, 80)}`)  // ← 80 字截断
  .join('\n')
```

80 字符只够一句标题。Product_Agent 永远看不到 Market_Agent 的完整推理链和证据，所以三个 agent 的结论经常**逻辑不自洽**（客户细分和渠道脱节，财务假设不匹配产品定位等）。

### 2.4 后端：Domain Agent 的 prompt 形态

看 `tools/llm-agent/market-agent.tool.ts:10`：

```ts
const SYSTEM_PROMPT =
  '你是 Market_Agent... 以 JSON 格式输出 { "bmcCards": [...] }'

// 执行后：
const parsed = JSON.parse(response.content ?? '{}')
bmcCards = parsed.bmcCards ?? []
// 失败兜底：伪造一个 confidence=0.5 的假卡片
```

问题：
- prompt 是裸字符串，输出 schema 只在注释里
- LLM 偶尔返回 markdown fence 或尾部说明文字，`JSON.parse` 直接炸
- 兜底路径用假数据掩盖失败，让下游（Critic）无法分辨"真的分析"和"解析失败"

与此对比，`critic` 节点用了 `withStructuredOutput(zodSchema)`，从不崩。**规范已经存在，只是没推广。**

### 2.5 前端：硬编码的 Canvas

- `registries/node-registry.ts` —— 13 个 `registerNode()` 硬调用
- `store/comfy-store.ts`（1124 行）—— `MACRA_NODE_TYPES` Set 硬编码、`Math.random()*500` 随机定位、`extractMacraNodeData` 对每种节点写 switch
- `nodes/cc-bmc-card-node.tsx`（477 行）—— `DOMAIN_COLORS` 把 9 个 BMC 维度的颜色写死
- 新增一种 agent 产物 = 改 5 个文件

这违反了你之前明确的要求：**"前端应该是灵活的，你不能写死这个前端"**。

---

## 3. 主流 Agent 框架横评

> 下表汇总 2025–2026 主流框架的核心编排模型、可偷的点、以及短板。
> 对 Starlink 的适配判断基于三个硬约束：① TypeScript 生态、② 已在 LangGraph 上、③ 需要可视化 DAG。

| 框架 | 核心模型 | 值得偷的一招 | 短板 | Starlink 适配 |
|---|---|---|---|---|
| **MetaGPT** (v1.0 + AFlow) | SOP 角色流水线 + **共享消息池** | 消息池 pub/sub：Role `_watch` 指定的 Action，完整文档流转（而非截断字符串） | SOP 模板是软件工程形状，BMC 不合身 | ⭐⭐⭐ 偷消息池模式 |
| **AutoGen / AG2 v0.9** | Event-driven `MemoryStream` + 可插拔 speaker 策略 | MemoryStream = 事件总线，订阅者不必相互认识 | GroupChat 发言人选择仍靠 LLM 推理，非确定性 | ⭐⭐⭐ 偷事件总线 |
| **CrewAI (Crews + Flows)** | 明确分离"自主协作（Crews）"和"确定性编排（Flows）" | **Flows 和 Crews 可互相嵌套** —— 你两套 runtime 纠结的就是这条线 | Pydantic 状态模型偏死；Flow 调试工具不成熟 | ⭐⭐⭐⭐ 这就是你缺的架构分层 |
| **OpenAI Agents SDK** (Swarm 继任者) | Handoffs（通过函数返回值把控制权交给另一个 agent） | Handoff 作为工具调用 —— Supervisor 路由变成普通 function call | 没有原生并行原语，需要自己搭 fan-out | ⭐⭐ 思路好，但缺并行 |
| **Magentic-One / Magentic-UI** | 中心化 Orchestrator + 两本 Ledger（Task / Progress） | **Progress Ledger** 用于决定"Critic 是否需要回滚" | 中心化，Orchestrator prompt 是单点故障 | ⭐⭐⭐ 偷双 Ledger |
| **LangGraph**（当前版本） | StateGraph + Channels，2025 新增 `interrupt`/`Store`/subgraphs | `Store` 跨线程长期记忆；`subgraphs` 封装 domain agent；`interrupt()+Command(resume=...)` 做 HITL | 图的可视化还是外挂 | ⭐⭐⭐⭐⭐ 你已经在用，直接升级版本就有 |
| **DSPy (MIPROv2)** | Signatures + Predictors，贝叶斯搜索优化 prompt | MIPROv2 在 agent benchmark 上把 ReAct 从 24% 拉到 51% | 需要 labeled eval 数据 | ⭐⭐ 值得做 spike，但要先建 BMC eval set |
| **PydanticAI v1.0** | 类 FastAPI DX + Pydantic 输出校验 | **类型化输出作为 agent 间契约** —— 直接杀死 80 字截断和 JSON 解析问题的根因 | 图编排极简，复杂拓扑仍需 LangGraph | ⭐⭐⭐⭐ Zod 版等价物自己造 |
| **Mastra / Vercel AI SDK v6** | TS 原生，Mastra 自动生成 typed tools；Vercel 加了 `Agent`+`stopWhen`+MCP | TS 生态里最接近 PydanticAI 的 DX | Mastra 生态还年轻；Vercel agent 层功能少 | ⭐⭐⭐ 值得评估，比 LangGraph.js 轻 |

### 3.1 Anthropic《Building Effective Agents》五大模式对照

Anthropic 2024 年 12 月那篇经典文章把 agent 工作流抽象为 5 种模式，从简到繁：

| 模式 | 描述 | Starlink 当前状态 |
|---|---|---|
| **Prompt Chaining** | 串行：A → B → C | ✅ 用到（supervisor → synthesizer） |
| **Routing** | 分发到不同 agent | ⚠️ 路由逻辑硬编码在 supervisor |
| **Parallelization** | 并行执行多个 agent | ✅ 用到（market/product/finance 并行） |
| **Orchestrator-Workers** | 中心协调者 + 多个执行者 | ✅ 用到（supervisor 是 orchestrator） |
| **Evaluator-Optimizer** | 执行-审查-迭代循环 | ⚠️ Critic 存在但**没有回滚闭环** |

Starlink 同时用了**最复杂的两种模式**（orchestrator-workers + evaluator-optimizer），但没有任何 eval 证明 Critic 真的在"optimize"——它可能只是表演。**Anthropic 的核心建议**：先跑 eval，不要在没数据的情况下堆复杂度。

### 3.2 2025 值得关注的论文

- **AFlow** (ICLR 2025 oral) — 自动搜索 agent DAG 结构。长期看，这意味着 Starlink 的可视化 DAG 可以**反向从 LLM 生成**。
- **Multi-Agent Collaboration via Evolving Orchestration** (arXiv 2505.19591) — "puppeteer" orchestrator 通过 RL 学习路由策略。如果未来想让 Supervisor 自主路由而非硬编码，这是路径。
- **Multi-Agent Collaboration Mechanisms: A Survey** (arXiv 2501.06322) — 2025 年的 canonical 分类法（actors × types × structures × strategies × protocols），给改进方案提供词汇。

---

## 4. 可借鉴的核心模式

从上面 8 个框架里抽出对 Starlink 最有价值的 **5 个模式**：

### 模式 1：类型化消息契约（来自 PydanticAI）

不要传字符串，传 Zod 校验过的对象：

```ts
const BMCCardSchema = z.object({
  domain: z.enum(['customerSegments', 'channels', /* ... 9 项 */]),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.object({ docId: z.string(), snippetId: z.string() })),
  sourceRole: z.enum(['market', 'product', 'finance']),
})
```

**立即收益**：
- 80 字截断问题消失（传完整对象）
- JSON 解析崩溃消失（用 `withStructuredOutput(BMCCardSchema)`）
- 前端不用再猜 payload 形状

### 模式 2：消息池 / 事件总线（来自 MetaGPT + AG2）

把 LangGraph 的 Channels 当成消息池用：

```
                  ┌──────────────────────────────┐
                  │    Shared Message Pool       │
                  │  (LangGraph Channel: bmcCards) │
                  └──────────────────────────────┘
                    ▲ publish    ▲ publish    ▲ publish
                    │            │            │
              ┌─────┴─┐    ┌─────┴─┐    ┌─────┴─┐
              │Market │    │Product│    │Finance│
              │ Agent │    │ Agent │    │ Agent │
              └───────┘    └───────┘    └───────┘
                    │            │            │
                    └──── subscribe (read full) ───┐
                                                   ▼
                                           ┌───────────────┐
                                           │   Critic      │
                                           │ Synthesizer   │
                                           └───────────────┘
```

每个 agent 往 pool 里 publish 完整对象，需要上下文时从 pool 读全部（而不是被 supervisor 手动拼接截断的字符串）。

### 模式 3：Flows vs Crews 的分层（来自 CrewAI）

这是对 Starlink **两套 runtime 并存**问题的正解：

- **Flow 层（确定性编排）** = 现在的 `GraphExecutor` —— 可视化 DAG，已知节点、已知边、已知并行组。BMC 的主流程在这层。
- **Crew 层（自主协作）** = 需要新加的东西 —— 在某个节点内部，agent 可以调用 tool、发起 sub-query、甚至短暂自主。

**Starlink 当前的错误**：把"多 agent 协作"塞进了硬编码的 `business-langgraph.ts`；正确做法是整个 BMC 是一个 Flow（就是 `BMC_TEMPLATE`），domain agent 节点**内部**可以有小范围的 Crew 行为。

### 模式 4：双 Ledger Orchestrator（来自 Magentic-One）

Critic 不应该是"结尾的装饰"，而应该驱动回滚：

```ts
interface ProgressLedger {
  assignments: Map<nodeId, agentRole>
  status: Map<nodeId, 'pending' | 'running' | 'done' | 'conflicted'>
  conflicts: Array<{ nodeIds: string[], reason: string, severity: number }>
}

// Orchestrator 每轮看两本账：
// - Task Ledger: 事实、假设、当前计划
// - Progress Ledger: 谁在做什么、有哪些冲突
// 冲突超过阈值 → needsRetry[] → 清空下游状态、重跑子图
```

### 模式 5：Store + Subgraphs + Interrupt（LangGraph 原生新能力）

Starlink 已经在 LangGraph 上，升级到最新版本就能白得这三样：

- **`Store`**：跨对话持久记忆。用户连续问 10 个 BMC 问题时，Agent 能调用以前的 BMC 结论，而不是每次从零开始。
- **Subgraphs**：把 Market_Agent 封装成独立 graph，可以独立 checkpoint、独立调试、复用到其它 Flow。
- **`interrupt()` + `Command(resume=...)`**：真正的 HITL。用户在画布上点一张 BMC 卡片"我不同意"，整条流水线可以中断、接收修正、从中断点恢复。

---

## 5. 改进策略 · Agent 层（后端）

### 5.1 P0：取消 80 字截断 + 全量 structured output

**动作**：
1. 定义 `packages/shared/src/schemas/bmc.ts`：
   ```ts
   export const BMCCardSchema = z.object({ /* ... 模式 1 的定义 */ })
   export const BMCAnalysisSchema = z.object({ bmcCards: z.array(BMCCardSchema) })
   ```
2. `tools/llm-agent/market-agent.tool.ts`、`product-agent.tool.ts`、`finance-agent.tool.ts` 全部改用：
   ```ts
   const llm = new LLMClient().withStructuredOutput(BMCAnalysisSchema)
   ```
   删除 `JSON.parse` 和兜底假数据。
3. `business-langgraph.ts` 里 CrossContext 构造：**删除 `.substring(0, 80)`**，传完整 `BMCCard[]`。

**工作量**：半天。**风险**：零（Critic 已经在用 structured output，链路验证过）。

### 5.2 P0：统一 runtime，删除 `business-langgraph.ts`

**现状**：`BMC_TEMPLATE` 在 `seeds/flow-templates.ts:8` 已经完整描述了 BMC 流程，`GraphExecutor` 能跑。只差接线。

**动作**：
1. `conversation-store.ts` 不再 `new BusinessLangGraphService()`，改为：
   ```ts
   const plan = new GraphCompiler().compile(BMC_TEMPLATE)
   const events = new GraphExecutor(registry).execute(plan, { question }, ctx)
   ```
2. Critic 当前的 conflict-detection 逻辑抽成独立 tool `critic_agent`（`BMC_TEMPLATE` 已经引用它）。
3. 删除 `services/business-langgraph.ts`、`agents/market-agent.ts` 两份死代码。

**工作量**：2-3 天（主要是确保现有所有 BMC 用例在新路径下输出一致）。**风险**：中（有行为回归风险，需对比新旧路径输出）。

### 5.3 P1：Domain Agent 三份合一 → 参数化 `DomainAnalystTool`

**动作**：新建一个 `DomainAnalystTool`，通过 config 区分角色：
```ts
{
  toolName: 'domain_analyst',
  config: {
    roleProfile: 'Market_Agent',
    watchDomains: ['customerSegments', 'channels', 'customerRelationships'],
    outputSchema: 'BMCAnalysis',
    goal: '...',
    constraints: ['必须基于证据', '置信度 < 0.6 时标记 need_more_info'],
  }
}
```

删除 `agents/market-agent.ts`、`tools/llm-agent/{market,product,finance}-agent.tool.ts` 三对兄弟文件。

**工作量**：1 天。**收益**：代码量 -500 行；新增一个 domain（例如加"合规 domain"）从改 3 份代码降为改 config。

### 5.4 P1：引入 LangGraph 最新特性

#### 5.4.1 Store：持久 BMC 记忆
```ts
const store = new PostgresStore({ /* ... */ })
// 在 synthesizer 后:
await store.put(['bmc', userId], sessionId, { bmcCards, timestamp })
// domain agent prompt 可以引用历史:
const past = await store.search(['bmc', userId], { limit: 3 })
```

#### 5.4.2 Subgraphs：Domain Agent 独立封装
把每个 domain agent 变成独立 `StateGraph`，主图调用子图。好处：可独立调试、可重试单个 domain、可在其它 Flow 复用。

#### 5.4.3 Interrupt：真 HITL
```ts
// Critic 发现严重冲突时:
const decision = interrupt({
  question: '检测到财务假设与市场细分矛盾，如何处理？',
  conflicts: [...]
})
// 前端弹窗 → 用户选择 "重跑 finance" / "保留矛盾" / "手动修改"
// 通过 Command(resume=decision) 恢复
```

**工作量**：1.5 天。**前置条件**：升级 `@langchain/langgraph` 到支持 `Store`/`interrupt` 的版本。

### 5.5 P2：Critic 反馈闭环（Evaluator-Optimizer 真正闭环）

当前 Critic 只是输出 conflicts，没人用。升级到：
```ts
critic 输出: { conflicts: [...], needsRetry: ['finance-1'], maxRetries: 2 }
↓
GraphExecutor 收到 needsRetry:
  - 清空指定 nodeId 的 state
  - 重置其下游节点
  - 把 criticFeedback 注入回重跑节点的 input
  - 迭代直到 conflicts=[] 或达到 maxRetries
```

**工作量**：2 天。**前置条件**：建立 BMC eval set（50-100 条带金标答案的测试用例），否则无法验证"重跑是否真的改善"。

### 5.6 P3（可选，需先投资 eval set）：DSPy / MIPROv2 prompt 优化

有 eval set 之后，把三个 domain agent 的 prompt 用 DSPy Signature 重写，用 MIPROv2 搜索最优指令+few-shot 组合。**期望收益**：依 DSPy 官方 benchmark 经验，agent 任务提升 15-25 个百分点。

---

## 6. 改进策略 · 无限画布（前端）

> 你之前明确："前端应该是灵活的，你不能写死这个前端"。
> 本章分三部分：先横评 2025–2026 的前端画布/状态/表单生态（§6.1），给出**最终推荐栈**（§6.2），
> 然后在该栈之上做 5 层解耦架构（§6.3）——目标：新增一种 agent 产物 = 加 **1 份 schema**，不动任何组件代码。

### 6.1 前端生态横评

调研覆盖 6 个维度：画布引擎、工作流编辑器、底层图形原语、状态管理、schema 驱动表单、协作层。

#### A. Canvas / Node-editor 引擎

| 库 | 最擅长 | vs React Flow | Starlink 适配 |
|---|---|---|---|
| **React Flow / xyflow v12.7**（当前） | 强类型 React 节点、SSR、`@xyflow/system` 基础层、官方 shadcn 模板 **React Flow Components** | —— | ⭐⭐⭐⭐⭐ **保留**，v12 已解决自动布局 + shadcn 节点问题 |
| **Rete.js v2** | 把「dataflow / control-flow 引擎」与渲染层**分离** | 互补 —— 可借鉴其 `rete-engine` 对 DAG 语义的抽象 | ⭐⭐⭐ 偷概念，不换库 |
| **LiteGraph.js** | ComfyUI 的引擎 | 已归档为独立库，被并入 ComfyUI 仓库 | ❌ 作为独立库已死 |
| **Drawflow** | 极小、纯 JS | React 场景严格劣于 RF | ❌ 跳过 |
| **Sigma.js / Cytoscape.js** | 大图可视化（1k+ 节点）、内置布局算法 | 互补 —— 画布 >500 节点时，可用 Cytoscape 的 headless 布局算法喂给 RF | ⭐⭐ 作为可选加餐 |
| **tldraw SDK 4.3**（2026-01） | 无限画布 + **全局类型化自定义 shape**、内置多人协作、官方 "Workflow" / "Image Pipeline" 模板 | **可能替代** RF，如果要"自由画布 + 节点"合一 | ⭐⭐⭐ BMC 自由探索模式可评估，严格 DAG 编辑仍弱于 RF |
| **Excalidraw** | 手绘感白板 | 可编程性不足 | ❌ 跳过 |

**结论**：React Flow v12 仍是最佳选择，继续用。

#### B. Workflow Builder 参考（不直接集成）

**LangFlow / Flowise / Dify** 三家的前端都与自家后端深度耦合，**没有可复用的前端 npm 包**；**n8n** 是 Sustainable Use License（fair-code），**不能用于商业嵌入**。

**结论**：这四家只当作 UX 参考资料，不作为依赖。

#### C. 底层原语（备选池）

| 库 | 用途 | 何时考虑 |
|---|---|---|
| **Konva / PixiJS / Motion Canvas** | WebGL / Canvas2D 高性能绘制 | RF 撞到性能墙（>2k 实时节点）才考虑，**当前延后** |
| **Yjs + 官方 RF `Collaborative` 示例** | CRDT 多人协作 | 有多人编辑需求时 |
| **Liveblocks Yjs** | 托管版 Yjs + Presence | 如果不想自己搭 Yjs 后端，这是生产最短路径 |
| **React Arborist** | 左侧 DAG 层级树 / Outline 面板 | 画布节点 >30 时强烈推荐 |
| **shadcn/ui** | 节点内部 UI 基座 | 官方 RF Components 已基于此，直接对齐 |

#### D. 状态管理（针对 1124 行 God Store）

| 方案 | 适配评估 |
|---|---|
| **保留 Zustand + Slices + `subscribeWithSelector` + `immer`** | ⭐⭐⭐⭐ 这是架构问题，不是 Zustand 问题。按 feature 拆分即可 |
| **+ Jotai 原子层（补丁）** | ⭐⭐⭐⭐⭐ **关键推荐** —— 每张流式 BMC 卡片用一个 Jotai atom，GraphQL Subscription 只重渲染受影响的卡片，不再触发全局刷新 |
| **Valtio** | ⭐⭐ 代理模式和 Zustand 重叠，迁移不划算 |
| **TanStack Store** | ⭐⭐ 生态太新 |
| **Legend State v3** | ⭐⭐⭐ 细粒度响应式很强，但与 Zustand 混用心智负担大 |

**结论**：**Zustand（切片化）+ Jotai（每个流式节点一个 atom）** 组合拳。

#### E. Schema-Driven UI（配合 §6.3 的 `nodeVisualConfigSchema`）

| 库 | 场景 | 推荐 |
|---|---|---|
| **JSONForms** | 服务器生产 JSON Schema → 渲染 UI | ⭐⭐⭐⭐⭐ **agent 产出的动态节点**用它 |
| **TanStack Form + Zod** | 静态、手写表单 | ⭐⭐⭐⭐ **前端内部配置面板**用它 |
| **Formily** | 企业级复杂表单布局 | ⭐⭐ 过度工程 |
| **uniforms** | 渐衰中 | ❌ |
| **React Hook Form + Zod** | 传统强势，但 TanStack Form 在 DX 上逐步超越 | ⭐⭐⭐ 保守选择 |

**结论**：**JSONForms**（动态、agent 产出）+ **TanStack Form + Zod**（静态、内部）双栈。

#### F. 学术与范式参考

- **ChainForge**（CHI 2024）—— 核心发现：**更少、更强的节点** 胜过大量专用节点。直接支持"砍 13 个硬编码节点为 1 个 UniversalNode + 4 Template"的方向。
- **AFLOW**（ICLR 2025）—— workflow 即图 + 可复用 operator；是你 agent DAG 的抽象参考。

---

### 6.2 推荐前端栈（最终答案）

| 层 | 决定 | 理由 |
|---|---|---|
| **Canvas 引擎** | **保留 React Flow v12**，采用官方 shadcn 版 React Flow Components 作为节点样式基座 | v12 已是 2025 SOTA，迁移无收益 |
| **节点注册表** | 13 种节点 → **1 个 UniversalNode + JSONForms 渲染体** | 实现「新 agent 产物 = 加 schema」 |
| **DAG 执行语义** | 概念上参考 Rete v2 的 dataflow / control-flow 分离 | 前端只渲染，执行归后端 `GraphExecutor` |
| **协作层** | **Liveblocks Yjs** + RF 官方协作示例 | 有多人编辑 BMC 的需求再启用；托管版省运维 |
| **状态管理** | Zustand 切片化（`useBmcStore` / `useAgentStore` / `useCanvasStore`）+ **Jotai per-node atoms** 承接流式更新 | 解决 God Store + 流式重渲染问题 |
| **表单** | **JSONForms**（动态）+ **TanStack Form + Zod**（静态） | 双栈，互不侵蚀 |
| **自由画布模式**（可选） | 评估 **tldraw SDK** 作为 BMC "Spatial" 模式的第二画布 | 不替代 RF，只作为"头脑风暴"替代视图 |

### 6.2.1 漏掉但应该补的 5 件事

1. **Canvas 测试**：Playwright 组件测试 + `@xyflow/react` test utils；视觉回归用 **Chromatic** 或 **Lost Pixel**。
2. **性能剖析**：**react-scan**（2025 新工具）抓 RF 的多余 re-render；`why-did-you-render` 已 EOL。
3. **虚拟化**：RF v12 自带 `onlyRenderVisibleElements={true}`，先打开这个开关，再谈上 PixiJS。
4. **语义缩放（semantic zoom）**：没有库直接给。实现模式 = `useViewport()` 读缩放级别 → 在 UniversalNode 内部做 LOD（低详细度 ↔ 高详细度）组件切换。
5. **Agent 事件时间线**：画布之外单开一个"执行日志"面板，用 **react-window** 虚拟列表；参考 **Perfetto UI** 的多轨道时间线 UX。

---

### 6.3 5 层架构重构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Canvas Controls（布局模式切换/小地图/过滤）    │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Store（瘦身到 ~400 行，无 domain 硬编码）     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: UniversalNode（单一组件 + 4 个 Template）      │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Layout Engine（bmc / dagre / free + Registry）│
├─────────────────────────────────────────────────────────┤
│  Layer 0: Shared Schema（nodeVisualConfigSchema）        │
└─────────────────────────────────────────────────────────┘
```

### 6.3.1 Layer 0 · Visual Config Schema（新增）

在 `packages/shared/src/schemas/visual.ts`：

```ts
export const nodeVisualConfigSchema = z.object({
  template: z.enum(['card', 'alert', 'agent', 'insight']),
  color: z.object({
    primary: z.string(),
    background: z.string(),
    accent: z.string().optional(),
  }),
  icon: z.string(),        // emoji 或 lucide 图标名
  label: z.string(),
  editable: z.boolean().default(false),
  expandable: z.boolean().default(true),
  layoutGroup: z.string().optional(),  // e.g. "bmc:customerSegments"
})
```

每个后端节点产出都携带这个配置，前端**不猜**。

### 6.3.2 Layer 1 · Layout Engine（新增）

**文件**：`apps/web/src/features/comfy/layout/`

```
layout/
  ├── strategies/
  │   ├── bmc-strategy.ts        # 9 宫格，位置由 layoutGroup 决定
  │   ├── dagre-strategy.ts      # 拓扑排序 + 层次布局
  │   └── free-strategy.ts       # 用户自由拖拽
  ├── position-registry.ts       # localStorage 持久化用户调整
  └── layout-manager.ts          # 对外 API
```

**核心**：
- `bmc-strategy` 读 `node.visualConfig.layoutGroup`，把同 group 节点放在同一宫格
- `position-registry` 记住用户手动拖动的位置，切换布局时**保留覆盖**
- 删除 `comfy-store.ts` 里 `Math.random() * 500` 的随机定位

### 6.3.3 Layer 2 · UniversalNode（替代 13 个硬编码节点）

**文件**：`apps/web/src/features/comfy/components/nodes/universal-node.tsx`

```tsx
export function UniversalNode({ data }: NodeProps) {
  const { visualConfig, payload } = data
  const Template = TEMPLATE_MAP[visualConfig.template]
  return (
    <div style={{ background: visualConfig.color.background }}>
      <NodeHeader icon={visualConfig.icon} label={visualConfig.label} />
      <Template payload={payload} editable={visualConfig.editable} />
      {visualConfig.expandable && <ExpandToggle />}
    </div>
  )
}

const TEMPLATE_MAP = {
  card: CardTemplate,
  alert: AlertTemplate,
  agent: AgentTemplate,
  insight: InsightTemplate,
}
```

**删除**：`cc-bmc-card-node.tsx` (477 行)、其它 12 个 `*-node.tsx`，全部合并进 4 个 Template。
**Template 内部渲染**：从 §6.2 的推荐栈——动态内容（如 BMC 卡片的字段编辑、agent 配置项）用 **JSONForms** 根据 agent 产出的 JSON Schema 自动渲染；内部固定表单（如画布设置）用 **TanStack Form + Zod**。

### 6.3.4 Layer 3 · Store 瘦身（Zustand 切片 + Jotai 原子）

**Zustand 层**（全局、静态结构）：按 feature 切片，从 1124 行拆成：
```
store/
  ├── bmc-store.ts        # BMC 卡片集合、domain 分组
  ├── agent-store.ts      # Agent 执行状态、当前运行的 run
  ├── canvas-store.ts     # 视口、选中状态、布局模式
  └── workflow-stage.ts   # 已经设计良好，保留
```
每个切片 ~100–150 行，总量瘦身到 ~400 行。

**Jotai 原子层**（局部、流式更新）—— 来自 §6.1.D 的关键推荐：
```ts
// 每个流式节点一个 atom
export const nodeAtomFamily = atomFamily((nodeId: string) =>
  atom<NodeState>({ status: 'pending', payload: null })
)

// GraphQL Subscription 只更新单个 atom:
subscription.on('node_update', (evt) => {
  store.set(nodeAtomFamily(evt.nodeId), { ...evt.payload })
})
```
**收益**：LLM 流式产出 9 张 BMC 卡片时，每张卡片独立重渲染，不触发全局 store 更新，避免 1000+ 节点场景下的卡顿。

**删除的遗留代码**：
- `MACRA_NODE_TYPES` Set
- `extractMacraNodeData()` 的 switch
- `Math.random()` 定位
- 所有和 domain 形状耦合的逻辑

### 6.3.5 Layer 4 · Canvas Controls

右上角一个布局模式切换器：`[BMC 九宫格] [自动布局] [自由]`。切换时调用 `layout-manager`，保留 `position-registry` 的用户覆盖。
**可选扩展**：多人协作启用后，Liveblocks Presence 在此处显示在线用户头像 + 光标。

---

## 7. 分阶段实施路线图

### Phase 1：救火（P0，~1 周）

| 任务 | 工时 | 依赖 |
|---|---|---|
| §5.1 取消 80 字截断 + structured output | 0.5d | 无 |
| §5.2 删 `business-langgraph.ts`，BMC 走 `BMC_TEMPLATE` | 2.5d | 5.1 完成 |
| §5.3 `DomainAnalystTool` 参数化 | 1d | 5.2 完成 |
| 回归测试（新旧路径输出对比） | 1d | 全部 |

**出口标准**：删掉三份 MarketAgent 中的两份；所有 BMC 用例走 `GraphExecutor`；JSON 解析崩溃率 = 0。

### Phase 2：能力升级（P1，~1 周）

| 任务 | 工时 | 依赖 |
|---|---|---|
| §5.4.1 LangGraph `Store` 接入 | 0.5d | Phase 1 完成 |
| §5.4.2 Domain agent 封装为 subgraphs | 0.5d | |
| §5.4.3 `interrupt()` + HITL 前端弹窗 | 1d | |
| 前端 §6.3.1 Visual Config Schema | 0.5d | 可与后端并行 |
| 前端 §6.3.2 Layout Engine（bmc/dagre/free + position-registry） | 1d | |
| 前端 §6.3.3 UniversalNode + 4 Template + **JSONForms 接入** | 1.5d | schema 先行 |
| 前端 §6.3.4 Store 切片 + **Jotai atomFamily** 接入流式更新 | 1d | |
| 前端 §6.3.5 Canvas Controls（布局切换器） | 0.5d | |
| 升级到 React Flow v12 最新 minor + 采用 React Flow Components (shadcn) | 0.5d | |

**出口标准**：前端新增一种产物类型 = 只改 schema；HITL 链路打通；流式渲染 9 张卡片时 CPU 主线程无跳帧（Chrome Performance 验证）。

### Phase 3：质量闭环（P2，~1 周）

| 任务 | 工时 | 依赖 |
|---|---|---|
| 建立 BMC eval set（50-100 用例） | 2d | 业务介入 |
| §5.5 Critic 反馈闭环 | 2d | eval set |
| 双 Ledger Orchestrator（模式 4） | 1d | 闭环打通 |

**出口标准**：在 eval set 上量化"有 Critic 闭环 vs 无"的分数差；对外可宣传的质量指标。

### Phase 4：优化研究（P3，可选）

| 任务 | 工时 | 备注 |
|---|---|---|
| §5.6 DSPy MIPROv2 prompt 优化 | 3-5d | spike；只有 Phase 3 有 eval set 后才能做 |
| AFlow 风格的自动流程搜索 | 研究性 | 长期方向 |

### 总体里程碑

```
Week 1 ────── Phase 1 救火 ──────────► 两份 runtime 合并，JSON 崩溃消失
Week 2 ────── Phase 2 能力 ──────────► 前端灵活化 + HITL + 记忆
Week 3 ────── Phase 3 闭环 ──────────► eval 指标可量化
Week 4+ ───── Phase 4 研究（选做）
```

---

## 8. 风险、取舍与不做什么

### 8.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| §5.2 删 `business-langgraph.ts` 后行为回归 | 中 | 高 | 双路径并行跑一周，diff 输出 |
| LangGraph 版本升级不兼容 | 低 | 中 | 锁定具体 minor 版本，先在 spike 分支验证 |
| 前端重构导致 ReactFlow 性能退化 | 低 | 中 | 10/50/200 节点场景基准测试 |
| Critic 闭环导致无限循环 | 中 | 低 | 硬编码 `maxRetries=3`，超过就降级 |

### 8.2 关键取舍

**后端：**
- **要 LangGraph 还是迁 Mastra / Vercel AI SDK？** → **留在 LangGraph**。迁移成本 >> 收益，LangGraph 最新版已经覆盖 90% 需求。
- **CrewAI Flows/Crews 要不要直接引入？** → **不引入，但偷模式**。CrewAI 是 Python，Starlink 是 TS；分层思想用 `GraphExecutor (Flow) + agent 内部 agentic loop (Crew)` 实现。
- **DSPy 要不要做？** → **先不做**。没有 eval set 的 DSPy 是空转；Phase 3 建 eval 后再评估。

**前端：**
- **要不要换掉 React Flow？** → **不换**。v12 在 2025-2026 仍是 SOTA，官方 Components (shadcn) 解决了样式统一问题。
- **要不要引入 tldraw？** → **先不引入**。作为 BMC "自由探索模式"的候选，放在 Phase 4 研究；不作为 RF 替代。
- **要不要换 Zustand？** → **不换，补 Jotai**。God Store 是切片问题不是库问题；流式节点的细粒度更新用 Jotai atomFamily 精准打击。
- **要不要直接加 Liveblocks 协作？** → **按需启用**。如果当前无多人编辑需求，Phase 2 不做；启用成本是 0.5-1 天。
- **要不要迁 TanStack Form 替代 React Hook Form？** → **混用**。动态用 JSONForms，静态用 TanStack Form；已有 RHF 代码保留不动。

### 8.3 明确**不做**的事

**后端：**
- ❌ **不引入 MetaGPT**：SOP 形状（PM/Architect/Engineer）不适合 BMC 领域。
- ❌ **不引入 Magentic-One**：中心化 Orchestrator 是单点故障，且 BMC 并行性已经够好。
- ❌ **不迁移到 OpenAI Agents SDK**：没有原生 parallelization 原语，Starlink 的 3 并行 agent 会被迫降级。
- ❌ **不做"让 Supervisor 学会路由"**（arXiv 2505.19591 puppeteer）：过早优化；硬编码路由在 BMC 场景完全够用。
- ❌ **不加向量数据库前置检索**（除非已有需求）：当前 Tool 机制已支持；加只会增加运维面。

**前端：**
- ❌ **不引入 LiteGraph.js**：作为独立库已归档死亡。
- ❌ **不嵌入 n8n / LangFlow / Flowise / Dify 前端**：LangFlow/Flowise/Dify 无可复用包；n8n 是 fair-code 许可不能商用。
- ❌ **不上 Konva / PixiJS**：RF v12 `onlyRenderVisibleElements` 够用，撞到 2k+ 节点实时再说。
- ❌ **不引入 Valtio / TanStack Store / Legend State**：Zustand + Jotai 已覆盖全部场景。
- ❌ **不做 Formily**：对一个 BMC 画布工具是过度工程。

---

## 9. 参考文献

### 源码位置（本地）
- `packages/server/src/services/business-langgraph.ts` —— 当前 BMC 主路径（将被删除）
- `packages/server/src/engine/graph-executor.ts` —— 通用 DAG 执行器（将承接 BMC）
- `packages/server/src/engine/graph-compiler.ts` —— 图编译 / 拓扑排序 / 环检测
- `packages/server/src/seeds/flow-templates.ts:8` —— `BMC_TEMPLATE`（目标形态）
- `packages/server/src/tools/llm-agent/market-agent.tool.ts` —— Domain agent 规范（将合并）
- `apps/web/src/features/comfy/store/comfy-store.ts` —— 前端 God Store（将瘦身）
- `apps/web/src/features/comfy/components/nodes/cc-bmc-card-node.tsx` —— 477 行硬编码节点

### 外部资料
- [Anthropic · Building Effective Agents (2024-12)](https://www.anthropic.com/research/building-effective-agents)
- [AG2 v0.9 Release](https://docs.ag2.ai/latest/docs/blog/2025/04/28/0.9-Release-Announcement/)
- [CrewAI · Flows and Crews](https://crewai.com/crewai-flows)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [Magentic-UI Research Report (MSR, 2025-07)](https://www.microsoft.com/en-us/research/wp-content/uploads/2025/07/magentic-ui-report.pdf)
- [LangGraph · Long-Term Memory / Store](https://changelog.langchain.com/announcements/langgraph-long-term-memory-support)
- [DSPy MIPROv2](https://dspy.ai/api/optimizers/MIPROv2/)
- [PydanticAI](https://ai.pydantic.dev/)
- [MetaGPT · FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT)
- [AFlow (ICLR 2025 oral)](https://arxiv.org/abs/2410.10762)
- [Multi-Agent Collaboration via Evolving Orchestration (2025)](https://arxiv.org/abs/2505.19591)
- [Multi-Agent Collaboration Mechanisms · Survey (2025)](https://arxiv.org/abs/2501.06322)

### 前端框架与生态（§6.1 / §6.2）
- [React Flow 12 Release](https://xyflow.com/blog/react-flow-12-release)
- [React Flow What's New](https://reactflow.dev/whats-new)
- [xyflow Spring 2025 Update](https://xyflow.com/blog/spring-update-2025)
- [React Flow Collaborative Example](https://reactflow.dev/examples/interaction/collaborative)
- [Rete.js v2 Docs](https://retejs.org/docs/)
- [awesome-node-based-uis](https://github.com/xyflow/awesome-node-based-uis)
- [tldraw SDK 4.3 Release](https://tldraw.dev/blog/tldraw-sdk-4.3) · [Customization](https://tldraw.dev/features/customization)
- [Comfy-Org/litegraph.js (archived)](https://github.com/Comfy-Org/litegraph.js/)
- [n8n Sustainable Use License](https://docs.n8n.io/sustainable-use-license/)
- [LangFlow / Flowise / Dify Comparison 2026](https://toolhalla.ai/blog/dify-vs-flowise-vs-langflow-2026)
- [Zustand vs Jotai vs Valtio · Performance Guide 2025](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025)
- [React State Management Trends 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Composable Form Handling 2025 · RHF, TanStack Form, Beyond](https://makersden.io/blog/composable-form-handling-in-2025-react-hook-form-tanstack-form-and-beyond)
- [TanStack Form / RHF / Formisch 2026](https://formisch.dev/blog/react-form-library-comparison/)
- [Liveblocks Yjs](https://liveblocks.io/docs/ready-made-features/multiplayer/sync-engine/liveblocks-yjs)
- [Synergy Codes · Yjs + React Flow](https://www.synergycodes.com/blog/real-time-collaboration-for-multiple-users-in-react-flow-projects-with-yjs-e-book)
- [react-scan](https://github.com/aidenybai/react-scan) · 2025 RF 重渲染诊断工具

### 前端无限画布学术参考
- **ChainForge**（CHI 2024）· [ACM DL](https://dl.acm.org/doi/10.1145/3613904.3642016) · 关键发现：少而强的节点 > 多而专的节点
- **AFLOW**（ICLR 2025）· [arXiv](https://arxiv.org/pdf/2410.10762) · workflow 即图 + 可复用 operator
- Bederson & Hollan (1994) · **Pad++** · zoomable interface 的经典形态
- Cockburn, Karlson, Bederson (2008) · **A Review of Overview+Detail, Zooming, and Focus+Context Interfaces** · ACM CSUR
- Kobourov (2013) · **Force-Directed Drawing Algorithms** · Handbook of Graph Drawing
- ReTrace / Hippo · 推理过程可视化工具链

---

**文档维护者**：Claude（Opus 4.7）· 基于对话 2026-04-22
**下一步建议**：与团队对齐 Phase 1 的 1 周排期，先看三份 MarketAgent 合并和 JSON 解析稳定性的实际收益；前端在 Phase 2 同步启动 Visual Config Schema + UniversalNode + Jotai atomFamily 三件事。

---

## 变更记录

- **v1.0** (2026-04-22) · 初版：后端 Agent 框架横评 + 5 层前端解耦方案 + 3+1 Phase 路线图
- **v1.1** (2026-04-22) · 补充前端生态调研：React Flow v12 保留决定、Rete/tldraw/LiteGraph 评估、Zustand+Jotai 组合状态方案、JSONForms+TanStack Form 双栈表单；§6.3.4 改为 Jotai atomFamily 承接流式更新；§8 加前端取舍与禁区
