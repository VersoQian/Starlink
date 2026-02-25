export const config = {
  gatewayTaskEventUrl: process.env.GATEWAY_TASK_EVENT_URL ?? 'http://localhost:4000/internal/task-events',
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN ?? '',
  taskEventRetryCount: Number(process.env.TASK_EVENT_RETRY_COUNT ?? '3')
}
