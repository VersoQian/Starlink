# Starlink Codex

## 项目愿景与背景
- **Starlink** 是一个「对话即画布」的多服务协作平台，支持将复杂议题拆解为可视化的多维节点网络，并在 AI 参与下不断延展研究脉络。
- 整体设计沿袭 Branching Chat/Kuse 画布理念：一个问题会被自动拆解为分支、维度、行动计划与引用证据，帮助团队同步理解、规划与复盘。
- 仓库采用 pnpm workspaces 维护前后端一体化的工程体系，既可以联合开发，也能单独启动各个服务。

## 仓库结构概览
- `frontend/` – Next.js (App Router) 画布前端，含 React Flow 画布、AI 助手、文档抽屉等模块。
- `packages/server/` – Express + Apollo Server GraphQL 网关，负责汇总画布数据、触发 AI 推理并通过 Subscription 推送增量。
- `packages/agent-runtime/` – LangChain/LangGraph Agent Runtime，实现问题拆解、节点生成、知识补全等流水线。
- `packages/shared/` – 共享的 Zod Schema 与 TypeScript 类型，统一节点/事件的契约。
- `backend/` – 传统 REST/GraphQL 组合的知识库与 LangChain 服务，前端 `/api` 路由会转发到此服务。
- `docs/` – 架构设计文档（如 `frontend-architecture.md`）。
- `biz-canvas-agents/`、`dialogs/` – 辅助材料或实验性 Agent 配置（暂未纳入主流程）。

## 核心服务说明
- **Frontend (`frontend/`)**
  - 技术栈：Next.js App Router、React Flow、TanStack Query、Zustand、Tailwind。
  - 核心组件：`CanvasViewport`（画布节点渲染）、`AssistantPanel`、`DocumentDrawer`、`NodePalette`、`TimelineHistoryPanel`。
  - 数据来源：通过 GraphQL Client 拉取 `workspaceGraph`，并使用 SSE/WS 订阅增量；本地 `/api` 路由继续对接旧的 LangChain REST 服务（分析问题、时间线同步等）。
  - 状态管理：TanStack Query 管理服务端数据，Zustand (`store/canvas-store.ts`) 管理 UI 和任务状态。
  - 测试：Playwright 端到端测试位于 `frontend/tests`。

- **GraphQL Gateway (`packages/server/`)**
  - 技术栈：Express + Apollo Server + graphql-ws。
  - `src/index.ts` 启动 HTTP 与 WS 服务，挂载 `/graphql`。
  - Resolver 使用 `ConversationStore` 将对话上下文（workspace、question、user）与画布数据绑定，并触发 `runCanvasPipeline`。
  - Subscription 通过 `graphql-subscriptions` 的 `PubSub` 推送 `conversationProgress` 事件（初始画布、增量更新、状态变更）。

- **Agent Runtime (`packages/agent-runtime/`)**
  - LangGraph/LangChain 驱动的流水线，输入 `workspaceId`、`question`、`userId`。
  - `runCanvasPipeline` 按阶段生成：根任务节点 → 分支问题 → 分析维度 → 行动计划 → 结合知识库补充引用节点。
  - `tools/knowledge-base.ts` 定义知识检索接口，默认使用 `MockKnowledgeBaseClient`，后续可接入真实 KB 服务。
  - `agent/multi-tool-agent.ts` 暴露 `createStarlinkAgentExecutor` / `runStarlinkAgentTask`，基于 LangChain `AgentExecutor` + 通义千问或 DeepSeek 模型，将知识检索、画布巡检、节点建议等工具组合成多工具 Agent。
  - 结果返回 `CanvasExecutionResult`，包含整图与逐步增量，供 Subscription 播放。

- **共享类型 (`packages/shared/`)**
  - 使用 Zod 定义 `CanvasNodeData`、`CanvasGraph`、`ConversationEvent` 等结构，前后端都通过该包保持类型一致。
  - 由其他包通过 workspace:* 依赖引用。

- **Legacy Knowledge Backend (`backend/`)**
  - Express REST + GraphQL 组合，提供 `/kb` 系列 CRUD、文件上传、LangChain 分析等能力。
  - 前端的 `/api/analyze`、`/api/timeline` 等 Route Handler 会透传请求至该服务的 `/ai/*` 端点。
  - 该服务仍保留“Knowledge Base”命名，后续可以视 Starlink 品牌重构命名与模块职责。

## 数据流与交互
1. 用户在 Starlink 前端创建或拖拽节点，前端通过 GraphQL Mutation（计划中）或本地模拟更新状态。
2. 针对新问题触发 `startConversation` Mutation，GraphQL Gateway 调用 Agent Runtime 生成画布，并将初始图与增量通过 Subscription 推送回前端。
3. 前端在 `/api/analyze` 端点提交更复杂的分析任务；Next.js Route Handler 会代理到 Legacy Backend 的 `/ai/analyze`，由 LangChainService 产生新的时间线/节点建议。
4. `packages/shared` 提供统一的 Schema，保证 Agent、Server 与 Frontend 的数据结构一致。

