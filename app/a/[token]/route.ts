import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  // Tjek om token findes i admin_tokens
  const { data } = await supabase
    .from('admin_tokens')
    .select('id, name')
    .eq('token', token)
    .single()

  if (!data) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Sæt en cookie der varer 1 år
  const response = NextResponse.redirect(new URL('/admin', request.url))
  response.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })

  return response
}
