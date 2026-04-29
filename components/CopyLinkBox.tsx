'use client'

import { useState } from 'react'

export default function CopyLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
        Partner-link
      </p>
      <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
        Send dette link til partneren — det giver direkte adgang til deres dashboard uden login.
      </p>
      <div className="flex items-center gap-2">
        <code
          className="flex-1 px-3 py-2 rounded-lg text-xs truncate"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          {url}
        </code>
        <button
          onClick={copy}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: copied ? '#22c55e' : 'var(--accent)',
            color: '#000',
          }}
        >
          {copied ? '✓ Kopieret' : 'Kopiér'}
        </button>
      </div>
    </div>
  )
}
