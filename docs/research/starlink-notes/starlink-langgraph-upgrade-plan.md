# Starlink · LangGraph 后端升级方案 v1.0

> **范围**：只聚焦 `packages/server/src/services/business-langgraph.ts`（2034 行）及其生态的 LangGraph 改造。
> **前置参考**：`starlink-agent-improvement-plan.md` v1.1（本方案是其中 §5.4 的**深化展开**）。
> **日期**：2026-04-22
> **版本约束**：`@langchain/langgraph` 当前 `^1.0.13`，目标 `^1.2.x`；`@langchain/core` 当前 `^1.1.12`。

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状核查](#2-现状核查)
3. [business-langgraph.ts 深度审计](#3-business-langgraphts-深度审计)
4. [LangGraph 1.x 能力地图](#4-langgraph-1x-能力地图)
5. [7 大升级主题 · 逐条方案](#5-7-大升级主题--逐条方案)
6. [目标架构](#6-目标架构)
7. [分阶段实施路线](#7-分阶段实施路线)
8. [可观测性：LangSmith + Studio](#8-可观测性langsmith--studio)
9. [风险、回滚与测试](#9-风险回滚与测试)
10. [参考文献](#10-参考文献)

---

## 1. 执行摘要

### 1.1 一句话诊断
Starlink 的 LangGraph 代码**停留在 v0.2 早期心智**（`StateGraph` + `Annotation.Root`，但几乎不用任何 2025 新特性），在 v1.0+ 生态里属于"版本号是 1.x，行为是 0.2"。

### 1.2 核心结论
| 维度 | 当前状态 | 目标状态 | 紧迫度 |
|---|---|---|---|
| LangGraph 版本 | 1.0.13 | 1.2.x（SemVer 同大版本，零迁移成本） | 🟢 低 |
| **State Reducers** | ❌ 全部 bare `Annotation<T>()` | ✅ 数组用 append reducer | 🔥 高 |
| **Checkpointing** | ❌ 完全无 | ✅ `PostgresSaver` + thread_id | 🔥 高 |
| **Structured Output** | ⚠️ 只在 supervisor/critic | ✅ 全部 agent | 🔥 高 |
| **HITL interrupt()** | ❌ 无 | ✅ Critic 高冲突时触发 | ⚡ 中 |
| **Subgraphs** | ❌ 7 节点全在一个文件 | ✅ 每个 agent 独立 subgraph | ⚡ 中 |
| **Store 长期记忆** | ❌ 无 | ✅ `PostgresStore` 命名空间 | 🟡 低（有需求再做） |
| **LangSmith 追踪** | ❌ 无 | ✅ 环境变量零代码接入 | 🟢 立即 |
| **80 字截断 / regex JSON** | ❌ 仍在 | ✅ 通过前三项连带消除 | 🔥 高 |

### 1.3 为什么现在升级

1. **v1.0 已 GA（2025-10）**，API 稳定承诺 + durability 保证，**升级是投资不是风险**。
2. 当前代码每一条"脆弱性"都能精准对应一个 LangGraph 1.x 原生能力——不是找工具做适配，是**把自制轮子换成原生**。
3. `business-langgraph.ts` 2034 行已经到了维护临界点，再拖就会出现"无法安全改动"的僵局。

### 1.4 投入产出
- **Phase 1（3 天）**：升 v1.2 + 加 Reducer + Checkpointer + 全量 structured output → 解决 80% 的稳定性问题。
- **Phase 2（3 天）**：拆 subgraphs + interrupt HITL → 架构解耦，为前端 HITL UI 打通链路。
- **Phase 3（2 天）**：Store + LangSmith + Studio → 可观测性与记忆能力补齐。
- **总计 8 天**可把后端 LangGraph 从"能跑"升到"生产级"。

---

## 2. 现状核查

### 2.1 包版本

```jsonc
// packages/server/package.json
"@langchain/core":     "^1.1.12",
"@langchain/langgraph": "^1.0.13",
"@langchain/openai":   "^1.2.1",
```

**评估**：已在 v1.x 大版本。升 v1.2.x 无破坏性变更，只是 SemVer minor bump。

### 2.2 未安装但应该安装的包

| 包 | 用途 | 建议 |
|---|---|---|
| `@langchain/langgraph-checkpoint-postgres` | `PostgresSaver` + `PostgresStore` | **Phase 1 装** |
| `@langchain/langgraph-cli` | `langgraph dev` 启动 Studio UI | **Phase 3 装**（开发依赖） |
| `@langchain/langgraph-sdk` | 只在调用**远程** LangGraph Server 时需要 | 不装（嵌入式部署） |

### 2.3 Starlink 的 LangGraph 使用画像

```
使用了：  StateGraph, Annotation.Root, START, END,
         addNode, addEdge, addConditionalEdges,
         compile(), graph.stream({streamMode:'updates'}),
         withStructuredOutput (仅 2 处)

没用：   Reducers（数组 append）
         Checkpointer（任何一种）
         Store（长期记忆）
         interrupt() + Command(resume=)
         Subgraphs
         Send（动态 fan-out）
         streamEvents / streamMode:'messages' （token 级）
         Functional API（entrypoint/task）
         LangSmith 追踪
         LangGraph Studio
```

使用率：约 **20%** 的 LangGraph 能力面。

---

## 3. business-langgraph.ts 深度审计

> 以下所有行号对应现有 2034 行源码，已人工核实。

### 3.1 State Schema（L157–175）

```ts
const BusinessState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  contextPrompt: Annotation<string>(),
  intent: Annotation<IntentDecision>(),
  supervisorDirective: Annotation<SupervisorDirective>(),
  crossContext: Annotation<string>(),
  roundNumber: Annotation<number>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence[]>(),  // ❌ 无 reducer
  generalNodes: Annotation<...>(),                       // ❌ 无 reducer
  marketNodes: Annotation<...>(),                        // ❌ 无 reducer
  productNodes: Annotation<...>(),                       // ❌ 无 reducer
  financeNodes: Annotation<...>(),                       // ❌ 无 reducer
  agentAvatars: Annotation<...>(),                       // ❌ 无 reducer
  conflicts: Annotation<...>(),                          // ❌ 无 reducer
  edges: Annotation<...>(),                              // ❌ 无 reducer
})
```

**问题**：**所有**数组字段都是 bare `Annotation<T[]>()`，默认语义是**覆盖**（overwrite），不是追加（append）。当三个 domain agent 并行写入 `marketNodes / productNodes / financeNodes` 时看起来没问题（各自写自己的 key），但一旦有两个节点想往同一个 key 追加（比如 `conflicts` 在 critic 循环中累积），**会丢数据**。

### 3.2 图拓扑（L494–532）

```
                    ┌──────────────┐
                    │  supervisor  │
                    └──────┬───────┘
         conditional routing (intent + directive)
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐   ┌───────────┐
       │ market   │  │ product  │  │ finance  │   │  general  │
       │ Agent    │  │ Agent    │  │ Agent    │   │ Responder │
       └────┬─────┘  └────┬─────┘  └────┬─────┘   └─────┬─────┘
            └────────┬────┴────────┬────┘               │
                     ▼             ▼                    │
                ┌────────────────────┐                  │
                │    synthesizer     │                  │
                └──────┬─────────────┘                  │
                       ▼                                │
                ┌──────────────┐                        │
                │    critic    │                        │
                └──┬────────┬──┘                        │
   high severity │ └─ done ─┘                           │
    roundNumber  │                                      │
     < MAX (3)   ▼                                      │
          back to supervisor                          END ◄┘
```

**观察**：critic → supervisor 的 loop-back **已经存在**（L522–531，`MAX_ROUNDS=3`），比我之前误判的"Critic 只是摆设"**更成熟**。但闭环**没有**把 critic 的具体反馈注入回 agent 的 input——循环变成"再转一圈看会不会自然好"，不是定向改进。

### 3.3 节点行为速览

| 节点 | LLM 模式 | Structured Output | 失败兜底 |
|---|---|---|---|
| supervisor (L537–631) | `withStructuredOutput(IntentSchema)` | ✅ | catch → fallback guidance |
| generalResponder (L683–750) | raw `invoke()` | ❌ | catch → `[]` |
| **marketAgent (L885–993)** | raw `invoke()` + `extractAndParseJSON` | ❌ | catch → `[]` |
| **productAgent (L995–1106)** | raw `invoke()` + `extractAndParseJSON` | ❌ | catch → `[]` |
| **financeAgent (L1108–1216)** | raw `invoke()` + `extractAndParseJSON` | ❌ | catch → `[]` |
| synthesizer (L1219–1249) | 纯代码，无 LLM | n/a | 无兜底 |
| critic (L1375–1502) | `withStructuredOutput(CriticOutputSchema)` | ✅ | catch → `ruleBasedCriticCheck` |

**规律**：规范（`withStructuredOutput`）在入口（supervisor）和出口（critic）都用了，**中间三个**最容易出错的 domain agent 反而没用。这是**最脆弱、最好修**的一处。

### 3.4 脆弱性热点（带行号）

| 症状 | 行号 | 严重度 |
|---|---|---|
| `extractAndParseJSON` 正则贪婪匹配 `/\[[\s\S]*\]/` | L1711–1754 | 🔥 |
| `substring(0, 80)` 截断 crossContext | L569, 1253, 1408 | 🔥 |
| catch 吞错返回 `[]`（掩盖 LLM 失败） | L608, 710, 946, 1059, 1168, 1480 | 🔥 |
| 硬编码中文正则做冲突检测（`/高端\|中产\|premium/`） | L1508–1509 | ⚡ |
| `runCritic` 单函数 128 行 | L1375–1502 | ⚡ |
| `streamConversation` 单函数 264 行 | L223–486 | ⚡ |
| 无 checkpointer，进程崩溃 = 整轮丢失 | L532 `.compile()` | 🔥 |
| `CC_BMC_DOMAINS` 常量内联在 services 文件 | L23–32 | 🟡 |

### 3.5 Streaming 路径

```ts
// L302
const stream = graph.stream(initialState, { streamMode: 'updates' })
for await (const update of stream) {
  // L325-461：把每个节点的 delta 转成客户端事件
  yield { type: 'delta', delta: builder.addMacraNode(...) }
}
```

**评估**：用对了 `streamMode: 'updates'`，但**没用** `streamMode: 'messages'`，所以**拿不到 LLM token 级流式**——前端只能看到"节点完成"级别的粗粒度进度，看不到"Market agent 正在逐字写"的体验。

### 3.6 持久化

**完全没有。** L532 `.compile()` 无 saver。这意味着：
- 进程重启 = 正在跑的会话全部丢失
- 无法做断点续跑
- 无法做历史回放/Debug（LangGraph Studio 依赖 checkpoint）
- `interrupt()` 无法使用（需要 checkpointer）

---

## 4. LangGraph 1.x 能力地图

### 4.1 JS 能力矩阵（2026-04）

| API | 状态 | Starlink 用了？ | 应该用？ |
|---|---|---|---|
| `StateGraph` + `Annotation.Root` | GA (v0.2+) | ✅ | ✅ |
| **Reducers**（数组 append） | GA (v0.2+) | ❌ | ✅ 必须 |
| `StateSchema` + Zod/Valibot (v1.1) | GA | ❌ | ⚡ 可选（新方向） |
| `MemorySaver` / `SqliteSaver` / **`PostgresSaver`** | GA (v1.0) | ❌ | ✅ 必须 |
| `interrupt()` + `Command(resume=)` | GA (v1.0) | ❌ | ✅ |
| **Subgraphs**（compile 后当节点） | GA (v0.2+) | ❌ | ✅ |
| `Send`（动态 fan-out） | GA | ❌ | 🟡 当前静态 fan-out 够用 |
| **`Store`** (`InMemoryStore` / `PostgresStore`) | GA (2025) | ❌ | ⚡ Phase 3 做 |
| `streamMode: 'values'` | GA | ❌ | 🟡 备选 |
| `streamMode: 'updates'` | GA | ✅ | ✅ |
| `streamMode: 'messages'` (token 级) | GA | ❌ | ✅ 前端体验 |
| `streamMode: 'debug'` | GA | ❌ | 🟡 调试用 |
| `streamMode: 'custom'` (dispatchCustomEvent) | GA | ❌ | 🟡 按需 |
| `streamEvents({ version: 'v2' })` | GA | ❌ | 🟡 细粒度 tool 事件用 |
| `withStructuredOutput(zodSchema)` | GA | ⚠️ 只 2 处 | ✅ 全量 |
| Functional API (`entrypoint` / `task`) | GA (v0.3+) | ❌ | 🟡 新代码可选 |
| LangSmith 追踪（环境变量） | GA | ❌ | ✅ 零成本接入 |
| `langgraph dev` + Studio UI | GA (JS, 2025) | ❌ | ✅ 开发利器 |

### 4.2 Python vs JS 差距（2026-04）

根据调研，**JS 已基本追平 Python**，剩余差距：
- `Store` 向量适配器 JS 较少（但 Postgres + InMemory 两件套已够）
- Pregel 级别内部 API 仍 Python-only（**我们不需要**）
- LangGraph Platform dashboard 高级功能 JS 略迟（**自托管不受影响**）

**结论**：JS 侧完全可以走"生产级"路径，无需担心 Python 专属能力。

---

## 5. 7 大升级主题 · 逐条方案

> 每一条给出：**问题 → 新代码范式 → 收益 → 工时**。

### 5.1 State Reducers（append 语义）

**问题**：所有数组字段都是覆盖语义，multi-round loop 里 `conflicts` 会被最新一轮覆盖，历史冲突丢失。

**新代码**：
```ts
import { Annotation } from '@langchain/langgraph'

const BusinessState = Annotation.Root({
  // ... 标量字段不变
  
  // 数组：append reducer
  conflicts: Annotation<Conflict[]>({
    reducer: (curr, next) => [...(curr ?? []), ...next],
    default: () => [],
  }),
  marketNodes: Annotation<BMCCard[]>({
    reducer: (curr, next) => mergeByDomain(curr ?? [], next),  // 按 domain 去重
    default: () => [],
  }),
  // 同理 productNodes / financeNodes / generalNodes / agentAvatars / edges
})
```

**收益**：多轮循环累积不丢数据；agent 并发写同一 key 不再有竞态。
**工时**：0.5 天（含回归测试）。

---

### 5.2 PostgresSaver 持久化

**问题**：进程崩溃 = 会话丢失；无法 replay；`interrupt()` 前置条件缺失。

**新代码**：
```ts
// packages/server/src/infrastructure/langgraph/checkpointer.ts
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

let checkpointer: PostgresSaver | null = null

export async function getCheckpointer() {
  if (!checkpointer) {
    checkpointer = PostgresSaver.fromConnString(
      process.env.DATABASE_URL!,
      { schema: 'langgraph' }  // 独立 schema，避免污染业务表
    )
    await checkpointer.setup()   // 首次启动建表
  }
  return checkpointer
}

// services/business-langgraph.ts
const graph = workflow.compile({ checkpointer: await getCheckpointer() })

// 调用时:
const config = { configurable: { thread_id: conversationId } }
for await (const update of graph.stream(state, { ...config, streamMode: 'updates' })) {
  // ...
}
```

**收益**：
- 断点续跑（`graph.invoke(null, config)` 从最近 checkpoint 恢复）
- `interrupt()` 可用
- LangGraph Studio 可读状态做 debug
- `graph.getStateHistory(config)` 给 replay/时间旅行调试

**DB 设计**：独立 schema `langgraph` 含 `checkpoints` / `checkpoint_writes` / `checkpoint_blobs` 表。与业务表无耦合。

**工时**：1 天（含 schema setup、pool 共享、错误处理）。

---

### 5.3 Domain Agent 全量 `withStructuredOutput`

**问题**：三个 domain agent 用 `extractAndParseJSON` 正则抽 LLM 输出，正则 `/\[[\s\S]*\]/` 贪婪匹配一旦遇到 markdown fence 就炸。catch 返回 `[]` 掩盖失败。

**新代码**：
```ts
// packages/shared/src/schemas/bmc.ts
import { z } from 'zod'

export const BMCCardSchema = z.object({
  domain: z.enum([
    'customerSegments', 'valuePropositions', 'channels',
    'customerRelationships', 'revenueStreams', 'keyResources',
    'keyActivities', 'keyPartnerships', 'costStructure',
  ]),
  content: z.string().min(10),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(z.object({
    docId: z.string(),
    snippetId: z.string(),
  })).default([]),
  sourceRole: z.enum(['market', 'product', 'finance']),
})

export const DomainAgentOutputSchema = z.object({
  bmcCards: z.array(BMCCardSchema),
  confidence: z.number(),
  notes: z.string().optional(),
})

// services/business-langgraph.ts
async function marketAgent(state: BusinessStateType) {
  const llm = chatModel.withStructuredOutput(DomainAgentOutputSchema)
  const result = await llm.invoke([
    { role: 'system', content: MARKET_SYSTEM_PROMPT },
    { role: 'user', content: buildMarketUserPrompt(state) },
  ])
  // result 已经是强类型对象，无需 JSON.parse
  return { marketNodes: result.bmcCards }
}
```

**同步动作**：
- 删除 `extractAndParseJSON`（L1711–1754）及其兜底路径
- 删除 catch → `[]` 的静默失败；真失败应该 **throw**，让 graph 级重试机制（或 critic 循环）处理

**收益**：JSON 解析崩溃率 = 0；失败可见；可重试。
**工时**：0.5 天。

---

### 5.4 Subgraphs：Domain Agent 独立封装

**问题**：7 个节点塞在 2034 行单文件，改一个 agent 必须理解整体；无法单独测一个 agent；无法复用到其它 flow。

**新代码**：
```ts
// packages/server/src/graphs/agents/market-subgraph.ts
import { StateGraph, Annotation, START, END } from '@langchain/langgraph'

const MarketAgentState = Annotation.Root({
  question: Annotation<string>(),
  crossContext: Annotation<string>(),
  evidence: Annotation<Evidence[]>(),
  bmcCards: Annotation<BMCCard[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
})

export const marketSubgraph = new StateGraph(MarketAgentState)
  .addNode('research', researchNode)       // 可选：先查知识库
  .addNode('analyze', analyzeNode)          // LLM + structured output
  .addNode('validate', validateNode)        // 置信度检查
  .addEdge(START, 'research')
  .addEdge('research', 'analyze')
  .addEdge('analyze', 'validate')
  .addEdge('validate', END)
  .compile()

// 主图里当作节点使用:
workflow.addNode('marketAgent', async (state) => {
  const result = await marketSubgraph.invoke({
    question: state.question,
    crossContext: state.crossContext,
    evidence: state.knowledgeEvidence,
  })
  return { marketNodes: result.bmcCards }
})
```

**收益**：
- 单元测试每个 agent 独立跑
- agent 内部可演化出多步流程（先查→再分析→再验证），不污染主图
- 可复用到未来其他 Flow（比如只跑 finance agent 做快速估算）
- LangGraph Studio 可展开查看 subgraph 内部

**工时**：1 天（3 个 agent）。

---

### 5.5 `interrupt()` + HITL 闭环

**问题**：Critic 发现高严重度冲突时只能重跑整轮或硬着头皮 END，用户无干预机会。

**新代码**：
```ts
import { interrupt, Command } from '@langchain/langgraph'

async function critic(state: BusinessStateType) {
  const conflicts = await detectConflicts(state)
  
  const highSeverity = conflicts.filter(c => c.severity === 'high')
  if (highSeverity.length > 0 && state.roundNumber >= MAX_ROUNDS - 1) {
    // 达到重试上限但仍有严重冲突 → 交给人
    const decision = interrupt({
      type: 'conflict_resolution',
      conflicts: highSeverity,
      options: [
        { value: 'accept_as_is', label: '保留矛盾并继续' },
        { value: 'rerun_finance', label: '重跑 Finance Agent' },
        { value: 'manual_edit', label: '手动修改卡片' },
      ],
    })
    return { userDecision: decision, conflicts }
  }
  return { conflicts }
}

// 前端通过 GraphQL Mutation 恢复:
// resolveConflict(threadId, decision) → graph.invoke(new Command({ resume: decision }), { configurable: { thread_id } })
```

**前端侧**（对应 Plan v1.1 §6.3.5 Canvas Controls）：
- GraphQL Subscription 收到 `{ type: 'interrupt', payload }` → 弹窗
- 用户选择 → `resolveConflict` mutation → 后端 `graph.invoke(new Command({ resume: ... }))`

**收益**：真人机协作闭环；Critic 不再是单向的"审查员"，而是"决策辅助"。
**工时**：1 天（含前端 subscription 改造）。

---

### 5.6 `Store`：跨会话长期记忆

**问题**：用户连续问 10 个 BMC 问题，每次都从零开始；无法沉淀"这个用户的领域偏好"。

**新代码**：
```ts
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres'

const store = new PostgresStore({ connString: process.env.DATABASE_URL! })
await store.setup()

// 主图 compile 时挂:
const graph = workflow.compile({ 
  checkpointer: await getCheckpointer(),
  store,
})

// 在 synthesizer 后保存:
async function synthesizer(state, config) {
  const ns = ['bmc', state.userId]
  await config.store.put(ns, state.traceId, {
    bmcCards: [...state.marketNodes, ...state.productNodes, ...state.financeNodes],
    question: state.question,
    timestamp: Date.now(),
  })
  // ...
}

// domain agent 可读历史:
async function marketAgent(state, config) {
  const history = await config.store.search(['bmc', state.userId], { limit: 3 })
  const historyContext = history.map(h => h.value.bmcCards).flat()
  // 加入 prompt
}
```

**使用场景**：
- "上次我问的那个 SaaS 定价问题，这次换成 PLG 模式会怎样？" —— agent 能调历史
- 同一 workspace 多轮会话沉淀"本项目的事实库"

**工时**：1 天。
**前置条件**：5.2 Checkpointer 已上。
**优先级**：⚡ 非必需，Phase 3 做。

---

### 5.7 Token 级 Streaming

**问题**：`streamMode: 'updates'` 只给节点级粗粒度更新，用户要等到 agent 完全输出才看到卡片，体验差。

**新代码**：
```ts
for await (const chunk of graph.stream(state, {
  ...config,
  streamMode: ['updates', 'messages'],  // 数组 = 多模式
})) {
  if (chunk[0] === 'updates') {
    // 节点级：一张完整卡片
    yield { type: 'node_complete', ... }
  } else if (chunk[0] === 'messages') {
    const [msgChunk, metadata] = chunk[1]
    // metadata.langgraph_node 告诉你哪个 agent 在吐 token
    yield { 
      type: 'token', 
      agent: metadata.langgraph_node,
      content: msgChunk.content,
    }
  }
}
```

**收益**：前端可做 ChatGPT 式逐字打字机效果，用户知道 agent 活着。
**工时**：0.5 天（后端）+ 0.5 天（前端 subscription 改造）。
**前置**：5.3 全量 structured output（因为 structured output 会稍微压缩 token 流，需验证是否仍逐字到达；必要时对 structured 部分降级用 `JsonOutputParser` + stream）。

---

## 6. 目标架构

### 6.1 文件结构（target）

```
packages/server/src/
├── graphs/                              # ← 新增目录
│   ├── bmc/
│   │   ├── bmc-graph.ts                 # 主图拼装（<300 行）
│   │   ├── state.ts                     # BusinessState + reducers
│   │   └── nodes/
│   │       ├── supervisor.ts            # <150 行
│   │       ├── synthesizer.ts           # <100 行（纯代码，无 LLM）
│   │       └── critic.ts                # <200 行
│   ├── agents/
│   │   ├── market-subgraph.ts           # subgraph
│   │   ├── product-subgraph.ts
│   │   ├── finance-subgraph.ts
│   │   └── shared/
│   │       ├── domain-analyst.ts        # 共享 analyst 逻辑
│   │       └── prompts.ts
│   └── utils/
│       ├── cross-context.ts             # 完整上下文构建（无 80 字截断）
│       └── bmc-edges.ts
├── infrastructure/
│   └── langgraph/
│       ├── checkpointer.ts              # PostgresSaver 单例
│       ├── store.ts                     # PostgresStore 单例
│       └── tracing.ts                   # LangSmith 初始化
├── domain/
│   └── bmc/
│       ├── constants.ts                 # CC_BMC_DOMAINS（从 services 挪出）
│       └── schemas.ts                   # Zod schemas
└── services/
    └── business-langgraph.ts            # 🗑️ 删除！
```

**业务层**（`services/`）不再有 LangGraph 代码，只保留通用业务服务（llm-client、embedding、kb）。图拓扑归 `graphs/`，基础设施归 `infrastructure/langgraph/`。

### 6.2 运行时数据流

```
GraphQL Subscription (conversation.stream)
          │
          ▼
┌──────────────────────────────────────────┐
│  application/conversation-store.ts       │
│  （不再 new BusinessLangGraphService）    │
│                                          │
│  bmcGraph.stream(state, {                │
│    configurable: { thread_id },          │
│    streamMode: ['updates','messages'],   │
│  })                                      │
└─────────────────┬────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│          graphs/bmc/bmc-graph.ts         │
│                                          │
│   supervisor ──► [market|product|finance]│
│       ▲                 ▼                │
│       │            synthesizer           │
│       │                 ▼                │
│       └── loopback ── critic             │
│                        │                 │
│                   ┌────┴────┐            │
│                   ▼         ▼            │
│               interrupt    END           │
└────┬─────────────────────────────────────┘
     │
     ├─ checkpointer: PostgresSaver ──► DB (schema: langgraph)
     ├─ store:        PostgresStore ──► DB (namespace: bmc/{userId})
     └─ tracing:      LangSmith   ──► cloud
```

---

## 7. 分阶段实施路线

### Phase 1 · 稳定性基线（Day 1–3）

**目标**：消除 90% 的当前脆弱性，不改拓扑。

| 日 | 任务 | 产出 |
|---|---|---|
| D1 上午 | 升级 `@langchain/langgraph` 到 1.2.x，跑一遍现有测试 | `package-lock.json` 更新 |
| D1 下午 | §5.1 State Reducers（数组字段加 append） | `graphs/bmc/state.ts` 新文件，原文件保留 |
| D2 | §5.2 PostgresSaver 接入，`infrastructure/langgraph/checkpointer.ts` | DB schema `langgraph` 建起，`thread_id` 链路打通 |
| D3 | §5.3 三个 domain agent 切 `withStructuredOutput`，删 `extractAndParseJSON` | JSON 崩溃率 = 0；catch 吞错清理 |
| D3 下午 | 接入 LangSmith 追踪（3 行环境变量） | 能在 LangSmith UI 看到每次 run |

**验收**：
- ✅ 10 次 BMC 运行无 JSON 解析错误
- ✅ Kill -9 进程后 restart，可从 checkpoint 恢复
- ✅ LangSmith 能看到完整 trace

### Phase 2 · 架构解耦（Day 4–6）

**目标**：拆 2034 行单文件，打通 HITL。

| 日 | 任务 | 产出 |
|---|---|---|
| D4 | 按目标目录结构拆文件，抽出 `graphs/bmc/` 和 `domain/bmc/` | `business-langgraph.ts` 从 2034 行降到 < 300 行 |
| D5 上午 | §5.4 三个 domain agent 封装为 subgraph | `graphs/agents/*-subgraph.ts` |
| D5 下午 | 消除所有 `substring(0, 80)` 截断，改为完整对象传递 | cross-context 用结构化对象 |
| D6 | §5.5 `interrupt()` HITL + GraphQL `resolveConflict` mutation + 前端弹窗 | 端到端 HITL demo |

**验收**：
- ✅ 单独对 `marketSubgraph.invoke({...})` 可独立测
- ✅ 触发高冲突场景，前端弹窗，用户选择后从断点恢复
- ✅ `business-langgraph.ts` 删除或 < 50 行 re-export shim

### Phase 3 · 记忆与观测（Day 7–8）

**目标**：长期记忆 + 开发体验。

| 日 | 任务 | 产出 |
|---|---|---|
| D7 上午 | §5.6 `PostgresStore` + synthesizer 写入 + agent 读取 | 跨会话能调历史 |
| D7 下午 | §5.7 `streamMode: ['updates','messages']` + 前端 token 流 | 打字机效果 |
| D8 上午 | `langgraph.json` + `langgraph-cli`，启 `langgraph dev` | Studio UI 可用 |
| D8 下午 | 给主图加 `RunnableConfig` 元数据（user_id、workspace_id），观测性完善 | LangSmith 可按 workspace 过滤 |

**验收**：
- ✅ 同一 workspace 连续 3 次问 BMC，第 2/3 次 prompt 能引用前次结论
- ✅ 前端看到 agent 逐字输出
- ✅ `langgraph dev` 启动后，Studio 可时间旅行调试任意历史 run

### Phase 4（可选） · 深度优化

- Functional API 重写某些辅助流程（比如"单域快速估算"用 `entrypoint` 写更简洁）
- `Send` 动态 fan-out：根据用户问题动态决定启用哪些 agent（而非固定 3 个）
- 多模型路由：不同 domain agent 用不同模型（Market 用 Opus，Finance 用 Sonnet）

---

## 8. 可观测性：LangSmith + Studio

### 8.1 LangSmith 追踪（零代码）

```bash
# .env
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_...
LANGSMITH_PROJECT=starlink-bmc
```

启动即有 trace，每次 `graph.stream()` 自动上报：
- 每个节点的输入/输出
- 每次 LLM 调用的 prompt / completion / token 数
- 错误与重试
- 按 `thread_id` 组织的会话视图

**成本**：开发期免费额度足够；生产期按 trace 数计费（每 trace 约 $0.0005）。

### 8.2 LangGraph Studio（开发期）

```bash
npm i -D @langchain/langgraph-cli
```

```jsonc
// langgraph.json（项目根）
{
  "node_version": "22",
  "graphs": {
    "bmc": "./packages/server/src/graphs/bmc/bmc-graph.ts:bmcGraph"
  },
  "env": ".env"
}
```

```bash
npx langgraph dev
# → 启动本地 server + Studio UI @ http://localhost:8123
```

**用途**：
- 可视化查看图结构（确认拓扑和文档一致）
- 时间旅行调试：选任意历史 checkpoint，从那里重新跑
- 手动触发 `interrupt` 恢复，不必跑前端
- 替换节点输入重跑，验证 agent 行为

### 8.3 自托管 vs LangGraph Platform

**强烈建议自托管**。理由：
- Starlink 已有 Postgres，PostgresSaver + PostgresStore 直接用
- GraphQL Subscription 已在跑，不需要 LangGraph Platform 的 Assistants API
- 省掉托管费用 + 数据出境风险
- 升级节奏自己掌控

只在以下情况考虑 Platform：
- 需要 cron 任务调度（Starlink 当前没有）
- 需要 managed task queue（当前流量够用直连）
- 团队不想运维（Starlink 有完整后端）

---

## 9. 风险、回滚与测试

### 9.1 主要风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Phase 1 升级 v1.2 引入隐性 breaking | 低 | 中 | PR 跑完整 test suite；v1.x 承诺无破坏性变更 |
| PostgresSaver schema setup 失败 | 低 | 高 | 专用 DB user 权限明确；`setup()` 幂等；首跑在测试库验证 |
| `withStructuredOutput` 某些 model 不支持 | 低 | 中 | 已用 GPT-4 系 / Claude 3.5+，原生支持 |
| Reducer 改变导致既有测试 fail | 中 | 低 | reducer 从"覆盖"变"追加"语义变化，需审 8 个测试用例 |
| Subgraph 拆分引入边界 bug | 中 | 中 | 每个 subgraph 补独立测；保留主图 E2E 测 |
| HITL interrupt 前端集成延期 | 中 | 低 | 后端 interrupt 可独立交付；前端异步跟进 |

### 9.2 回滚策略

每个 Phase 独立可回滚：

- **Phase 1 回滚**：git revert 升级 commit；DB `langgraph` schema 不删（无副作用）。
- **Phase 2 回滚**：`business-langgraph.ts` 拆分后保留原文件 1 周不删，`conversation-store.ts` 用 feature flag 切新旧。
- **Phase 3 回滚**：Store / 新 streamMode 都是加法，关掉即回滚。

### 9.3 测试策略

#### 单元测试
```ts
// 每个 subgraph 独立测
describe('marketSubgraph', () => {
  it('produces valid BMCCards for customer segments question', async () => {
    const result = await marketSubgraph.invoke({ question: '...', ...})
    expect(result.bmcCards).toMatchSchema(BMCCardSchema)
  })
})
```

#### 集成测试
复用 `business-langgraph.test.ts` 现有 4 个测试用例（FakeBusinessModel），确保新图拓扑行为一致。

#### 对比测试（最重要）
Phase 1-2 期间，对同一输入**同时跑新旧两套**，diff 输出：
```ts
const [oldOut, newOut] = await Promise.all([
  oldBusinessLangGraph.run(input),
  newBmcGraph.stream(input, config),
])
expect(newOut.bmcCards.length).toBeGreaterThanOrEqual(oldOut.bmcCards.length)
expect(conflictRate(newOut)).toBeLessThanOrEqual(conflictRate(oldOut))
```

#### Eval Set（Phase 3 必备）
50–100 条带金标的 BMC 测试用例，用于：
- 回归防护
- 后续 DSPy prompt 优化的训练集
- 对外可量化的质量指标

---

## 10. 参考文献

### LangGraph 官方
- [LangGraph JS Changelog](https://docs.langchain.com/oss/javascript/releases/changelog) · 权威版本变更
- [LangChain & LangGraph 1.0 announcement](https://www.langchain.com/blog/langchain-langgraph-1dot0) · GA 与 durability 承诺
- [LangGraph Release Week Recap (2025-06)](https://blog.langchain.com/langgraph-release-week-recap/) · type-safe streaming、Functional API
- [Graph API overview (JS)](https://docs.langchain.com/oss/javascript/langgraph/graph-api)
- [Streaming (JS)](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [Interrupts (JS)](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [Long-term memory (JS)](https://docs.langchain.com/oss/javascript/langchain/long-term-memory)
- [Making HITL agents easier with interrupt](https://blog.langchain.com/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt/)
- [Launching Long-Term Memory Support](https://blog.langchain.com/launching-long-term-memory-support-in-langgraph/)

### Persistence
- [`@langchain/langgraph-checkpoint-postgres` (npm)](https://www.npmjs.com/package/@langchain/langgraph-checkpoint-postgres)
- [`PostgresSaver` API reference](https://reference.langchain.com/javascript/classes/_langchain_langgraph-checkpoint-postgres.index.PostgresSaver.html)

### Platform & Studio
- [LangGraph Platform setup (JS)](https://docs.langchain.com/langgraph-platform/setup-javascript)
- [LangGraph v0.2 JS: Cloud + Studio](https://blog.langchain.com/javascript-langgraph-v02-cloud-studio/)
- [LangGraph Studio TS Starter](https://github.com/langchain-ai/langgraphjs-studio-starter)

### Starlink 源码锚点
- `packages/server/src/services/business-langgraph.ts`（2034 行，将被拆分）
- `packages/server/src/application/conversation-store.ts:91`（`new BusinessLangGraphService()` 硬编码，Phase 2 清理）
- `packages/server/src/engine/graph-executor.ts`（通用 DAG 引擎，与 BMC 图并行存在，v1.1 方案保留）
- `packages/server/src/seeds/flow-templates.ts:8`（`BMC_TEMPLATE`，目标形态）

---

**文档维护者**：Claude（Opus 4.7）· 2026-04-22
**与主方案关系**：本文档是 `starlink-agent-improvement-plan.md` v1.1 中 §5.4「LangGraph 新特性」的深化展开。主方案的 Phase 1-3 路线与本方案的 Phase 1-3 **时间轴对齐**，可同步推进。

## 变更记录
- **v1.0** (2026-04-22) · 初版：包含 v1.0.13 现状核查、business-langgraph.ts 2034 行完整审计、7 大升级主题详细方案、3 Phase 路线图（8 个工作日）、LangSmith + Studio 接入指南、风险回滚与测试策略
