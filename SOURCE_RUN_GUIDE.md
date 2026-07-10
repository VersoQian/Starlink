# Starlink System Source Run Guide

本文档用于说明如何从源码包启动 Starlink 系统。项目使用 pnpm workspace 组织前端、服务端和共享包，不建议使用 `npm install`。

## 1. Environment Requirements

- Node.js 20 或更高版本
- pnpm 9 或更高版本
- Docker Desktop，可选，但推荐用于启动本地 PostgreSQL 和 Redis
- 一个可用的 LLM API key，例如 DeepSeek、OpenAI 兼容接口或其他兼容服务

如果只想查看前端页面，可以不配置完整模型服务；如果要运行商业画布生成、RAG、记忆和评测流程，则必须配置数据库和模型 API key。

## 2. Install Dependencies

在源码根目录执行：

```bash
corepack enable
pnpm install
```

不要使用：

```bash
npm install
```

原因是本项目使用 `workspace:*` 本地包依赖，`npm install` 在部分环境下无法正确解析 pnpm workspace。

## 3. Configure Environment Files

复制示例环境文件：

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp packages/server/.env.example packages/server/.env
```

前端默认访问：

```bash
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

服务端至少需要配置：

```bash
DATABASE_URL=postgres://sheng@localhost:5431/kb_dev
PORT=4000
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=your_api_key_here
LANGGRAPH_MODEL=deepseek-chat
```

如果使用其他 OpenAI-compatible provider，需要相应修改 `LLM_BASE_URL`、`LLM_API_KEY` 和 `LANGGRAPH_MODEL`。

Embedding 配置是可选项。不配置时系统会使用 local-hash fallback，页面和基础流程可以运行，但知识库检索和引用质量会下降。生产或演示建议配置真实 embedding provider。

## 4. Start Local Database Dependencies

推荐用 Docker 启动 PostgreSQL 和 Redis：

```bash
docker compose up -d postgres redis
```

该配置会启动：

- PostgreSQL: `localhost:5431`
- Redis: `localhost:6379`

数据库连接字符串可使用：

```bash
DATABASE_URL=postgres://sheng@localhost:5431/kb_dev
```

首次启动后运行数据库迁移：

```bash
pnpm --filter @starlink/server db:migrate
```

## 5. Start Backend

在一个终端中执行：

```bash
pnpm dev:server
```

服务端默认运行在：

```text
http://localhost:4000/graphql
```

健康检查地址：

```text
http://localhost:4000/health
```

## 6. Start Frontend

另开一个终端执行：

```bash
pnpm dev:web
```

前端默认运行在：

```text
http://localhost:3000
```

浏览器打开该地址即可访问系统界面。

## 7. Common Commands

```bash
# 安装依赖
pnpm install

# 启动服务端
pnpm dev:server

# 启动前端
pnpm dev:web

# 构建前端
pnpm build:web

# 构建服务端
pnpm build:server

# 运行前端端到端测试
pnpm test:e2e
```

## 8. Notes for Source Package Users

源码包中不包含以下内容：

- `.git`
- `node_modules`
- 本地数据库目录 `data`
- 构建产物 `dist`、`.next`
- 运行输出目录 `output`、`outputs`
- 临时渲染目录 `tmp`、`tmp-docx`
- benchmark / evaluation 实验数据和运行日志
- 真实环境变量文件，例如 `packages/server/.env` 和 `apps/web/.env.local`

因此，拿到源码包后需要先安装依赖、复制 `.env.example` 文件并填写必要配置。

## 9. Minimal Startup Checklist

```bash
corepack enable
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
cp packages/server/.env.example packages/server/.env
docker compose up -d postgres redis
pnpm --filter @starlink/server db:migrate
pnpm dev:server
pnpm dev:web
```

如果上述命令都成功，访问：

```text
http://localhost:3000
```

即可进入 Starlink 系统。
