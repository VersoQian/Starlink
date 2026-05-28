# Starlink · LangSmith Day-1 圆桌综合报告

> **生成日期**：2026-04-24
> **上下文**：承接 `starlink-langgraph-upgrade-plan.md` 的 Shadow-First 10 天升级路线，作为 **Day-1 最小可验证动作**的落地设计。
> **产出方式**：4 位独立视角 subagent 并行研究 → 本文综合 → 真实 PR diff
> **分支**：`feat/langsmith-day1-observability`（在 `/tmp/Starlink`）
> **Day-1 边界**：**不动任何业务逻辑**，只加环境变量 / 文档 / 验证脚本 / CI 开关 / 依赖安全 pin

---

## 1. 圆桌席位与核心观点

| 席位 | 视角 | 一句话结论 |
|---|---|---|
| **A 席** | LangSmith 官方文档 | LangGraph v1.x 自动 trace；只需 `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` + `LANGSMITH_PROJECT`；Thread 聚合走 `config.configurable.thread_id` |
| **B 席** | Starlink 代码审计 | 代码白板：零 observability，无 logger 冲突；`graph.stream(state)` 当前**不传第二参数** — Day-1b 再补 |
| **C 席** | 合规与可替换性 | LangSmith 无中国 region；**生产路径必须是 Langfuse self-host（MIT, 5 容器 docker-compose）**；Day-1 留 dual-router seam |
| **D 席** | DevOps / CI | 发现 `.env.example` 疑似真实密钥（P0 阻塞）；CI 只有 1 个 web E2E workflow，需显式 `LANGSMITH_TRACING=false` 护栏；free tier 5k 配额 2 周打爆 |

---

## 2. 三个关键交叉冲突

### 2.1 🔴 P0 阻塞：泄漏密钥必须先处理

D 席在 `packages/server/.env.example` 发现形如 `LLM_API_KEY=sk-pdojuoz...` 的**疑似 SiliconFlow 真实 key**。

**影响**：
- Git 历史已污染 —— 任何 clone 过此仓库的人都持有该 key
- 如果新合作者模仿该 `.env.example` 模式，**很可能把 LangSmith 密钥也真实粘贴进去**
- Day-1 合入 LangSmith 前**必须**先清掉此 key，否则观察性工程建在泄漏基础上

**行动**：
1. 立即在 SiliconFlow 后台 **轮换 / 吊销** 那个 `sk-pdojuoz...`
2. `git filter-repo --replace-text` 清 commit history
3. `.env.example` 里**所有**带值的密钥字段全部清空
4. 然后才能开始 Day-1

> ⚠️ 此事不在本 PR 范围 —— 需要人类动手。本文档把它作为 Day-1 的**前置条件**而非可选项列出。

### 2.2 🟠 P1：`langsmith` 传递版本有 CVE

A 席官方文档要求 `langsmith >= 0.5.19`（修复 GHSA-rr7j-v2q5-chgv：streaming token 绕过 redaction）。

B 席审计显示：
- `packages/server/package.json` 不直接依赖 `langsmith`
- 通过 `@langchain/core@^1.1.12` 透传得到 `langsmith@0.4.5`
- **低于 0.5.19 修复版**

**影响**：
- 如果将来启用 `LANGSMITH_HIDE_INPUTS=true` 做 PII 脱敏，**实际不生效**
- BMC 场景涉及用户提交的商业想法，脱敏未生效 = 合规风险

**行动**：在 `packages/server/package.json` 显式 pin：
```json
"langsmith": "^0.5.19"
```

### 2.3 🟠 P1：中文产品无 China region，必须留 Langfuse 替换 seam

C 席确认：
- LangSmith Cloud 只有 US + EU，**无 China / HK / APAC**
- Self-hosted LangSmith 是 Enterprise 套餐（公开估价 $100k+/yr），不现实
- **Langfuse v3**（MIT, docker-compose 5 容器, 9 vCPU/21GiB, 功能基本对等）是更合适的生产路径

