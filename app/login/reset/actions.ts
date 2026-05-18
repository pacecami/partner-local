'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function sendReset(formData: FormData) {
  const email = (formData.get('email') as string).trim().toLowerCase()
  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/login/update-password`,
  })
  redirect('/login/reset?sent=1')
}
