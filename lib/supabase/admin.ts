import { createClient } from '@supabase/supabase-js'

/**
 * Admin-klient med service role key — bruges kun server-side.
 * Kræver SUPABASE_SERVICE_ROLE_KEY i .env.local
 */
export function createAdminClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  })
}