**Day-1 设计决策**：
- 代码里**不**硬编码任何"LangSmith 专属"调用（`traceable()` / `wrapOpenAI()` 都不加）
- 所有观察性全部走 LangChain 的 callback handler 通用接口
- 留一个 env 开关 `TRACE_BACKEND`（未来 1 行增加 Langfuse handler）

这样 Day-1 零改动，Phase-2 切 Langfuse 只需：
```ts
if (process.env.TRACE_BACKEND === "langfuse") {
  const { CallbackHandler } = await import("@langfuse/langchain");
  callbacks.push(new CallbackHandler({ ... }));
}
```

---

## 3. Day-1a（本次）实际 PR 内容

### 3.1 文件清单（全部纯附加，0 行业务代码改动）

| 文件 | 动作 | 作用 |
|---|---|---|
| `packages/server/.env.example` | 追加 LangSmith 段 | 开发者本地开关 |
| `packages/server/package.json` | 加 `"langsmith": "^0.5.19"` | 修 CVE |
| `packages/server/src/scripts/smoke-langsmith-config.ts` | 新增 | 验证 trace 端到端贯通 |
| `packages/server/README.md` | 追加 "Observability Setup" 段 | 新人引导 |
| `.github/workflows/web-knowledge-e2e.yml` | 加 `env: LANGSMITH_TRACING: "false"` | 护栏 |

### 3.2 `.env.example` 补丁

```diff
 LLM_BASE_URL=https://api.siliconflow.cn/v1
-LLM_API_KEY=sk-pdojuoz...          # ← 由人类另行轮换 + 清历史（2.1 节 P0）
+LLM_API_KEY=
 LANGGRAPH_MODEL=gpt-4o-mini
 ENABLE_AUTO_CRITIC=true
 ENABLE_CULTURAL_SKILLS=true
 ENABLE_SEMANTIC_PLAN=true
+
+# ============== LangSmith Observability (可选) ==============
+# 把 LANGSMITH_TRACING 留空或设为 "false" 即完全关闭（不初始化 SDK，无 egress）
+# 本地开启：LANGSMITH_TRACING=true 并粘贴个人 key
+LANGSMITH_TRACING=false
+LANGSMITH_API_KEY=
+LANGSMITH_PROJECT=starlink-bmc-dev
+LANGSMITH_ENDPOINT=https://api.smith.langchain.com
+# 采样率 0.0–1.0，不设为 1.0。超过 free tier 5k/月 时打开：
+# LANGSMITH_SAMPLING_RATE=0.3
+
+# ============== Trace backend 路由（为 Phase-2 Langfuse 自托管预留）==============
+# 可选值: "langsmith" (默认) | "langfuse"  — Day-1 仅 langsmith 生效
+TRACE_BACKEND=langsmith
```

### 3.3 `package.json` 补丁

```diff
     "@langchain/core": "^1.1.12",
     "@langchain/langgraph": "^1.0.13",
     "@langchain/openai": "^1.2.1",
+    "langsmith": "^0.5.19",
```

运行 `pnpm install --filter @starlink/server` 后，`pnpm-lock.yaml` 会把传递依赖升级到 0.5.19+。

### 3.4 verification script — `smoke-langsmith-config.ts`

