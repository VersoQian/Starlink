import { readEnv } from '../lib/env'
import type { DifyWorkflowConfig, DifyWorkflowMode } from '@starlink/shared'

const DEFAULT_BASE_URL = readEnv('DIFY_API_BASE_URL', {
  defaultValue: 'https://api.dify.ai/v1'
})

const WORKFLOW_CONFIGS: DifyWorkflowConfig[] = [
  {
    id: 'content-generation',
    appId: readEnv('DIFY_CONTENT_GENERATION_APP_ID'),
    apiKey: readEnv('DIFY_CONTENT_GENERATION_API_KEY'),
    mode: 'streaming' as DifyWorkflowMode,
    baseUrl: DEFAULT_BASE_URL,
    description: '通用内容生成，支持各种文本创作任务'
  },
  {
    id: 'file-translation',
    appId: readEnv('DIFY_FILE_TRANSLATION_APP_ID'),
    apiKey: readEnv('DIFY_FILE_TRANSLATION_API_KEY'),
    mode: 'streaming' as DifyWorkflowMode,
    baseUrl: DEFAULT_BASE_URL,
    description: '上传文件并生成目标语言译文'
  },
  {
    id: 'deep-research',
    appId: readEnv('DIFY_DEEP_RESEARCH_APP_ID'),
    apiKey: readEnv('DIFY_DEEP_RESEARCH_API_KEY'),
    mode: 'streaming' as DifyWorkflowMode,
    baseUrl: DEFAULT_BASE_URL,
    description: '深度研究分析，支持多源信息检索和智能总结'
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
