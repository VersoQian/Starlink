/**
 * Phase 4.2 · Heterogeneous LLM router.
 */

import { ChatOpenAI } from '@langchain/openai'
import { createAuditLogger } from '@starlink/shared'
import type { AgentProfile } from '../capabilities/profile-schema.js'
import type { BusinessModel } from './business-langgraph.js'

const auditLogger = createAuditLogger('packages/server:llm-factory')

export type ModelFamily = 'anthropic' | 'deepseek' | 'google' | 'openai'

export function detectFamily(modelName: string): ModelFamily {
  const m = modelName.toLowerCase()
  if (m.startsWith('claude')) return 'anthropic'
  if (m.startsWith('deepseek')) return 'deepseek'
  if (m.startsWith('gemini')) return 'google'
  return 'openai'
}

interface FamilyConfig {
  apiKey: string
  baseURL: string | undefined
  source: string
}

function readFamilyConfig(family: ModelFamily): FamilyConfig | null {
  const fallbackKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || ''
  const fallbackBase = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || ''

  switch (family) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY || fallbackKey
      const base = process.env.ANTHROPIC_BASE_URL || fallbackBase || undefined
      if (!key) return null
      return {
        apiKey: key,
        baseURL: base,
        source: process.env.ANTHROPIC_API_KEY ? 'anthropic-native' : 'anthropic-via-fallback'
      }
    }
    case 'deepseek': {
      const key = process.env.DEEPSEEK_API_KEY || fallbackKey
      const base = process.env.DEEPSEEK_BASE_URL || fallbackBase || 'https://api.deepseek.com/v1'
      if (!key) return null
      return {
        apiKey: key,
        baseURL: base,
        source: process.env.DEEPSEEK_API_KEY ? 'deepseek-native' : 'deepseek-via-fallback'
      }
    }
    case 'google': {
      const key = process.env.GEMINI_API_KEY || fallbackKey
      const base = process.env.GEMINI_BASE_URL || fallbackBase || undefined
      if (!key) return null
      return {
        apiKey: key,
        baseURL: base,
        source: process.env.GEMINI_API_KEY ? 'gemini-native' : 'gemini-via-fallback'
      }
    }
    case 'openai':
    default: {
      if (!fallbackKey) return null
      return {
        apiKey: fallbackKey,
        baseURL: fallbackBase || undefined,
        source: 'openai-default'
      }
    }
  }
}

/** DeepSeek V4 family — supports `thinking.type` + `reasoning_effort`
 * extra params (passed through OpenAI-compatible body via modelKwargs).
 * Detected by name prefix; fallback for older deepseek-chat / -reasoner
 * does NOT inject these (they reject unknown fields). */
function isDeepSeekThinkingModel(model: string): boolean {
  const m = model.toLowerCase()
  return m.startsWith('deepseek-v4') || m.includes('-thinking')
}

function buildModelKwargs(model: string): Record<string, unknown> | undefined {
  if (!isDeepSeekThinkingModel(model)) return undefined
  return {
    thinking: { type: 'enabled' },
    reasoning_effort: 'high',
  }
}

export function createLLMModelFor(profile: AgentProfile): BusinessModel | null {
  const family = detectFamily(profile.model)
  const cfg = readFamilyConfig(family)
  if (!cfg) {
    auditLogger.warn({
      action: 'llm-factory.no-api-key',
      metadata: { agentId: profile.id, model: profile.model, family }
    })
    return null
  }
  const configuration = cfg.baseURL ? { baseURL: cfg.baseURL } : undefined
  const modelKwargs = buildModelKwargs(profile.model)
  auditLogger.info({
    action: 'llm-factory.created',
    metadata: {
      agentId: profile.id,
      model: profile.model,
      family,
      source: cfg.source,
      hasBaseURL: Boolean(cfg.baseURL),
      hasThinking: Boolean(modelKwargs)
    }
  })

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: profile.model,
    temperature: profile.temperature,
    maxTokens: profile.max_tokens,
    configuration,
    ...(modelKwargs ? { modelKwargs } : {})
  })
}
