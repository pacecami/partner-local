import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { fetchGA4Events } from '@/lib/ga4'
import { fetchPacenamiStats, type PacenamiStats } from '@/lib/pacenami'
import { GA4_PROPS } from '@/app/admin/indstillinger/page'
import PlacementLightbox from '@/components/PlacementLightbox'

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

export default async function PartnerTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { token } = await params
  const { month: monthParam } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const EARLIEST = '2026-01'
  const selectedMonth = monthParam && monthParam >= EARLIEST && monthParam <= currentYM ? monthParam : currentYM
  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const ga4Start = `${selectedMonth}-01`
  const ga4End = `${selectedMonth}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`

  // Slå op på access_token
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('access_token', token)
    .single()

  if (!partner) notFound()

  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))

  const partnerEventsArr  = [partner.ga4_events_1,  partner.ga4_events_2,  partner.ga4_events_3,  partner.ga4_events_4]
  const partnerAliasesArr = [partner.ga4_aliases_1, partner.ga4_aliases_2, partner.ga4_aliases_3, partner.ga4_aliases_4]
  const enabledArr = [partner.ga4_prop_1_enabled, partner.ga4_prop_2_enabled, partner.ga4_prop_3_enabled, partner.ga4_prop_4_enabled]

  const ga4Properties = GA4_PROPS
    .map(({ key, label }, i) => ({
      id:      settings[key] ?? '',
      label,
      events:  partnerEventsArr[i]  ?? null,
      aliases: partnerAliasesArr[i] ?? null,
    }))
    .filter((_, i) => enabledArr[i] && (settings[GA4_PROPS[i].key] ?? '')) as { id: string; label: string; events: string | null; aliases: string | null }[]

  const ga4Results = await Promise.all(
    ga4Properties.map(({ id, events }) => {
      const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
      return fetchGA4Events(id, eventNames, ga4Start, ga4End).catch(() => null)
    })
  )

  const { data: subscriptionPeriods } = await supabase
    .from('subscription_periods')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  const activePeriod = subscriptionPeriods?.[0] ?? null

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  const { data: fixedPlacements } = await supabase
    .from('fixed_placements')
    .select('*')
    .eq('partner_id', partner.id)
    .order('sort_order', { ascending: true })

  const activeCampaigns = (campaigns ?? []).filter(c => c.status === 'active')
  const campaignBudget = (campaigns ?? []).reduce((sum, c) => sum + (c.monthly_budget ?? 0), 0)

  const subStart = activePeriod
    ? new Date(activePeriod.start_date)
    : partner.subscription_start ? new Date(partner.subscription_start) : null
  const subEnd = activePeriod
    ? new Date(activePeriod.end_date)
    : partner.subscription_end ? new Date(partner.subscription_end) : null
  const subBudget = activePeriod ? activePeriod.budget : partner.subscription_budget
  let subMonthly: number | null = null
  if (subStart && subEnd && subBudget) {
    const months = (subEnd.getFullYear() - subStart.getFullYear()) * 12 + (subEnd.getMonth() - subStart.getMonth()) + 1
    subMonthly = months > 0 ? Math.round(subBudget / months) : null
  }

  const totalMonthly = (subMonthly ?? 0) + campaignBudget

  const bannerCampaigns = (campaigns ?? []).filter(c =>
    c.pacenami_campaign_id && (c.placements ?? []).includes('Banner')
  )
  const pacenamiResults: Record<string, PacenamiStats | null> = {}
  await Promise.all(
    bannerCampaigns.map(async c => {
      pacenamiResults[c.id] = await fetchPacenamiStats(
        c.pacenami_campaign_id,
        ga4Start,
        ga4End,
      ).catch(() => null)
    })
  )
  const pacenamiTotal = Object.values(pacenamiResults).reduce<PacenamiStats | null>((acc, s) => {
    if (!s) return acc
    if (!acc) return { ...s }
    return {
      served:               acc.served + s.served,
      impressions:          acc.impressions + s.impressions,
      viewable_impressions: acc.viewable_impressions + s.viewable_impressions,
      viewability:          acc.impressions + s.impressions > 0
        ? ((acc.viewable_impressions + s.viewable_impressions) / (acc.impressions + s.impressions)) * 100
        : 0,
      clicks: acc.clicks + s.clicks,
      ctr:    acc.impressions + s.impressions > 0
        ? ((acc.clicks + s.clicks) / (acc.impressions + s.impressions)) * 100
        : 0,
    }
  }, null)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Top bar */}
      <header
        className="border-b px-8 py-4 flex items-center justify-between"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            Pace Group ApS
          </span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {partner.name}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Partnerdashboard</span>
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
          </div>
        </div>

        {/* Abonnement */}
        {(subStart || subEnd || subBudget) && (
          <section className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
                  {subBudget ? `${(subBudget as number).toLocaleString('da-DK')} kr` : '—'}
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

        {/* Faste placeringer */}
        {fixedPlacements && fixedPlacements.length > 0 && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Faste placeringer</h2>
            <PlacementLightbox placements={fixedPlacements} />
          </section>
        )}

        {/* Kampagner */}
        <section className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Kampagner</h2>
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
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom: (i < campaigns.length - 1 && !c.impressions && !c.clicks && !c.emails_sent && !c.emails_opened && !c.clicks_to_advertiser) ? '1px solid var(--border)' : 'none' }}>
                      <td className="pl-4 pr-2 py-4">
                        {c.graphic_url ? (
                          <img src={c.graphic_url} alt="" className="w-12 h-8 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-8 rounded flex items-center justify-center text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>—</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(c.placements ?? []).map((p: string) => (
                            <span key={p} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-4 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {c.start_date ? `${c.start_date.slice(0, 7)}${c.end_date ? ` → ${c.end_date.slice(0, 7)}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                        {c.monthly_budget ? `${c.monthly_budget.toLocaleString('da-DK')} kr` : '—'}
                      </td>
                    </tr>
                    {(c.impressions != null || c.clicks != null || c.emails_sent != null || c.emails_opened != null || c.clicks_to_advertiser != null) && (() => {
                      const placements: string[] = c.placements ?? []
                      const isEmail  = placements.some((p: string) => p === 'Nyhedsbreve' || p === 'Tilbudsmail')
                      const isBanner = placements.includes('Banner')
                      const isInapp  = placements.includes('Inapp')
                      const showVisual = isBanner || isInapp || (!isEmail && (c.impressions != null || c.clicks != null))
                      return (
                        <tr style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td />
                          <td colSpan={5} className="px-4 pb-4">
                            <div className="flex flex-wrap gap-6">
                              {isEmail && (
                                <>
                                  {c.emails_sent != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Antal sendte</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{(c.emails_sent as number).toLocaleString('da-DK')}</span>
                                    </div>
                                  )}
                                  {c.emails_sent != null && c.emails_opened != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Åbningsrate</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                                        {((c.emails_opened / c.emails_sent) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                  {c.clicks_to_advertiser != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks til annoncør</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks_to_advertiser as number).toLocaleString('da-DK')}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {isBanner && c.pacenami_report_url && (
                                <a href={c.pacenami_report_url} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                                  style={{ background: 'var(--accent)', color: '#000' }}>
                                  Se fuld rapport →
                                </a>
                              )}
                              {showVisual && (
                                <>
                                  {c.impressions != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Visninger</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{(c.impressions as number).toLocaleString('da-DK')}</span>
                                    </div>
                                  )}
                                  {c.clicks != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks as number).toLocaleString('da-DK')}</span>
                                    </div>
                                  )}
                                  {c.impressions != null && c.clicks != null && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs" style={{ color: 'var(--muted)' }}>CTR</span>
                                      <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                                        {((c.clicks / c.impressions) * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })()}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* GA4 statistik */}
        {ga4Properties.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Statistik</h2>
              <div className="flex items-center gap-2">
                {selectedMonth > EARLIEST ? (
                  <a href={`?month=${prevMonth(selectedMonth)}`} className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>← Forrige</a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', opacity: 0.4 }}>← Forrige</span>
                )}
                <span className="text-sm font-medium capitalize px-2" style={{ color: 'var(--foreground)', minWidth: '130px', textAlign: 'center' }}>
                  {monthLabel(selectedMonth)}
                </span>
                {selectedMonth < currentYM ? (
                  <a href={`?month=${nextMonth(selectedMonth)}`} className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>Næste →</a>
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
                  <div key={id} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-semibold mb-4" style={{ color: 'var(--foreground)' }}>{label}</p>
                    {events && events.length > 0 ? (
                      <div className="space-y-2">
                        {events.map(({ eventName, count }) => (
                          <div key={eventName} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{aliasMap[eventName] || eventName}</span>
                            <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{count.toLocaleString('da-DK')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>Ingen data.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Banner statistik */}
        {pacenamiTotal && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Banner statistik</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { label: 'Served',              value: pacenamiTotal.served.toLocaleString('da-DK'),               accent: false },
                { label: 'Impressions',          value: pacenamiTotal.impressions.toLocaleString('da-DK'),         accent: true  },
                { label: 'Viewable Impressions', value: pacenamiTotal.viewable_impressions.toLocaleString('da-DK'),accent: false },
                { label: 'Viewability',          value: `${pacenamiTotal.viewability.toFixed(2)}%`,                accent: true  },
                { label: 'Kliks',                value: pacenamiTotal.clicks.toLocaleString('da-DK'),              accent: false },
                { label: 'CTR',                  value: `${pacenamiTotal.ctr.toFixed(2)}%`,                        accent: true  },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-xl p-4 flex flex-col gap-1" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: accent ? 'var(--accent)' : 'var(--foreground)' }}>{value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  )
}
