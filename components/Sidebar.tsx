'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface Partner {
  id: string
  name: string
  slug: string
}

interface SidebarProps {
  role: 'admin' | 'partner'
  partnerName?: string
  partners?: Partner[]
}

export default function Sidebar({ role, partnerName, partners = [] }: SidebarProps) {
  const pathname = usePathname()
  const [partnersOpen, setPartnersOpen] = useState(
    pathname.startsWith('/admin/partners') || pathname === '/admin'
  )

  return (
    <aside
      className="w-52 flex flex-col h-screen sticky top-0 shrink-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="font-bold text-base" style={{ color: 'var(--accent)' }}>
          {partnerName ?? 'Partner Portal'}
        </div>
        <div className="text-xs mt-0.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {role === 'admin' ? 'Admin' : 'Partner'}
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {role === 'admin' ? (
          <>
            {/* Partnerskaber dropdown */}
            <button
              onClick={() => setPartnersOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: pathname.startsWith('/admin') ? 'var(--surface-2)' : 'transparent',
                color: pathname.startsWith('/admin') ? 'var(--foreground)' : 'var(--muted)',
              }}
            >
              <span className="flex items-center gap-2.5">
                <span className="text-xs">⬛</span>
                Partnerskaber
              </span>
              <span
                className="text-xs transition-transform"
                style={{
                  display: 'inline-block',
                  transform: partnersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  color: 'var(--muted)',
                }}
              >
                ▾
              </span>
            </button>

            {partnersOpen && (
              <div className="mt-0.5 ml-3 pl-3 space-y-0.5" style={{ borderLeft: '1px solid var(--border)' }}>
                {partners.map(p => {
                  const active = pathname === `/admin/partners/${p.slug}`
                  return (
                    <Link
                      key={p.id}
                      href={`/admin/partners/${p.slug}`}
                      className="flex items-center px-2 py-1.5 rounded-lg text-xs transition-colors"
                      style={{
                        background: active ? 'var(--surface-2)' : 'transparent',
                        color: active ? 'var(--foreground)' : 'var(--muted)',
                      }}
                    >
                      {p.name}
                    </Link>
                  )
                })}
                <Link
                  href="/admin/partners/new"
                  className="flex items-center px-2 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  + Ny partner
                </Link>
              </div>
            )}

            {/* Overblik */}
            <Link
              href="/admin/overblik"
              className="flex items-center gap-2.5 px-3 py-2 mt-0.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: pathname.startsWith('/admin/overblik') ? 'var(--surface-2)' : 'transparent',
                color: pathname.startsWith('/admin/overblik') ? 'var(--foreground)' : 'var(--muted)',
              }}
            >
              <span className="text-xs">📅</span>
              Overblikket
            </Link>

            {/* Brugere */}
            <Link
              href="/admin/brugere"
              className="flex items-center gap-2.5 px-3 py-2 mt-0.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: pathname === '/admin/brugere' ? 'var(--surface-2)' : 'transparent',
                color: pathname === '/admin/brugere' ? 'var(--foreground)' : 'var(--muted)',
              }}
            >
              <span className="text-xs">👤</span>
              Brugere
            </Link>
          </>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: pathname === '/dashboard' ? 'var(--surface-2)' : 'transparent',
              color: pathname === '/dashboard' ? 'var(--foreground)' : 'var(--muted)',
            }}
          >
            <span className="text-xs">⬛</span>
            Dashboard
          </Link>
        )}
      </nav>

    </aside>
  )
}
