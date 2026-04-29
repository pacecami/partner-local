'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError('Noget gik galt. Prøv igen.')
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Logo / titel */}
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            Partner Portal
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Log ind med dit arbejdsmail
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-3">
            <div className="text-4xl">📬</div>
            <p className="font-semibold" style={{ color: 'var(--foreground)' }}>
              Tjek din mail
            </p>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Vi har sendt et login-link til{' '}
              <span style={{ color: 'var(--foreground)' }}>{email}</span>.<br />
              Klik på linket i mailen for at logge ind.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              className="text-xs mt-4"
              style={{ color: 'var(--muted)' }}
            >
              Brug en anden mail →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--muted)' }}
              >
                E-mailadresse
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="navn@virksomhed.dk"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: '#f87171' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              {loading ? 'Sender...' : 'Send login-link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
