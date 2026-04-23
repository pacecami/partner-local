'use client'

import { useState } from 'react'

type Result = {
  mode?: string
  sent?: number
  message?: string
  error?: string
  results?: Array<{
    kampagne: string
    partner: string
    placering: string
    periode: string
    status: string
  }>
}

export default function TestMailButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function sendTest() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/send-reminders?test=true')
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: 'Netværksfejl — er dev-serveren kørende?' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={sendTest}
        disabled={loading}
        className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#000' }}
      >
        {loading ? 'Sender...' : '📧 Send testmail nu'}
      </button>

      {result && (
        <div
          className="rounded-lg p-4 text-sm space-y-2"
          style={{
            background: 'var(--surface-2)',
            border: `1px solid ${result.error ? '#ef4444' : 'var(--border)'}`,
          }}
        >
          {result.error ? (
            <p style={{ color: '#ef4444' }}>⚠️ {result.error}</p>
          ) : result.message ? (
            <p style={{ color: 'var(--muted)' }}>{result.message}</p>
          ) : (
            <>
              <p style={{ color: 'var(--foreground)' }}>
                <strong>{result.sent}</strong> mail{result.sent !== 1 ? 's' : ''} sendt
              </p>
              {result.results?.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 pt-2 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span>{r.status.startsWith('✓') ? '✅' : '❌'}</span>
                  <div>
                    <p className="font-medium text-xs" style={{ color: 'var(--foreground)' }}>
                      {r.partner} — {r.placering}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {r.periode} · {r.status}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
