'use client'

import { useState } from 'react'

type Placement = {
  id: string
  name: string
  image_url: string | null
  url: string | null
}

export default function PlacementLightbox({ placements }: { placements: Placement[] }) {
  const [open, setOpen] = useState<Placement | null>(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {placements.map(fp => (
          <div
            key={fp.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {fp.image_url ? (
              <button
                type="button"
                onClick={() => setOpen(fp)}
                className="w-full block focus:outline-none group relative"
                style={{ cursor: 'zoom-in' }}
              >
                <img
                  src={fp.image_url}
                  alt={fp.name}
                  className="w-full object-cover transition-opacity group-hover:opacity-80"
                  style={{ maxHeight: '160px' }}
                />
                {/* Hover-overlay med forstørrelsesikon */}
                <span
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.25)' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </span>
              </button>
            ) : (
              <div
                className="w-full flex items-center justify-center text-xs"
                style={{ height: '120px', background: 'var(--surface-2)', color: 'var(--muted)' }}
              >
                Billede mangler
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{fp.name}</p>
              {fp.url && (
                <a
                  href={fp.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs mt-0.5 block truncate"
                  style={{ color: 'var(--accent)' }}
                  title={fp.url}
                >
                  {fp.url}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.name}
          onClick={() => setOpen(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          {/* Luk-knap */}
          <button
            type="button"
            onClick={() => setOpen(null)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '20px',
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '28px',
              lineHeight: 1,
              cursor: 'pointer',
              opacity: 0.7,
            }}
            aria-label="Luk"
          >
            ×
          </button>

          <img
            src={open.image_url!}
            alt={open.name}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh',
              borderRadius: '12px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              objectFit: 'contain',
              cursor: 'default',
            }}
          />

          <p
            style={{
              marginTop: '16px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              opacity: 0.85,
            }}
          >
            {open.name}
          </p>
          {open.url && (
            <a
              href={open.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                marginTop: '6px',
                color: 'var(--accent)',
                fontSize: '12px',
                opacity: 0.9,
                textDecoration: 'underline',
              }}
            >
              {open.url}
            </a>
          )}
        </div>
      )}
    </>
  )
}
