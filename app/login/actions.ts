'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createDirectClient } from '@supabase/supabase-js'

export async function login(formData: FormData) {
  const email    = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  if (authError || !authData.user || !authData.session) {
    redirect('/login?error=invalid')
  }

  // Brug brugerens eget JWT til at slå profil op
  const authedClient = createDirectClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } } }
  )

  const { data: profile } = await authedClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/login?error=unauthorized')
  }

  const cookieStore = await cookies()

  // Sæt en simpel admin-cookie — middleware behøver ikke ramme databasen
  cookieStore.set('is_admin', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  redirect('/admin')
}
