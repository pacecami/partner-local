import { Suspense } from 'react'
import ResetForm from './ResetForm'

export const dynamic = 'force-static'

export default function ResetPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
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
          </div>
        }>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
