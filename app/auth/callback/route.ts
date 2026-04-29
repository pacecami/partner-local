import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Find brugerens rolle via profiles-tabellen
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        } else {
          return NextResponse.redirect(`${origin}/dashboard`)
        }
      }
    }
  }

  // Noget gik galt — send tilbage til login
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