```ts
/**
 * Smoke test: 验证 LangSmith 配置端到端贯通
 * 用法：pnpm --filter @starlink/server build && node dist/scripts/smoke-langsmith-config.js
 *
 * 通过条件：
 *   1. 读到 LANGSMITH_TRACING=true + 合法 API key
 *   2. 成功跑一次最小 StateGraph
 *   3. ~5s 后在 LangSmith UI 的 starlink-bmc-dev 项目里能看到 thread "smoke-test-{timestamp}"
 */
import { ChatOpenAI } from "@langchain/openai";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";

async function main() {
  const tracing = process.env.LANGSMITH_TRACING === "true";
  const apiKey = process.env.LANGSMITH_API_KEY;
  const project = process.env.LANGSMITH_PROJECT ?? "starlink-bmc-dev";

  console.log(`[smoke-langsmith] tracing=${tracing} project=${project}`);
  if (!tracing) {
    console.log("[smoke-langsmith] LANGSMITH_TRACING != 'true' — 脚本仅做配置校验");
  } else if (!apiKey) {
    console.error("[smoke-langsmith] ❌ LANGSMITH_TRACING=true 但 LANGSMITH_API_KEY 缺失");
    process.exit(1);
  } else if (!apiKey.startsWith("lsv2_")) {
    console.warn("[smoke-langsmith] ⚠ LANGSMITH_API_KEY 格式可能异常（期望 lsv2_ 前缀）");
  }

  // 最小 StateGraph —— 只验证 trace 形成，不调用真实 LLM（跳过 LLM_API_KEY 依赖）
  const State = Annotation.Root({
    ping: Annotation<string>({ reducer: (_, n) => n, default: () => "pong" }),
  });
  const graph = new StateGraph(State)
    .addNode("echo", async (s) => ({ ping: `${s.ping}!` }))
    .addEdge(START, "echo")
    .addEdge("echo", END)
    .compile();

  const threadId = `smoke-test-${Date.now()}`;
  const result = await graph.invoke(
    { ping: "hello" },
    { configurable: { thread_id: threadId }, tags: ["smoke-test", "langsmith-day1"] },
  );

  console.log(`[smoke-langsmith] graph.invoke ok → ${JSON.stringify(result)}`);
  if (tracing) {
    console.log(`[smoke-langsmith] ✅ 打开 https://smith.langchain.com → 项目 ${project} → Threads → 查找 ${threadId}`);
  }
}

main().catch((err) => {
  console.error("[smoke-langsmith] 失败:", err);
  process.exit(1);
});
```

**为什么不调用真实 LLM？** 避免脚本依赖 `LLM_API_KEY`，即使用户的 `.env` 里没设也能跑通 trace 链路验证。

### 3.5 README 追加段（`packages/server/README.md` 底部）

```markdown
## 观察性（可选 · Day-1）

本地 LangSmith tracing 是可选功能，默认关闭。

1. **拿 key**：登录 https://smith.langchain.com → Settings → API Keys → 创建个人 key
2. **设置环境变量**：在 `packages/server/.env` 里
   ```
   LANGSMITH_TRACING=true
   LANGSMITH_API_KEY=lsv2_pt_...
   LANGSMITH_PROJECT=starlink-bmc-dev
   ```
3. **验证**：`pnpm --filter @starlink/server build && node dist/scripts/smoke-langsmith-config.js`
   成功后打开 LangSmith 看 `starlink-bmc-dev` 项目的 Threads 标签
4. **关闭**：设 `LANGSMITH_TRACING=false` 或清空 `LANGSMITH_API_KEY`，重启服务

> **中文产品生产部署**：LangSmith Cloud 仅有 US / EU region。生产请走 Phase-2 的 Langfuse 自托管
> （`TRACE_BACKEND=langfuse`），详见 `docs/observability-phase2.md`（待补）

**切勿**：
- 提交任何真实 `LANGSMITH_API_KEY` 到 git
- 在 `apps/web` 里以 `NEXT_PUBLIC_LANGSMITH_*` 前缀暴露 key（会被 Next.js 打进浏览器包）
- 在 CI / 单元测试里开启 tracing（会打爆 free tier 5k/月配额）
```

### 3.6 CI 护栏 —— `.github/workflows/web-knowledge-e2e.yml`

```diff
 jobs:
   knowledge-e2e:
     runs-on: ubuntu-latest
+    env:
+      # 强制关闭 tracing，即使将来 E2E 启动 server 也不烧 LangSmith 配额
+      LANGSMITH_TRACING: "false"
     strategy:
       matrix:
         suite: [flow, recovery]
