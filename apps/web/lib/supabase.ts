import { createClient } from '@supabase/supabase-js'

// Server-side client — uses service role key to bypass RLS
export function getServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Client-side client — uses anon key
export function getBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const IMPACT_LABELS: Record<string, string> = {
  '1': 'Informational',
  '2': 'Low',
  '3': 'Medium',
  '4': 'High',
}

export const IMPACT_COLORS: Record<string, string> = {
  '1': 'bg-gray-100 text-gray-700',
  '2': 'bg-blue-100 text-blue-700',
  '3': 'bg-orange-100 text-orange-700',
  '4': 'bg-red-100 text-red-700',
}

export const IMPACT_BORDER: Record<string, string> = {
  '1': 'border-gray-300',
  '2': 'border-blue-400',
  '3': 'border-orange-400',
  '4': 'border-red-500',
}
