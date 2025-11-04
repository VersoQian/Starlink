const warnedKeys = new Set()

const readEnv = (name, options = {}) => {
  const raw = process.env[name]
  if (!raw || raw.length === 0) {
    if (options.defaultValue !== undefined) {
      return options.defaultValue
    }
    if (options.required && !warnedKeys.has(name)) {
      console.warn(`[keys] Environment variable ${name} is not set`)
      warnedKeys.add(name)
    }
    return ''
  }
  return raw
}

export const SUPABASE_URL = readEnv('SUPABASE_URL', { required: true })
export const SUPABASE_ANON_KEY = readEnv('SUPABASE_ANON_KEY', { required: true })
export const SUPABASE_SERVICE_KEY = readEnv('SUPABASE_SERVICE_KEY')

export const DEEPSEEK_API_KEY = readEnv('DEEPSEEK_API_KEY')
export const TONGYI_API_URL = readEnv('TONGYI_API_URL', {
  defaultValue: 'https://dashscope.aliyuncs.com/api/v1'
})
export const TONGYI_API_KEY = readEnv('TONGYI_API_KEY')
export const DASHSCOPE_API_KEY = readEnv('DASHSCOPE_API_KEY')

export const OPENAI_COMPAT_BASE_URL = readEnv('OPENAI_COMPAT_BASE_URL', { defaultValue: '' })

export const GRAPHQL_GATEWAY_URL = readEnv('GRAPHQL_GATEWAY_URL', {
  defaultValue: 'http://localhost:4001/graphql'
})
export const LEGACY_BACKEND_URL = readEnv('BACKEND_API_BASE_URL', {
  defaultValue: 'http://localhost:4000'
})

export const getSupabaseClientConfig = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
  agentKey: SUPABASE_SERVICE_KEY || undefined
})

export const getAgentKeys = () => ({
  deepseek: DEEPSEEK_API_KEY || undefined,
  tongyi: TONGYI_API_KEY || DASHSCOPE_API_KEY || undefined
})
