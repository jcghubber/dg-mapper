import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Debug: surface which Supabase URL is being used and whether anon key is present (masked)
try {
  const maskedKey = supabaseAnonKey ? `${String(supabaseAnonKey).slice(0, 4)}...${String(supabaseAnonKey).slice(-4)}` : 'missing'
  console.debug('Supabase debug:', { supabaseUrl, supabaseAnonKey: maskedKey })
} catch (err) {
  // swallow
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
