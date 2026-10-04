import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mhvcdstgkyplhzjptgfr.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
})

// Supabase table operations for search history
export async function saveSearchSession(session: {
  query: string
  mode: string
  results_count: number
  results: unknown[]
}) {
  if (!SUPABASE_ANON_KEY) return null
  const { data, error } = await supabase
    .from('omni_search_sessions')
    .insert(session)
    .select()
    .single()
  if (error) console.error('Supabase save error:', error)
  return data
}

export async function getSearchHistory(limit = 20) {
  if (!SUPABASE_ANON_KEY) return []
  const { data, error } = await supabase
    .from('omni_search_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) console.error('Supabase fetch error:', error)
  return data ?? []
}
