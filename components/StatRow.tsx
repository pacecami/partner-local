'use client'

import { useState } from 'react'

interface StatRowProps {
  label: string
  visninger: number | null
  kliks: number | null
  imageUrl?: string | null
}

export default function StatRow({ label, visninger, kliks, imageUrl }: StatRowProps) {
  const [hovered, setHovered] = useState(false)
  const klikrate = visninger && kliks && visninger > 0
    ? ((kliks / visninger) * 100).toFixed(2)
    : null

  return (
    <div
      className="relative flex items-center justify-between py-3 border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover-billede */}
      {imageUrl && hovered && (
        <div
          className="absolute z-50 rounded-xl overflow-hidden shadow-2xl"
          style={{
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            width: '260px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <img src={imageUrl} alt={label} className="w-full object-cover" style={{ maxHeight: '160px' }} />
          <p className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
        </div>
      )}

      {/* Navn */}
      <span
        className="text-sm font-medium flex items-center gap-1.5"
        style={{ color: 'var(--foreground)', cursor: imageUrl ? 'default' : undefined }}
      >
        {label}
        {imageUrl && (
          <span className="text-xs" style={{ color: 'var(--muted)' }} title="Hold musen over for at se placering">
            👁
          </span>
        )}
      </span>

      {/* Tal */}
      <div className="flex items-center gap-5 tabular-nums">
        {visninger !== null && (
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Visninger</p>
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              {visninger.toLocaleString('da-DK')}
            </p>
          </div>
        )}
        {kliks !== null && (
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Kliks</p>
            <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              {kliks.toLocaleString('da-DK')}
            </p>
          </div>
        )}
        {klikrate !== null && (
          <div className="text-right" style={{ minWidth: '52px' }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Klikrate</p>
            <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
              {klikrate}%
            </p>
          </div>
        )}
        {visninger === null && kliks === null && (
          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>—</span>
        )}
      </div>
    </div>
  )
}