## 本地开发与运行
- **前置条件**：Node.js 18+，pnpm 8+（推荐），可选 Bun。
- **安装依赖**：在仓库根目录执行 `pnpm install` 会为所有 workspace 安装依赖。
- **启动流程**：
  1. `pnpm dev:server` – 启动 GraphQL Gateway (`packages/server`)。
  2. `pnpm dev:agent` – 若需单独调试 LangChain 流水线。
  3. `pnpm dev:frontend` – 启动 Next.js 前端，访问 `http://localhost:3000`。
  4. `pnpm --filter backend dev`（或进入 `backend/` 执行 `pnpm dev`）– 启动 Legacy REST/LangChain 服务，供 `/api` 代理调用。
- **测试**：
  - 前端：`pnpm test:e2e` 运行 Playwright；`pnpm test:e2e:headed` 进入调试。
  - Agent/Server：目前主要依赖 TypeScript 校验（`pnpm --filter <pkg> lint`）；可按需新增 Vitest/Jest。
  - Backend：`pnpm --filter backend test`（Jest）。

## 环境变量
- `frontend/.env.local`
  - `NEXT_PUBLIC_GRAPHQL_URL`：GraphQL Gateway 入口（默认 `http://localhost:4000/graphql`）。
  - `BACKEND_API_BASE_URL`：Legacy Backend 根地址（默认 `http://localhost:4000`）。
- `packages/agent-runtime`
  - `DEEPSEEK_API_KEY`：多工具 Agent 使用 DeepSeek 时必填。
  - `DEEPSEEK_MODEL` / `DEEPSEEK_TEMPERATURE`：可选，覆盖 DeepSeek 模型与温度。
  - `DEEPSEEK_API_URL` / `DEEPSEEK_MAX_OUTPUT_TOKENS`：可选，自定义 DeepSeek 接口地址或单次输出上限。
  - `DASHSCOPE_API_KEY`：启用通义千问时必填（也可使用 `TONGYI_API_KEY` / `QWEN_API_KEY`）。
  - `TONGYI_MODEL` / `TONGYI_TEMPERATURE`：可选，覆盖默认模型与采样参数。
- `packages/server`
  - `PORT`：GraphQL 服务端口（默认 4000）。
  - 需要时可通过 `NODE_OPTIONS=--inspect` 等变量辅助调试。
- `backend/.env`
  - `DATABASE_URL`：Prisma/PostgreSQL 连接串。
  - `UPLOAD_DIR`：上传目录。
  - `PORT`：REST/GraphQL 服务端口。
  - `DASHSCOPE_API_KEY`：通义千问（DashScope）API Key，调用分析 Agent 必填。
  - `TONGYI_MODEL` / `TONGYI_TEMPERATURE`：可选，定制模型与采样温度。

## GraphQL 能力速览（packages/server）
- `Query.workspaceGraph(workspaceId: ID!)` – 获取指定 workspace 的完整画布。
- `Mutation.startConversation(workspaceId: ID!, question: String!)` – 触发 AI 推理生成画布，返回初始元数据与图。
- `Subscription.conversationProgress` – 订阅画布增量事件，事件类型：
  - `graph/appended`：完整图的首次播报。
  - `graph/diff`：后续增量节点/连线。
  - `status`：会话状态更新（`running`/`completed`/`failed`）。

## Agent Pipeline 简述
- `buildInitialState` 创建根节点：记录问题上下文、引导用户理解画布。
- `addSubQuestions` 基于模板生成 3 个分支问题节点。
- `addDimensions` 为每条分支补充分析维度节点（价值、执行、验证）。
- `addActionPlan` 跟随维度生成行动计划节点。
- `enrichWithKnowledge` 调用 `KnowledgeBaseClient.search`；若命中知识条目，会将摘要写入根节点同时生成引用节点。
- Pipeline 支持自定义 `knowledgeClient`，可在真实环境里注入访问知识库的实现。

## Starlink 品牌化注意事项
- 当前 npm 包名仍使用 `@branching-chat/*`，后续如需全面更名，可在各 `package.json` 与 import 路径中替换。
- 文档、日志输出、环境变量等也仍引用旧名称（如服务器启动日志），建议在迭代中逐步调整为 Starlink。
- 若要统一命名，请从 `package.json`、`.env`、GraphQL endpoint 日志、README/CODEX 等文档着手。

## 后续演进建议
- **GraphQL Mutation 覆盖**：目前画布更新主要由 Agent 推送，尚缺乏手动增删节点的 Mutation，可结合 `conversationStore` 扩展。
- **真实知识库接入**：实现 `KnowledgeBaseClient`，连接 `backend/` 的知识库或外部检索服务，替换 Mock。
- **多租户/鉴权**：Context 默认 `userId=anonymous`，需要接入实际认证系统并在 Subscription 中校验权限。
- **前端数据统一**：理顺 `/api` 代理与 GraphQL 双轨逻辑，逐步将 LangChain 调用迁移至 GraphQL Gateway，降低耦合。

---

如需进一步使用 Starlink 名称，可参考本 Codex 对仓库现状、服务拓扑与命名调整的建议进行迭代。
