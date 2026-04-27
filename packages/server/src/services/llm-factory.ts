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
  auditLogger.info({
    action: 'llm-factory.created',
    metadata: {
      agentId: profile.id,
      model: profile.model,
      family,
      source: cfg.source,
      hasBaseURL: Boolean(cfg.baseURL)
    }
  })

  return new ChatOpenAI({
    apiKey: cfg.apiKey,
    model: profile.model,
    temperature: profile.temperature,
    maxTokens: profile.max_tokens,
    configuration
  })
}
