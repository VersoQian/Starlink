import { type DifyPriority, type DifyRateLimitRule, type DifyWorkflowConfig } from '@branching-chat/shared'
import { readEnv } from '../lib/env'

export type DifyWorkflowRuntimeConfig = DifyWorkflowConfig & {
  metricsTag?: string
  fallback?: NonNullable<DifyWorkflowConfig['fallback']> & {
    /**
     * 当回退目标不可用时的兜底提示。
     */
    message?: string
  }
  rateLimit?: DifyRateLimitRule[]
  defaultPriority?: DifyPriority
}

const DEFAULT_BASE_URL = readEnv('DIFY_API_BASE_URL', {
  defaultValue: 'https://api.dify.ai/v1'
})

const WORKFLOW_CONFIGS: DifyWorkflowRuntimeConfig[] = [
  {
    id: 'content-generation',
    appId: readEnv('DIFY_CONTENT_APP_ID'),
    apiKey: readEnv('DIFY_CONTENT_API_KEY'),
    mode: 'streaming',
    baseUrl: DEFAULT_BASE_URL,
    description: '课程内容生成与润色',
    tags: ['authoring', 'async'],
    defaultPriority: 'normal',
    metricsTag: 'workflow.content-generation',
    rateLimit: [
      { identifier: 'user', intervalMs: 60_000, limit: 8 },
      { identifier: 'tenant', intervalMs: 3_600_000, limit: 500 }
    ],
    quota: { daily: 1_000 },
    metadata: { owner: 'curriculum' }
  },
  {
    id: 'lesson-outline',
    appId: readEnv('DIFY_OUTLINE_APP_ID'),
    apiKey: readEnv('DIFY_OUTLINE_API_KEY'),
    mode: 'blocking',
    baseUrl: DEFAULT_BASE_URL,
    description: '生成课程大纲建议',
    tags: ['planning'],
    defaultPriority: 'high',
    metricsTag: 'workflow.lesson-outline',
    rateLimit: [
      { identifier: 'user', intervalMs: 300_000, limit: 3 },
      { identifier: 'workflow', intervalMs: 60_000, limit: 10 }
    ],
    fallback: {
      workflowId: 'content-generation',
      message: '工作流暂不可用，已切换至内容生成工作流。'
    }
  },
  {
    id: 'file-translation',
    appId: readEnv('DIFY_FILE_TRANSLATION_APP_ID'),
    apiKey: readEnv('DIFY_FILE_TRANSLATION_API_KEY'),
    mode: 'blocking',
    baseUrl: DEFAULT_BASE_URL,
    description: '上传文件并生成目标语言译文',
    tenantId: 'ops',
    tags: ['translation'],
    defaultPriority: 'low',
    metricsTag: 'workflow.file-translation',
    rateLimit: [{ identifier: 'user', intervalMs: 600_000, limit: 2 }],
    quota: { daily: 200, monthly: 5_000 }
  }
].filter((item) => item.appId && item.apiKey)

const WORKFLOW_REGISTRY = new Map<string, DifyWorkflowConfig>(
  WORKFLOW_CONFIGS.map((item) => [item.id, item])
)

export const DEFAULT_DIFY_WORKFLOW_ID =
  readEnv('DIFY_DEFAULT_WORKFLOW_ID', { defaultValue: 'content-generation' }) ||
  (WORKFLOW_CONFIGS[0]?.id ?? '')

export function listDifyWorkflows(): DifyWorkflowRuntimeConfig[] {
  return WORKFLOW_CONFIGS
}

export function getDifyWorkflow(id: string): DifyWorkflowRuntimeConfig {
  const config = WORKFLOW_REGISTRY.get(id)
  if (!config) {
    throw new Error(`Dify workflow "${id}" is not configured`)
  }
  return config
}

export function getDifyBaseUrl(): string {
  return DEFAULT_BASE_URL
}
