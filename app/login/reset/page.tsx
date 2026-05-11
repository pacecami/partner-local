import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const { sent } = await searchParams

  async function sendReset(formData: FormData) {
    'use server'
    const email = (formData.get('email') as string).trim().toLowerCase()
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/login/update-password`,
    })
    redirect('/login/reset?sent=1')
  }

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

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '40px 36px',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)', margin: 0, lineHeight: 1 }}>
              Pace
            </h1>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '6px' }}>
              Nulstil adgangskode
            </p>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '14px', color: 'var(--foreground)', marginBottom: '8px' }}>
                ✉️ Mail sendt!
              </p>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Tjek din indbakke og klik på linket for at oprette en ny adgangskode.
              </p>
              <a
                href="/login"
                style={{ display: 'inline-block', marginTop: '24px', fontSize: '13px', color: 'var(--muted)' }}
              >
                ← Tilbage til login
              </a>
            </div>
          ) : (
            <form action={sendReset} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    marginBottom: '8px',
                  }}
                >
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="din@pace.dk"
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
                }}
              >
                Send reset-link
              </button>
              <a
                href="/login"
                style={{ textAlign: 'center', fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}
              >
                ← Tilbage til login
              </a>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
