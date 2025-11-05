# Dify 工作流接口蓝图

该文件描述 `frontend/src/config/dify.ts` 中暴露的工作流配置模型，供后续接入团队复用与扩展。

## 配置结构
- **基础字段**：`id` 为逻辑工作流标识；`appId` 与 `apiKey` 分别映射到 Dify App；`mode` 指定默认调用模式（阻塞/流式）。
- **网络参数**：`baseUrl` 支持在单个工作流上覆盖全局 Dify API 网关；`tenantId` 用于多租户隔离。
- **策略字段**：
  - `rateLimit`：由 `identifier`（`user`、`tenant`、`workflow`、`ip`）、`intervalMs` 与 `limit` 组成，前端 `/api/dify` Route 将基于这些规则做内存限流。
  - `quota`：声明日/月额度，供编排层或审计系统读取。
  - `fallback`：当工作流不可用时的回退工作流与提示语，可在路由层做兜底。
  - `defaultPriority` 与 `metricsTag` 会下发给 `DifyService`，用于优先级调度与指标打点。
- **标签信息**：`tags`、`metadata` 作为工作流列表展示与治理的补充字段。

## 使用约定
1. 所有工作流必须在环境变量中声明 `DIFY_<NAME>_APP_ID` 与 `DIFY_<NAME>_API_KEY`，并在本文件登记统一 ID。
2. 若新增 `rateLimit` 规则，需要同步检查 `/api/dify/route.ts` 的 `createRateLimitKey` 是否覆盖新的 `identifier`。
3. `fallback.workflowId` 应指向同文件已定义的工作流，以避免运行时解析失败。
4. 多租户场景下请在 `tenantId` 与 `metadata.owner` 中记录归属，方便审计日志关联。

## 扩展流程
1. 在本文件新增配置项后，更新对应的官方 Dify 文档链接或说明。
2. 需要新增字段时，请同步在 `packages/shared/src/dify/index.ts` 扩展 `DifyWorkflowConfig` 类型，保持前后端一致。
3. 对于实验性工作流，可通过 `tags` 标注 `beta`，便于前端过滤展示。
