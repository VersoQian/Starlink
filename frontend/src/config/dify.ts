import { readEnv } from '../lib/env'

export type DifyWorkflowMode = 'blocking' | 'streaming'

export type DifyWorkflowConfig = {
  /**
   * 逻辑工作流 ID，用于前端引用。
   */
  id: string
  /**
   * Dify 应用 ID（App ID）。
   */
  appId: string
  /**
   * 对应的 API Key。
   */
  apiKey: string
  /**
   * 请求模式：阻塞或流式。
   */
  mode: DifyWorkflowMode
  /**
   * 可选的自定义 Base URL，默认使用全局配置。
   */
  baseUrl?: string
  /**
   * 额外描述信息，方便 UI 提示。
   */
  description?: string
}

const DEFAULT_BASE_URL = readEnv('DIFY_API_BASE_URL', {
  defaultValue: 'https://api.dify.ai/v1'
})

const WORKFLOW_CONFIGS: DifyWorkflowConfig[] = [
  {
    id: 'content-generation',
    appId: readEnv('DIFY_CONTENT_APP_ID'),
    apiKey: readEnv('DIFY_CONTENT_API_KEY'),
    mode: 'streaming',
    baseUrl: DEFAULT_BASE_URL,
    description: '课程内容生成与润色'
  },
  {
    id: 'lesson-outline',
    appId: readEnv('DIFY_OUTLINE_APP_ID'),
    apiKey: readEnv('DIFY_OUTLINE_API_KEY'),
    mode: 'blocking',
    baseUrl: DEFAULT_BASE_URL,
    description: '生成课程大纲建议'
  },
  {
    id: 'file-translation',
    appId: readEnv('DIFY_FILE_TRANSLATION_APP_ID'),
    apiKey: readEnv('DIFY_FILE_TRANSLATION_API_KEY'),
    mode: 'blocking',
    baseUrl: DEFAULT_BASE_URL,
    description: '上传文件并生成目标语言译文'
  }
].filter((item) => item.appId && item.apiKey)

const WORKFLOW_REGISTRY = new Map<string, DifyWorkflowConfig>(
  WORKFLOW_CONFIGS.map((item) => [item.id, item])
)

export const DEFAULT_DIFY_WORKFLOW_ID =
  readEnv('DIFY_DEFAULT_WORKFLOW_ID', { defaultValue: 'content-generation' }) ||
  (WORKFLOW_CONFIGS[0]?.id ?? '')

export function listDifyWorkflows(): DifyWorkflowConfig[] {
  return WORKFLOW_CONFIGS
}

export function getDifyWorkflow(id: string): DifyWorkflowConfig {
  const config = WORKFLOW_REGISTRY.get(id)
  if (!config) {
    throw new Error(`Dify workflow "${id}" is not configured`)
  }
  return config
}

export function getDifyBaseUrl(): string {
  return DEFAULT_BASE_URL
}
