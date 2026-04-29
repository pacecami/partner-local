import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Kun beskyt /admin-ruter
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // Tjek admin_token cookie
  const adminToken = request.cookies.get('admin_token')?.value
  if (!adminToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Valider token mod databasen
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    }
  )

  const { data } = await supabase
    .from('admin_tokens')
    .select('id')
    .eq('token', adminToken)
    .single()

  if (!data) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
