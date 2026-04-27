'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'

export default function SavedToast() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)
  const triggered = useRef(false)

  useEffect(() => {
    if (searchParams.get('saved') === 'true' && !triggered.current) {
      triggered.current = true
      setVisible(true)
      setAnimating(true)

      // Fjern ?saved=true fra URL'en uden at genindlæse siden
      const params = new URLSearchParams(searchParams.toString())
      params.delete('saved')
      const newUrl = params.toString() ? `${pathname}?${params}` : pathname
      router.replace(newUrl, { scroll: false })

      // Skjul toasten efter 3 sekunder
      const timer = setTimeout(() => setAnimating(false), 3000)
      const hideTimer = setTimeout(() => {
        setVisible(false)
        triggered.current = false
      }, 3400)
      return () => {
        clearTimeout(timer)
        clearTimeout(hideTimer)
      }
    }
  }, [searchParams])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '12px',
        background: 'var(--surface)',
        border: '1px solid var(--accent)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        opacity: animating ? 1 : 0,
        transform: animating ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      {/* Grøn checkmark */}
      <span
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: '#22c55e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4L4 7L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ color: 'var(--foreground)', fontSize: '14px', fontWeight: 500 }}>
        Gemt!
      </span>
    </div>
  )
}
