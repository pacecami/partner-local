'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email    = (formData.get('email') as string).trim().toLowerCase()
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

  if (authError || !authData.user) {
    redirect('/login?error=invalid')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    redirect('/login?error=unauthorized')
  }

  const token = crypto.randomUUID()
  await supabase.from('admin_tokens').insert({ name: email, token })

  const cookieStore = await cookies()
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  redirect('/admin')
}
