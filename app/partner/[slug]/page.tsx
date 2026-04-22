import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchGA4Events } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:  { label: 'Aktiv',     color: '#22c55e' },
    planned: { label: 'Planlagt',  color: '#f5d000' },
    ended:   { label: 'Afsluttet', color: '#888' },
  }
  const { label, color } = map[status] ?? { label: status, color: '#888' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </span>
  )
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function PartnerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { slug } = await params
  const { month: monthParam } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const EARLIEST = '2026-01'
  const selectedMonth = monthParam && monthParam >= EARLIEST && monthParam <= currentYM ? monthParam : currentYM
  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const ga4Start = `${selectedMonth}-01`
  const ga4End = `${selectedMonth}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!partner) redirect('/')

  const ga4Properties = [
    { id: partner.ga4_property_id, events: partner.ga4_events_1, label: partner.ga4_label_1, aliases: partner.ga4_aliases_1 },
    { id: partner.ga4_property_id_2, events: partner.ga4_events_2, label: partner.ga4_label_2, aliases: partner.ga4_aliases_2 },
  ].filter(p => p.id) as { id: string; events: string | null; label: string | null; aliases: string | null }[]

  const ga4Results = await Promise.all(
    ga4Properties.map(({ id, events }) => {
      const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
      return fetchGA4Events(id, eventNames, ga4Start, ga4End).catch(() => null)
    })
  )

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  const activeCampaigns = (campaigns ?? []).filter(c => c.status === 'active')
  const campaignBudget = (campaigns ?? []).reduce((sum, c) => sum + (c.monthly_budget ?? 0), 0)

  const subStart = partner.subscription_start ? new Date(partner.subscription_start) : null
  const subEnd = partner.subscription_end ? new Date(partner.subscription_end) : null
  let subMonthly: number | null = null
  if (subStart && subEnd && partner.subscription_budget) {
    const months = (subEnd.getFullYear() - subStart.getFullYear()) * 12 + (subEnd.getMonth() - subStart.getMonth()) + 1
    subMonthly = months > 0 ? Math.round(partner.subscription_budget / months) : null
  }

  const totalMonthly = (subMonthly ?? 0) + campaignBudget

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--background)' }}
    >
      {/* Top bar */}
      <header
        className="border-b px-8 py-4 flex items-center justify-between"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: 'var(--accent)' }}
          >
            HeyMate
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {partner.name}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>
          Partnerdashboard
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Kampagner i alt</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{campaigns?.length ?? 0}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Aktive kampagner</p>
            <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>{activeCampaigns.length}</p>
          </div>
          <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Samlet budget/md (ex. moms)</p>
            <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
              {totalMonthly > 0 ? `${totalMonthly.toLocaleString('da-DK')} kr` : '—'}
            </p>
            {(campaigns ?? []).filter(c => c.monthly_budget).map(c => (
              <p key={c.id} className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                inkl. {(c.monthly_budget as number).toLocaleString('da-DK')} kr i {(c.placements ?? []).join(', ') || c.name}
              </p>
            ))}
          </div>
        </div>

        {/* Subscription */}
        {(subStart || subEnd || partner.subscription_budget) && (
          <section
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Abonnement</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Startdato</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {subStart ? subStart.toLocaleDateString('da-DK') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Slutdato</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {subEnd ? subEnd.toLocaleDateString('da-DK') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Samlet budget (ex. moms)</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {partner.subscription_budget ? `${partner.subscription_budget.toLocaleString('da-DK')} kr` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Budget/md (beregnet)</p>
                <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {subMonthly ? `${subMonthly.toLocaleString('da-DK')} kr` : '—'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Campaigns */}
        <section
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Kampagner
            </h2>
          </div>
          {!campaigns || campaigns.length === 0 ? (
            <div className="px-6 py-10 text-center" style={{ color: 'var(--muted)' }}>
              <p className="text-sm">Ingen kampagner endnu.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Grafik', 'Kampagne', 'Placeringer', 'Status', 'Periode', 'Budget/md'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="pl-4 pr-2 py-4">
                      {c.graphic_url ? (
                        <img src={c.graphic_url} alt="" className="w-12 h-8 object-cover rounded" />
                      ) : (
                        <div
                          className="w-12 h-8 rounded flex items-center justify-center text-xs"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                        >
                          —
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {c.name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(c.placements ?? []).map((p: string) => (
                          <span
                            key={p}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-4 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      {c.start_date
                        ? `${c.start_date.slice(0, 7)}${c.end_date ? ` → ${c.end_date.slice(0, 7)}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                      {c.monthly_budget ? `${c.monthly_budget.toLocaleString('da-DK')} kr` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* GA4 stats */}
        {ga4Properties.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                Statistik
              </h2>
              <div className="flex items-center gap-2">
                {selectedMonth > EARLIEST ? (
                  <a
                    href={`?month=${prevMonth(selectedMonth)}`}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    ← Forrige
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', opacity: 0.4 }}>← Forrige</span>
                )}
                <span className="text-sm font-medium capitalize px-2" style={{ color: 'var(--foreground)', minWidth: '130px', textAlign: 'center' }}>
                  {monthLabel(selectedMonth)}
                </span>
                {selectedMonth < currentYM ? (
                  <a
                    href={`?month=${nextMonth(selectedMonth)}`}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    Næste →
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', opacity: 0.4 }}>Næste →</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ga4Properties.map(({ id, label, aliases, events: eventsStr }, i) => {
                const events = ga4Results[i]
                const aliasList = aliases ? aliases.split(',').map(a => a.trim()) : []
                const eventList = (eventsStr ?? '').split(',').map(e => e.trim())
                const aliasMap = Object.fromEntries(eventList.map((e, idx) => [e, aliasList[idx] || e]))
                return (
                  <div
                    key={id}
                    className="rounded-xl p-5"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-xs font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                      {label ?? `Property ${i + 1}`}
                    </p>
                    {events && events.length > 0 ? (
                      <div className="space-y-2">
                        {events.map(({ eventName, count }) => (
                          <div
                            key={eventName}
                            className="flex items-center justify-between py-2 border-b last:border-0"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                              {aliasMap[eventName] || eventName}
                            </span>
                            <span
                              className="text-sm font-bold tabular-nums"
                              style={{ color: 'var(--accent)' }}
                            >
                              {count.toLocaleString('da-DK')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>
                        {events === null ? 'Kunne ikke hente data.' : 'Ingen events konfigureret.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
