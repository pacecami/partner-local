import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeeksForMonth(year: number, month: number): number[] {
  // month er 1-indexed
  const weeks = new Set<number>()
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    weeks.add(getISOWeek(new Date(year, month - 1, day)))
  }
  return Array.from(weeks).sort((a, b) => a - b)
}

const PARTNER_COLORS: Record<string, string> = {
  'Motorstyrelsen': '#f5d000',
  'DCC Energi': '#22c55e',
  'DCC': '#22c55e',
  'Applus': '#3b82f6',
  'DAH': '#f97316',
  'Dansk autohjælp': '#f97316',
  'SOS': '#ec4899',
  'FDM': '#8b5cf6',
  'Toyota': '#ef4444',
  'Hyundai': '#06b6d4',
  'Renault': '#f59e0b',
  'Greenbow': '#10b981',
}

function partnerColor(name: string) {
  return PARTNER_COLORS[name] ?? '#888'
}

export default async function OverblikPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const currentMonth = now.getMonth() + 1 // 1-indexed
  const currentYear = now.getFullYear()
  const selectedYear = yearParam ? parseInt(yearParam) : currentYear

  // Hent planningsdata
  const { data: entries } = await supabase
    .from('planning_entries')
    .select('*')
    .eq('year', selectedYear)
    .order('sort_order', { ascending: true })

  // Hent aktive kampagner fra DB
  const { data: dbCampaigns } = await supabase
    .from('campaigns')
    .select('*, partners(name, slug)')
    .eq('status', 'active')

  const activeCampaigns = dbCampaigns ?? []

  // Gruppér planning entries efter kategori
  const grouped: Record<string, typeof entries> = {}
  for (const entry of entries ?? []) {
    if (!grouped[entry.category]) grouped[entry.category] = []
    grouped[entry.category]!.push(entry)
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Overblik</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Kampagneplanlægning — placeringer og partnere pr. måned
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Årsvælger */}
          <div className="flex items-center gap-2">
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <a
                key={y}
                href={`?year=${y}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  background: y === selectedYear ? 'var(--accent)' : 'var(--surface-2)',
                  color: y === selectedYear ? '#000' : 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {y}
              </a>
            ))}
          </div>
          <a
            href="/admin/overblik/ny"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--accent)', color: '#000' }}
          >
            + Tilføj placering
          </a>
        </div>
      </div>

      {/* Aktive kampagner nu */}
      {activeCampaigns.length > 0 && selectedYear === currentYear && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            Aktive kampagner lige nu
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-normal" style={{ background: '#22c55e22', color: '#22c55e' }}>
              {activeCampaigns.length} aktive
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {activeCampaigns.map((c: any) => (
              <a
                key={c.id}
                href={`/admin/partners/${c.partners?.slug}`}
                className="rounded-xl p-4 block transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{c.partners?.name}</p>
                <p className="text-sm font-medium mt-0.5 truncate" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(c.placements ?? []).map((p: string) => (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{p}</span>
                  ))}
                </div>
                {(c.start_date || c.end_date) && (
                  <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                    {c.start_date?.slice(0, 7)}{c.end_date ? ` → ${c.end_date.slice(0, 7)}` : ''}
                  </p>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Planningsgrid */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          Kampagneoverblik {selectedYear}
        </h2>

        {Object.keys(grouped).length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Ingen placeringer for {selectedYear} endnu.</p>
            <a href="/admin/overblik/ny" className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
              + Tilføj placering
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium"
                    style={{
                      color: 'var(--muted)',
                      borderRight: '1px solid var(--border)',
                      minWidth: '220px',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--surface-2)',
                      zIndex: 10,
                    }}
                  >
                    Placering
                  </th>
                  {MONTHS.map((m, i) => {
                    const isCurrent = (i + 1) === currentMonth && selectedYear === currentYear
                    const weeks = getWeeksForMonth(selectedYear, i + 1)
                    const weekLabel = weeks.length > 0
                      ? `uge ${weeks[0]}${weeks.length > 1 ? `–${weeks[weeks.length - 1]}` : ''}`
                      : ''
                    return (
                      <th
                        key={m}
                        className="px-2 py-2 text-center text-xs font-medium"
                        style={{
                          color: isCurrent ? 'var(--accent)' : 'var(--muted)',
                          borderLeft: '1px solid var(--border)',
                          minWidth: '80px',
                          background: isCurrent ? 'rgba(245,208,0,0.07)' : 'transparent',
                        }}
                      >
                        <span className="block font-semibold">{m}</span>
                        <span className="block text-xs font-normal opacity-70">{weekLabel}</span>
                        {isCurrent && (
                          <span className="block text-xs font-normal" style={{ color: 'var(--accent)' }}>↑ nu</span>
                        )}
                      </th>
                    )
                  })}
                  <th
                    className="px-3 py-3 text-xs font-medium"
                    style={{ color: 'var(--muted)', borderLeft: '1px solid var(--border)', minWidth: '80px' }}
                  />
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([category, rows]) => (
                  <>
                    {/* Kategori-header */}
                    <tr key={`cat-${category}`}>
                      <td
                        colSpan={14}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                        style={{
                          color: 'var(--muted)',
                          background: 'var(--surface)',
                          borderTop: '2px solid var(--border)',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {category}
                      </td>
                    </tr>
                    {(rows ?? []).map((entry: any) => {
                      const months: Record<string, string[]> = entry.months ?? {}
                      return (
                        <tr
                          key={entry.id}
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          {/* Placering */}
                          <td
                            className="px-4 py-3"
                            style={{
                              borderRight: '1px solid var(--border)',
                              background: 'var(--surface)',
                              position: 'sticky',
                              left: 0,
                              zIndex: 5,
                            }}
                          >
                            <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{entry.placement}</p>
                            {entry.placement_comment && (
                              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{entry.placement_comment}</p>
                            )}
                          </td>

                          {/* Måneder */}
                          {MONTHS.map((_, mi) => {
                            const monthKey = String(mi + 1)
                            const partners: string[] = months[monthKey] ?? []
                            const isCurrent = (mi + 1) === currentMonth && selectedYear === currentYear
                            return (
                              <td
                                key={mi}
                                className="px-1.5 py-2 align-top"
                                style={{
                                  borderLeft: '1px solid var(--border)',
                                  background: isCurrent ? 'rgba(245,208,0,0.04)' : 'transparent',
                                  verticalAlign: 'top',
                                }}
                              >
                                {partners.length > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    {partners.map(p => (
                                      <span
                                        key={p}
                                        className="text-xs px-1.5 py-0.5 rounded font-medium block text-center whitespace-nowrap"
                                        style={{
                                          background: partnerColor(p) + '22',
                                          color: partnerColor(p),
                                          border: `1px solid ${partnerColor(p)}44`,
                                        }}
                                      >
                                        {p}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs block text-center" style={{ color: 'var(--border)' }}>—</span>
                                )}
                              </td>
                            )
                          })}

                          {/* Rediger-knap */}
                          <td className="px-3 py-3 text-right" style={{ borderLeft: '1px solid var(--border)' }}>
                            <a
                              href={`/admin/overblik/${entry.id}`}
                              className="text-xs px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                              style={{ background: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                            >
                              Rediger
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
