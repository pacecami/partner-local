'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

// ── date helpers ──────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function mEnd(y: number, m: number): Date { return new Date(y, m + 1, 0) }
function mStart(y: number, m: number): Date { return new Date(y, m, 1) }

function thisMonth(): [string, string] {
  const n = new Date()
  return [toYMD(mStart(n.getFullYear(), n.getMonth())), toYMD(mEnd(n.getFullYear(), n.getMonth()))]
}

function lastMonth(): [string, string] {
  const n = new Date()
  const d = new Date(n.getFullYear(), n.getMonth() - 1, 1)
  return [toYMD(mStart(d.getFullYear(), d.getMonth())), toYMD(mEnd(d.getFullYear(), d.getMonth()))]
}

function lastNMonths(n: number): [string, string] {
  const now = new Date()
  const end = mEnd(now.getFullYear(), now.getMonth())
  const start = new Date(now.getFullYear(), now.getMonth() - n + 1, 1)
  return [toYMD(start), toYMD(end)]
}

function thisYear(): [string, string] {
  const y = new Date().getFullYear()
  return [`${y}-01-01`, `${y}-12-31`]
}

function lastYear(): [string, string] {
  const y = new Date().getFullYear() - 1
  return [`${y}-01-01`, `${y}-12-31`]
}

function shiftYears(start: string, end: string, n: number): [string, string] {
  const s = parseYMD(start), e = parseYMD(end)
  s.setFullYear(s.getFullYear() + n)
  e.setFullYear(e.getFullYear() + n)
  return [toYMD(s), toYMD(e)]
}

function prevPeriod(start: string, end: string): [string, string] {
  const s = parseYMD(start), e = parseYMD(end)
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  const newEnd = new Date(s.getTime() - 86400000)
  const newStart = new Date(newEnd.getTime() - (days - 1) * 86400000)
  return [toYMD(newStart), toYMD(newEnd)]
}

function fmtDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

export function formatRange(start: string, end: string): string {
  const s = parseYMD(start), e = parseYMD(end)
  const lastOfMonth = mEnd(e.getFullYear(), e.getMonth())
  const isFullMonth =
    s.getDate() === 1 &&
    s.getMonth() === e.getMonth() &&
    s.getFullYear() === e.getFullYear() &&
    e.getDate() === lastOfMonth.getDate()
  if (isFullMonth) {
    return s.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
  }
  return `${fmtDMY(s)} – ${fmtDMY(e)}`
}

// ── Calendar sub-component ────────────────────────────────────────────────────

const DA_DAYS = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']
const DA_MONTHS = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December']

interface CalProps {
  year: number
  month: number
  selecting: string | null
  hover: string | null
  rangeStart: string
  rangeEnd: string
  onDay: (ymd: string) => void
  onHover: (ymd: string | null) => void
}

