'use client'

import { useState, useRef, useEffect } from 'react'

interface StatRowProps {
  label: string
  visninger: number | null
  kliks: number | null
  imageUrl?: string | null
  sub?: boolean // mindre rækker (per-property breakdown)
}

export default function StatRow({ label, visninger, kliks, imageUrl, sub = false }: StatRowProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  const klikrate = visninger && kliks && visninger > 0
    ? ((kliks / visninger) * 100).toFixed(2)
    : null

  function handleMouseEnter() {
    if (!imageUrl || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.top })
  }

  // Fjern tooltip ved scroll
  useEffect(() => {
    const hide = () => setTooltipPos(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  return (
    <>
      {/* Fixed tooltip — clippes ikke af overflow-hidden */}
      {imageUrl && tooltipPos && (
        <div
          style={{
            position: 'fixed',
            top: tooltipPos.y - 180,
            left: tooltipPos.x,
            width: '260px',
            zIndex: 9999,
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          <img src={imageUrl} alt={label} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }} />
          <p style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>{label}</p>
        </div>
      )}

      <div
        ref={rowRef}
        className="flex items-center justify-between border-b last:border-0"
        style={{
          borderColor: 'var(--border)',
          padding: sub ? '8px 0' : '12px 0',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipPos(null)}
      >
        {/* Navn */}
        <span
          className="flex items-center gap-1.5"
          style={{
            color: sub ? 'var(--muted)' : 'var(--foreground)',
            fontSize: sub ? '12px' : '14px',
            fontWeight: sub ? 400 : 500,
          }}
        >
          {sub && <span style={{ color: 'var(--border)', marginRight: '2px' }}>↳</span>}
          {label}
          {imageUrl && !sub && (
            <span style={{ fontSize: '11px', color: 'var(--muted)', opacity: 0.7 }}>🖼</span>
          )}
        </span>

        {/* Tal */}
        <div className="flex items-center gap-5 tabular-nums">
          {visninger !== null && (
            <div className="text-right" style={{ minWidth: '72px' }}>
              {!sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>Visninger</p>}
              <p style={{ fontSize: sub ? '12px' : '14px', fontWeight: 700, color: sub ? 'var(--muted)' : 'var(--foreground)', margin: 0 }}>
                {visninger.toLocaleString('da-DK')}
              </p>
            </div>
          )}
          {kliks !== null && (
            <div className="text-right" style={{ minWidth: '56px' }}>
              {!sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>Kliks</p>}
              <p style={{ fontSize: sub ? '12px' : '14px', fontWeight: 700, color: sub ? 'var(--muted)' : 'var(--foreground)', margin: 0 }}>
                {kliks.toLocaleString('da-DK')}
              </p>
            </div>
          )}
          {klikrate !== null && (
            <div className="text-right" style={{ minWidth: '52px' }}>
              {!sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>Klikrate</p>}
              <p style={{ fontSize: sub ? '12px' : '14px', fontWeight: 700, color: 'var(--accent)', margin: 0 }}>
                {klikrate}%
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
