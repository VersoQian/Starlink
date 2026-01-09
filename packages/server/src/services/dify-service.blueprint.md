# Dify 服务端调用蓝图

此文档记录 `DifyServerService` 的调用约定、重试策略与审计集成，供其他后端模块参考。

## 调用约定
- `runWorkflow` 统一处理阻塞与流式模式，外部无需直接操作 `fetch`。
- 调用者可通过 `priority`、`metricsTag` 注入编排上下文，字段最终会写入 Dify 请求 `metadata`。
- 所有请求在进入 service 前应完成鉴权与输入校验，保证 `inputs` 为纯 JSON 对象。

## 重试策略
- `retry.attempts` 控制最大尝试次数，默认 1 次；当返回 `>=500` 的 `DifyRequestError` 时触发重试。
- `retry.delayMs` 用于指数回退基础值（当前实现为固定延迟，可根据需要扩展为指数函数）。
- 对于客户端主动取消（`AbortError`）或 4xx 错误不会继续重试。

## 审计与日志
- 通过 `@starlink/shared` 暴露的 `createAuditLogger` 记录 `runWorkflow` 与 `generateSummary` 行为。
- 日志字段包含 `userId`、`workflowId`、`attempt` 等元数据，可与前端 `/api/dify` 的审计条目关联。
- 若需接入集中日志平台，可在此模块替换 `createAuditLogger` 实现，无需修改业务调用者。

## 扩展建议
1. 如需支持多工作流配置，可在构造函数注入工作流注册表，并在 `resolveWorkflowId` 内实现负载策略。
2. 若需要兼容自签名证书或私网代理，可扩展 `fetch` 选项，传入自定义 `agent` 或 `headers`。
3. 流式模式可在 future 中改造为返回异步迭代器，以便按 chunk 级别插入节流或内容审查。
