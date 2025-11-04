'use server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClientConfig } from '../../../../config/keys.js';
let cachedClient;
export const getSupabaseClient = () => {
    if (cachedClient === undefined) {
        const config = getSupabaseClientConfig();
        if (!config.supabaseUrl || !config.supabaseKey) {
            cachedClient = null;
        }
        else {
            cachedClient = createClient(config.supabaseUrl, config.supabaseKey, {
                auth: { persistSession: false }
            });
        }
    }
    return cachedClient ?? null;
};
