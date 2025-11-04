export declare const SUPABASE_URL: string
export declare const SUPABASE_ANON_KEY: string
export declare const SUPABASE_SERVICE_KEY: string

export declare const DEEPSEEK_API_KEY: string
export declare const TONGYI_API_URL: string
export declare const TONGYI_API_KEY: string
export declare const DASHSCOPE_API_KEY: string

export declare const OPENAI_COMPAT_BASE_URL: string
export declare const GRAPHQL_GATEWAY_URL: string
export declare const LEGACY_BACKEND_URL: string

export type KeyBundle = {
  supabaseUrl: string
  supabaseKey: string
  agentKey?: string
}

export declare function getSupabaseClientConfig(): KeyBundle
export declare function getAgentKeys(): {
  deepseek?: string
  tongyi?: string
}
