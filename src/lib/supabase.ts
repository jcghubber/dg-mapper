import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

if (import.meta.env.DEV) {
  const maskedKey = `${supabaseAnonKey.slice(0, 4)}...${supabaseAnonKey.slice(-4)}`
  console.debug('Supabase debug:', { supabaseUrl, supabaseAnonKey: maskedKey })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
