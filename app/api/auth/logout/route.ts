import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('admin_token')?.value

  if (token) {
    // Slet token fra databasen
    const adminClient = createAdminClient()
    await adminClient.from('admin_tokens').delete().eq('token', token)

    // Ryd cookie
    cookieStore.delete('admin_token')
  }

  redirect('/login')
}
