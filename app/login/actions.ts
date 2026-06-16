'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = ['cp@pace.dk', 'dt@pace.dk']

export async function login(formData: FormData) {
  const email    = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  if (authError || !authData.user) {
    redirect('/login?error=invalid')
  }

  if (!ADMIN_EMAILS.includes(email)) {
    redirect('/login?error=unauthorized')
  }

  const cookieStore = await cookies()
  cookieStore.set('is_admin', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  redirect('/admin')
}
