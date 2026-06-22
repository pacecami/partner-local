export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function monthEnd(y: number, m: number): Date {
  return new Date(y, m + 1, 0)
}

export function formatRange(start: string, end: string): string {
  const s = parseYMD(start), e = parseYMD(end)
  const lastOfMonth = monthEnd(e.getFullYear(), e.getMonth())
  const isFullMonth =
    s.getDate() === 1 &&
    s.getMonth() === e.getMonth() &&
    s.getFullYear() === e.getFullYear() &&
    e.getDate() === lastOfMonth.getDate()
  if (isFullMonth) {
    return s.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
  }
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
  return `${fmt(s)} – ${fmt(e)}`
}
