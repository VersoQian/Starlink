/**
 * Centralised accessor for secret keys and service endpoints.
 * All consumers should import from this module instead of touching process.env directly.
 *
 * Example:
 * import { SUPABASE_SERVICE_KEY } from '../config/keys'
 */

const missing = (name: string, required = true) => {
  const value = process.env[name]
  if (!value && required) {
    console.warn(`[keys] Environment variable ${name} is not set`)
  }
  return value ?? ''
}

export const SUPABASE_URL = missing('SUPABASE_URL')
export const SUPABASE_ANON_KEY = missing('SUPABASE_ANON_KEY')
export const SUPABASE_SERVICE_KEY = missing('SUPABASE_SERVICE_KEY', false)

export const DEEPSEEK_API_KEY = missing('DEEPSEEK_API_KEY', false)
export const TONGYI_API_KEY = missing('TONGYI_API_KEY', false)
export const DASHSCOPE_API_KEY = missing('DASHSCOPE_API_KEY', false)

export const OPENAI_COMPAT_BASE_URL = process.env.OPENAI_COMPAT_BASE_URL ?? ''

export const GRAPHQL_GATEWAY_URL = process.env.GRAPHQL_GATEWAY_URL ?? 'http://localhost:4001/graphql'
export const LEGACY_BACKEND_URL = process.env.BACKEND_API_BASE_URL ?? 'http://localhost:4000'

export type KeyBundle = {
  supabaseUrl: string
  supabaseKey: string
  agentKey?: string
}

export const getSupabaseClientConfig = (): KeyBundle => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
  agentKey: SUPABASE_SERVICE_KEY || undefined
})

export const getAgentKeys = () => ({
  deepseek: DEEPSEEK_API_KEY || undefined,
  tongyi: TONGYI_API_KEY || DASHSCOPE_API_KEY || undefined
})

