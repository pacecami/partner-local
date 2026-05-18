'use client'

import { useSearchParams } from 'next/navigation'
import { login } from './actions'

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

export default function LoginForm() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMsg =
    error === 'invalid'      ? 'Forkert email eller adgangskode.' :
    error === 'unauthorized' ? 'Du har ikke adgang til admin-portalen.' :
    null

  return (
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

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <a
          href="/login/reset"
          style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}
        >
          Glemt adgangskode?
        </a>
      </div>
    </div>
  )
}