function Cal({ year, month, selecting, hover, rangeStart, rangeEnd, onDay, onHover }: CalProps) {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  let offset = firstDay.getDay() - 1
  if (offset < 0) offset = 6
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)

  let effStart = rangeStart, effEnd = rangeEnd
  if (selecting && hover) {
    const pair = [selecting, hover].sort()
    effStart = pair[0]; effEnd = pair[1]
  } else if (selecting) {
    effStart = effEnd = selecting
  }

  const today = toYMD(new Date())

  return (
    <div style={{ width: '196px' }}>
      <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', marginBottom: '10px' }}>
        {DA_MONTHS[month]} {year}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DA_DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} style={{ height: '28px' }} />
          const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isStart = ymd === effStart
          const isEnd   = ymd === effEnd
          const inRange = ymd > effStart && ymd < effEnd
          const isToday = ymd === today

          let bg = 'transparent', color = 'var(--foreground)', br = '6px'
          if (isStart || isEnd) { bg = 'var(--accent)'; color = '#000' }
          else if (inRange) { bg = 'var(--surface-2)' }

          if (effStart !== effEnd) {
            if (isStart) br = '6px 0 0 6px'
            else if (isEnd) br = '0 6px 6px 0'
            else if (inRange) br = '0'
          }

          return (
            <div
              key={i}
              onClick={() => onDay(ymd)}
              onMouseEnter={() => onHover(ymd)}
              style={{ background: bg, borderRadius: br, cursor: 'pointer', padding: '1px' }}
            >
              <div style={{
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: isStart || isEnd ? 700 : isToday ? 600 : 400,
                color,
                textDecoration: isToday && !isStart && !isEnd ? 'underline' : 'none',
              }}>
                {day}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const PRESETS: { label: string; fn: () => [string, string] }[] = [
  { label: 'Denne måned',      fn: thisMonth },
  { label: 'Forrige måned',    fn: lastMonth },
  { label: 'Sidste 3 måneder', fn: () => lastNMonths(3) },
  { label: 'Sidste 6 måneder', fn: () => lastNMonths(6) },
  { label: 'I år',             fn: thisYear },
  { label: 'Forrige år',       fn: lastYear },
]

interface Props {
  start: string
  end: string
  cmpStart?: string | null
  cmpEnd?: string | null
}

export default function DateRangePicker({ start, end, cmpStart, cmpEnd }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const ref      = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  // Draft state — only committed on Apply
  const [dStart, setDStart] = useState(start)
  const [dEnd,   setDEnd]   = useState(end)
  const [cmpOn,  setCmpOn]  = useState(!!(cmpStart && cmpEnd))
  const [dCmpS,  setDCmpS]  = useState(cmpStart ?? '')
  const [dCmpE,  setDCmpE]  = useState(cmpEnd   ?? '')

  // Calendar month shown on the right
  const now = new Date()
  const [calY, setCalY] = useState(now.getFullYear())
  const [calM, setCalM] = useState(now.getMonth())

  // Selection state: null = idle, string = first date picked (waiting for second)
  const [sel,    setSel]    = useState<string | null>(null)
  const [hover,  setHover]  = useState<string | null>(null)

  // Left calendar = one month before right calendar
  const prevCal = calM === 0 ? { y: calY - 1, m: 11 } : { y: calY, m: calM - 1 }

  function navPrev() {
    if (calM === 0) { setCalY(y => y - 1); setCalM(11) } else setCalM(m => m - 1)
  }
  function navNext() {
    if (calM === 11) { setCalY(y => y + 1); setCalM(0) } else setCalM(m => m + 1)
  }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function handleOpen() {
    setDStart(start); setDEnd(end)
    setCmpOn(!!(cmpStart && cmpEnd))
    setDCmpS(cmpStart ?? ''); setDCmpE(cmpEnd ?? '')
    setSel(null); setHover(null)
    const e = parseYMD(end)
    setCalY(e.getFullYear()); setCalM(e.getMonth())
    setOpen(true)
  }

  function onDay(ymd: string) {
    if (!sel) { setSel(ymd) } else {
      const [s, e] = [sel, ymd].sort() as [string, string]
      setDStart(s); setDEnd(e)
      setSel(null); setHover(null)
    }
  }

  function applyPreset([s, e]: [string, string]) {
    setDStart(s); setDEnd(e); setSel(null)
    const ed = parseYMD(e)
    setCalY(ed.getFullYear()); setCalM(ed.getMonth())
  }

  function handleApply() {
    const params = new URLSearchParams()
    params.set('start', dStart)
    params.set('end', dEnd)
    if (cmpOn && dCmpS && dCmpE) {
      params.set('cmpStart', dCmpS)
      params.set('cmpEnd', dCmpE)
    }
    router.push(`${pathname}?${params.toString()}`)
    setOpen(false)
  }

  const triggerLabel = formatRange(start, end)
  const cmpLabel = cmpStart && cmpEnd ? formatRange(cmpStart, cmpEnd) : null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px', borderRadius: '10px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--foreground)', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
        }}
      >
        <span style={{ fontSize: '13px' }}>📅</span>
        <span>{triggerLabel}</span>
        {cmpLabel && (
          <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 400 }}>vs. {cmpLabel}</span>
        )}
        <span style={{ color: 'var(--muted)', fontSize: '10px', marginLeft: '2px' }}>▼</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          onMouseLeave={() => setHover(null)}
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1000,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '16px', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            minWidth: '660px', display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', padding: '20px', gap: '20px' }}>
            {/* Presets */}
            <div style={{ width: '154px', flexShrink: 0 }}>
              <p style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '10px' }}>
                Foruddefinerede
              </p>
              {PRESETS.map(p => {
                const [s, e] = p.fn()
                const active = s === dStart && e === dEnd && !sel
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset([s, e])}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 12px', borderRadius: '8px', border: 'none',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#000' : 'var(--foreground)',
                      fontWeight: active ? 600 : 400, fontSize: '13px',
                      cursor: 'pointer', marginBottom: '2px',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ width: '1px', background: 'var(--border)', flexShrink: 0 }} />

            {/* Calendars */}
            <div style={{ flex: 1 }}>
              {/* Month navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <button onClick={navPrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', fontSize: '18px', lineHeight: 1, padding: '4px 8px' }}>‹</button>
                <button onClick={navNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground)', fontSize: '18px', lineHeight: 1, padding: '4px 8px' }}>›</button>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <Cal year={prevCal.y} month={prevCal.m} selecting={sel} hover={hover} rangeStart={dStart} rangeEnd={dEnd} onDay={onDay} onHover={setHover} />
                <div style={{ width: '1px', background: 'var(--border)', alignSelf: 'stretch' }} />
                <Cal year={calY} month={calM} selecting={sel} hover={hover} rangeStart={dStart} rangeEnd={dEnd} onDay={onDay} onHover={setHover} />
              </div>

              {/* Selected range label */}
              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--muted)', minHeight: '18px' }}>
                {sel
                  ? <span>Vælg slutdato…</span>
                  : <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{formatRange(dStart, dEnd)}</span>
                }
              </div>
            </div>
          </div>

          {/* Compare section */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: cmpOn ? '12px' : 0 }}>
              {/* Toggle */}
              <div
                onClick={() => setCmpOn(v => !v)}
                style={{
                  width: '36px', height: '20px', borderRadius: '10px', position: 'relative', cursor: 'pointer',
                  background: cmpOn ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border)',
                  transition: 'background 0.15s', flexShrink: 0,
                }}
              >
                <div style={{
                  width: '14px', height: '14px', borderRadius: '50%', position: 'absolute', top: '2px',
                  left: cmpOn ? '18px' : '2px', transition: 'left 0.15s',
                  background: cmpOn ? '#000' : 'var(--muted)',
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCmpOn(v => !v)}>
                Sammenlign med
              </span>
              {cmpOn && dCmpS && dCmpE && (
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '4px' }}>{formatRange(dCmpS, dCmpE)}</span>
              )}
            </div>

            {cmpOn && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Forrige år',     fn: () => shiftYears(dStart, dEnd, -1) },
                  { label: 'Forrige periode', fn: () => prevPeriod(dStart, dEnd) },
                ].map(p => {
                  const [s, e] = p.fn()
                  const active = s === dCmpS && e === dCmpE
                  return (
                    <button
                      key={p.label}
                      onClick={() => { setDCmpS(s); setDCmpE(e) }}
                      style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '13px',
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: active ? '#000' : 'var(--foreground)',
                        fontWeight: active ? 600 : 400, cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => setOpen(false)}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}
            >
              Annuller
            </button>
            <button
              onClick={handleApply}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: 'var(--accent)', border: 'none', color: '#000', cursor: 'pointer' }}
            >
              Anvend
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
