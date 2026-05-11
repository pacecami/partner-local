import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  async function login(formData: FormData) {
    'use server'
    const email    = (formData.get('email') as string).trim().toLowerCase()
    const password = formData.get('password') as string

    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      redirect('/login?error=invalid')
    }

    // Tjek at brugeren har admin-rolle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      redirect('/login?error=unauthorized')
    }

    // Opret session-token og gem i admin_tokens
    const adminClient = createAdminClient()
    const token = crypto.randomUUID()
    await adminClient.from('admin_tokens').insert({ name: email, token })

    // Sæt httpOnly cookie (30 dage)
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

  const errorMsg =
    error === 'invalid'      ? 'Forkert email eller adgangskode.' :
    error === 'unauthorized' ? 'Du har ikke adgang til admin-portalen.' :
    null

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    fontSize: '14px',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    marginBottom: '8px',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full"
        style={{ maxWidth: '380px' }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '40px 36px',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)', margin: 0, lineHeight: 1 }}>
              Pace
            </h1>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '6px' }}>
              Partner Portal
            </p>
          </div>

          {/* Fejlbesked */}
          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#ef4444', margin: 0 }}>{errorMsg}</p>
            </div>
          )}

          {/* Form */}
          <form action={login} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="din@pace.dk"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                name="password"
                type="password"
                required
                placeholder="Indtast adgangskode"
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '8px',
                background: 'var(--accent)',
                color: '#000',
                fontWeight: 700,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Log ind
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