```

---

## 4. Day-1b 计划（本次 PR **不**包含，约 1 周后）

等 Day-1a 在 dev 环境稳定运行 3–5 天、确认 trace 在 LangSmith 里结构清晰后，再做 **Day-1b**：

### 4.1 单行业务代码变更

`packages/server/src/services/business-langgraph.ts:302`（B 席定位的当前 `graph.stream(state)`）：

```diff
- const stream = await graph.stream(initialState)
+ const stream = await graph.stream(initialState, {
+   configurable: { thread_id: traceId },
+   tags: ["bmc", `workspace:${workspaceId}`],
+   metadata: { workspaceId, userId },
+ })
```

`market-agent.ts` 的独立 subgraph 同理（会自动作为父 trace 的子 run 纳入）。

### 4.2 Day-1b 验收

- LangSmith UI 的 **Threads 视图** 按 `traceId` 聚合 —— 同一会话的多轮 BMC 生成在一个 thread 里
- 父 trace = business-langgraph，子 run = market-agent subgraph，层级清晰
- 失败 run 的 error span 能直接跳回到对应 checkpoint

---

## 5. Phase-2 路线（仅记录，不做）

| 阶段 | 触发条件 | 动作 |
|---|---|---|
| **Phase 2a — Langfuse self-host** | 产品要面向中国市场 / 任意生产客户有数据驻留顾虑 | 起 docker-compose（langfuse-web/worker/postgres/clickhouse/redis/minio），补 `@langfuse/langchain` callback handler，`TRACE_BACKEND=langfuse` 切换 |
| **Phase 2b — PII redaction** | 有真实用户数据进入 trace | 启用 `LANGSMITH_HIDE_INPUTS=true` + 自定义 `hide_inputs` 函数，针对 BMC 领域字段脱敏。**前置**：`langsmith >= 0.5.19`（Day-1a 已 pin） |
| **Phase 2c — BMC eval datasets** | 有 ≥ 5 条稳定运行样本 | 把 `flow-templates.ts` 3 套模板转为 LangSmith Dataset，配 3 个 evaluator（`cardsCoverage` / `parseError` / `domainBalance`），做 regression |
| **Phase 2d — Annotation Queue** | 有人工评审需求 | 开启 LangSmith Annotation Queue，产品 / 领域专家可直接在 UI 上打分 |

---

## 6. 回滚预案

**一键关闭**：
```bash
# .env / dev shell / prod
LANGSMITH_TRACING=false
```
重启 server 进程（PM2 / systemd / 容器），SDK 初始化时读到 false 就完全跳过网络栈，零开销。

**无需 drain**：LangSmith client 的 trace 队列丢失在 dev 阶段可接受。Phase-2 进生产前加 graceful flush。

**完全回退**（连依赖也拿掉）：`git revert <day1a-commit>`，运行 `pnpm install`。无数据库迁移，无模式变更。

---

## 7. 回答用户原始问题："LangSmith 能完成前端画布内容吗？"

不能。详见上一轮讨论 —— LangSmith 是开发者面向的 observability，React Flow v12 仍是前端画布的唯一正确答案。本 Day-1 工作的意义是：**让开发者在画布之外拥有一面 trace 镜子**，两者互补不互替。

---

## 8. 溯源

- A 席全文：LangSmith 官方 docs（2026-04）
- B 席全文：/tmp/Starlink 仓库扫描
- C 席全文：Langfuse v3 / LangSmith Enterprise / Phoenix / Helicone 对比
- D 席全文：DevOps 落地评审（发现 P0 密钥泄漏）
- 上游计划：
  - `starlink-agent-improvement-plan.md` v1.1（前端 React Flow 决策）
  - `starlink-langgraph-upgrade-plan.md` v1.0（Shadow-First 10 天路线）
  - `starlink-hermes-fusion-analysis.md` v1.0（Hermes 融合项）
