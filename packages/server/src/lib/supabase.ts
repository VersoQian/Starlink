'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClientConfig } from '../../../config/keys.js'

let cachedClient: SupabaseClient | null | undefined

export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedClient === undefined) {
    const config = getSupabaseClientConfig()
    if (!config.supabaseUrl || !config.supabaseKey) {
      cachedClient = null
    } else {
      cachedClient = createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false }
      })
    }
  }
  return cachedClient ?? null
}
