import { Suspense } from 'react'
import LoginForm from './LoginForm'

// Siden er nu statisk — serveres fra CDN uden Lambda cold start.
// Server-logikken (login-funktionen) kører kun når formularen submittes.
export const dynamic = 'force-static'

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full" style={{ maxWidth: '380px' }}>
        <Suspense fallback={
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '40px 36px',
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
              Pace
            </h1>
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: '6px' }}>
              Partner Portal
            </p>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
