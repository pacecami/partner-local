import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchGA4Events } from '@/lib/ga4'
import { fetchPacenamiStats, type PacenamiStats } from '@/lib/pacenami'
import { GA4_PROPS } from '@/app/admin/indstillinger/page'
import PlacementLightbox from '@/components/PlacementLightbox'
import StatRow from '@/components/StatRow'
import CampaignsTable from '@/components/CampaignsTable'

// Parrer events baseret på eksplicit gruppe ("gruppe > Visningsnavn")
// eller falder tilbage på alias-navn hvis ingen gruppe er angivet
function pairEvents(
  totals: Record<string, number>,
  fixedPlacements: { name: string; image_url: string | null }[]
) {
  function findImage(label: string): string | null {
    const lower = label.toLowerCase()
    const match = fixedPlacements.find(fp =>
      lower.includes(fp.name.toLowerCase()) || fp.name.toLowerCase().includes(lower)
    )
    return match?.image_url ?? null
  }

  // Byg en map: alias → { gruppe, visningsnavn, count }
  // alias er enten "gruppe > Visningsnavn" eller bare "Visningsnavn"
  const grouped: Record<string, { visninger: number | null; kliks: number | null; imageUrl: string | null }> = {}

  for (const [alias, count] of Object.entries(totals)) {
    const sep = alias.indexOf(' > ')
    const gruppe    = sep > -1 ? alias.slice(0, sep).trim() : alias
    const display   = sep > -1 ? alias.slice(sep + 3).trim() : alias
    const isKlik    = /^klik/i.test(display)

    if (!grouped[gruppe]) grouped[gruppe] = { visninger: null, kliks: null, imageUrl: findImage(gruppe) }

    if (isKlik) {
      grouped[gruppe].kliks = (grouped[gruppe].kliks ?? 0) + count
    } else {
      grouped[gruppe].visninger = (grouped[gruppe].visninger ?? 0) + count
    }
  }

  return Object.entries(grouped).map(([label, data]) => ({ label, ...data }))
}

export const dynamic = 'force-dynamic'

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
  searchParams: Promise<{ month?: string; compare?: string }>
}) {
  const { slug } = await params
  const { month: monthParam, compare: compareParam } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const EARLIEST = '2026-01'
  const selectedMonth = monthParam && monthParam >= EARLIEST && monthParam <= currentYM ? monthParam : currentYM
  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const ga4Start = `${selectedMonth}-01`
  const ga4End = `${selectedMonth}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`

  const selectedCompare = compareParam && compareParam >= EARLIEST && compareParam < selectedMonth ? compareParam : null
  let cmpStart: string | null = null
  let cmpEnd: string | null = null
  if (selectedCompare) {
    const [cmpY, cmpM] = selectedCompare.split('-').map(Number)
    cmpStart = `${selectedCompare}-01`
    cmpEnd = `${selectedCompare}-${String(new Date(cmpY, cmpM, 0).getDate()).padStart(2, '0')}`
  }

  function sameMonthLastYear(ym: string) {
    const [y, m] = ym.split('-').map(Number)
    return `${y - 1}-${String(m).padStart(2, '0')}`
  }
  function pctDelta(current: number, compare: number | undefined | null): string | null {
    if (!compare || compare === 0) return null
    const d = ((current - compare) / compare) * 100
    return (d >= 0 ? '+' : '') + d.toFixed(0) + '%'
  }
  function deltaColor(current: number, compare: number | undefined | null): string {
    if (!compare || compare === 0) return 'var(--muted)'
    return current >= compare ? '#22c55e' : '#ef4444'
  }

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!partner) redirect('/')

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

  const [ga4Results, ga4CompareResults] = await Promise.all([
    Promise.all(
      ga4Properties.map(({ id, events }) => {
        const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
        return fetchGA4Events(id, eventNames, ga4Start, ga4End).catch(() => null)
      })
    ),
    selectedCompare
      ? Promise.all(
          ga4Properties.map(({ id, events }) => {
            const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
            return fetchGA4Events(id, eventNames, cmpStart!, cmpEnd!).catch(() => null)
          })
        )
      : Promise.resolve(null),
  ])

  const { data: subscriptionPeriods } = await supabase
    .from('subscription_periods')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  // Brug seneste periode som aktiv abonnementsdata (fald tilbage til partner-felterne)
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

  // Abonnement — brug aktivePeriode hvis den findes, ellers partner-felter som fallback
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

  // Pacenami banner-statistik — hent for kampagner med pacenami_campaign_id
  const bannerCampaigns = (campaigns ?? []).filter(c =>
    c.pacenami_campaign_id && (c.placements ?? []).includes('Banner')
  )
  const pacenamiResults: Record<string, PacenamiStats | null> = {}
  const pacenamiCompareResults: Record<string, PacenamiStats | null> = {}
  await Promise.all([
    ...bannerCampaigns.map(async c => {
      pacenamiResults[c.id] = await fetchPacenamiStats(c.pacenami_campaign_id, ga4Start, ga4End).catch(() => null)
    }),
    ...(selectedCompare ? bannerCampaigns.map(async c => {
      pacenamiCompareResults[c.id] = await fetchPacenamiStats(c.pacenami_campaign_id, cmpStart!, cmpEnd!).catch(() => null)
    }) : []),
  ])

  function sumPacenami(results: Record<string, PacenamiStats | null>): PacenamiStats | null {
    return Object.values(results).reduce<PacenamiStats | null>((acc, s) => {
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
  }
  const pacenamiTotal = sumPacenami(pacenamiResults)
  const pacenamiCompareTotal = selectedCompare ? sumPacenami(pacenamiCompareResults) : null

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
            Pace Group ApS
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
        {(subStart || subEnd || subBudget) && (
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
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Faste placeringer
            </h2>
            <PlacementLightbox placements={fixedPlacements} />
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
          <CampaignsTable campaigns={campaigns ?? []} />
        </section>

        {/* GA4 stats */}
        {ga4Properties.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                Statistik
              </h2>
              <div className="flex items-center gap-3">
                {/* Download rapport */}
                <a
                  href={`/partner/${slug}/rapport?month=${selectedMonth}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: '#000' }}
                >
                  ↓ Download rapport
                </a>
                <div className="flex items-center gap-2">
                {selectedMonth > EARLIEST ? (
                  <a
                    href={`?month=${prevMonth(selectedMonth)}${selectedCompare ? `&compare=${prevMonth(selectedCompare)}` : ''}`}
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
                    href={`?month=${nextMonth(selectedMonth)}${selectedCompare ? `&compare=${nextMonth(selectedCompare)}` : ''}`}
                    className="px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    Næste →
                  </a>
                ) : (
                  <span className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)', opacity: 0.4 }}>Næste →</span>
                )}
              </div>
              {/* Sammenligningsvælger */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Sammenlign:</span>
                {[
                  { label: 'Ingen', value: null },
                  { label: 'Forrige år', value: sameMonthLastYear(selectedMonth) },
                  { label: 'Forrige md.', value: prevMonth(selectedMonth) },
                ].map(opt => {
                  const active = opt.value === selectedCompare
                  return (
                    <a
                      key={opt.label}
                      href={opt.value ? `?month=${selectedMonth}&compare=${opt.value}` : `?month=${selectedMonth}`}
                      className="px-2.5 py-1 rounded-lg text-xs"
                      style={{
                        background: active ? 'var(--accent)' : 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: active ? '#000' : 'var(--muted)',
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {opt.label}
                    </a>
                  )
                })}
              </div>
                </div>
              </div>
            {/* Statistik — grouped oversigt + per-property breakdown */}
            {(() => {
              function buildTotals(results: typeof ga4Results) {
                const totals: Record<string, number> = {}
                ga4Properties.forEach(({ aliases, events: eventsStr }, i) => {
                  const events = results[i]
                  if (!events || events.length === 0) return
                  const aliasList = aliases ? aliases.split(',').map(a => a.trim()) : []
                  const eventList = (eventsStr ?? '').split(',').map(e => e.trim())
                  const aliasMap = Object.fromEntries(eventList.map((e, idx) => [e, aliasList[idx] || e]))
                  events.forEach(({ eventName, count }: { eventName: string; count: number }) => {
                    const raw = aliasMap[eventName] || eventName
                    const alias = raw.replace(/\s+(iOS|Android)$/i, '').trim()
                    totals[alias] = (totals[alias] ?? 0) + count
                  })
                })
                return totals
              }

              const totals = buildTotals(ga4Results)
              const cmpTotals = ga4CompareResults ? buildTotals(ga4CompareResults) : null
              if (Object.keys(totals).length === 0) return null
              const pairs = pairEvents(totals, fixedPlacements ?? [])
              const cmpPairs = cmpTotals ? pairEvents(cmpTotals, fixedPlacements ?? []) : null
              const totalVisninger = pairs.reduce((s, p) => s + (p.visninger ?? 0), 0)
              const totalKliks = pairs.reduce((s, p) => s + (p.kliks ?? 0), 0)
              const cmpTotalVisninger = cmpPairs ? cmpPairs.reduce((s, p) => s + (p.visninger ?? 0), 0) : null
              const cmpTotalKliks = cmpPairs ? cmpPairs.reduce((s, p) => s + (p.kliks ?? 0), 0) : null

              return (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  {/* Header med kolonner */}
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Placering</p>
                    <div className="flex items-center gap-5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                      <span style={{ minWidth: '72px', textAlign: 'right' }}>Visninger</span>
                      <span style={{ minWidth: '56px', textAlign: 'right' }}>Kliks</span>
                      <span style={{ minWidth: '52px', textAlign: 'right' }}>Klikrate</span>
                    </div>
                  </div>

                  {/* Én blok per gruppe */}
                  {pairs.map((p) => {
                    // Find per-property breakdown for denne gruppe
                    const breakdown = ga4Properties.map(({ label: propLabel, aliases, events: eventsStr }, i) => {
                      const events = ga4Results[i]
                      if (!events) return null
                      const aliasList = aliases ? aliases.split(',').map(a => a.trim()) : []
                      const eventList = (eventsStr ?? '').split(',').map(e => e.trim())
                      let vis = 0, klik = 0
                      eventList.forEach((ev, idx) => {
                        const fullAlias = aliasList[idx] ?? ev
                        const sep = fullAlias.indexOf(' > ')
                        const gruppe = sep > -1 ? fullAlias.slice(0, sep).trim() : fullAlias
                        const display = sep > -1 ? fullAlias.slice(sep + 3).trim() : fullAlias
                        if (gruppe !== p.label) return
                        const count = events.find(e => e.eventName === ev)?.count ?? 0
                        if (/^klik/i.test(display)) klik += count
                        else vis += count
                      })
                      if (vis === 0 && klik === 0) return null
                      return { propLabel, vis, klik }
                    }).filter(Boolean) as { propLabel: string; vis: number; klik: number }[]

                    const cmpP = cmpPairs?.find(c => c.label === p.label)
                    return (
                      <div key={p.label} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        {/* Gruppe-række */}
                        <div className="px-5">
                          <StatRow
                            label={p.label}
                            visninger={p.visninger}
                            kliks={p.kliks}
                            imageUrl={p.imageUrl}
                            cmpVisninger={cmpP?.visninger ?? null}
                            cmpKliks={cmpP?.kliks ?? null}
                          />
                        </div>
                        {/* Per-property underrækker */}
                        {breakdown.length > 1 && (
                          <div className="px-5 pb-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {breakdown.map(b => (
                              <StatRow key={b.propLabel} label={b.propLabel} visninger={b.vis || null} kliks={b.klik || null} sub />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Total-række */}
                  {(totalVisninger > 0 || totalKliks > 0) && (
                    <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Total</span>
                      <div className="flex items-center gap-5 tabular-nums">
                        <div className="text-right" style={{ minWidth: '72px' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{totalVisninger.toLocaleString('da-DK')}</p>
                          {cmpTotalVisninger != null && (
                            <p className="text-xs" style={{ color: deltaColor(totalVisninger, cmpTotalVisninger) }}>
                              {pctDelta(totalVisninger, cmpTotalVisninger)} · {cmpTotalVisninger.toLocaleString('da-DK')}
                            </p>
                          )}
                        </div>
                        <div className="text-right" style={{ minWidth: '56px' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{totalKliks.toLocaleString('da-DK')}</p>
                          {cmpTotalKliks != null && (
                            <p className="text-xs" style={{ color: deltaColor(totalKliks, cmpTotalKliks) }}>
                              {pctDelta(totalKliks, cmpTotalKliks)} · {cmpTotalKliks.toLocaleString('da-DK')}
                            </p>
                          )}
                        </div>
                        <div className="text-right" style={{ minWidth: '52px' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                            {totalVisninger > 0 ? `${((totalKliks / totalVisninger) * 100).toFixed(2)}%` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </section>
        )}

        {/* ── Banner statistik (Pacenami) ── */}
        {pacenamiTotal && (
          <section className="space-y-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              Banner statistik
            </h2>

            {/* Stat-kort */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[
                { label: 'Served',               cur: pacenamiTotal.served,              cmp: pacenamiCompareTotal?.served,              fmt: (v: number) => v.toLocaleString('da-DK'),  accent: false },
                { label: 'Impressions',           cur: pacenamiTotal.impressions,         cmp: pacenamiCompareTotal?.impressions,         fmt: (v: number) => v.toLocaleString('da-DK'),  accent: true  },
                { label: 'Viewable Impressions',  cur: pacenamiTotal.viewable_impressions,cmp: pacenamiCompareTotal?.viewable_impressions,fmt: (v: number) => v.toLocaleString('da-DK'),  accent: false },
                { label: 'Viewability',           cur: pacenamiTotal.viewability,         cmp: pacenamiCompareTotal?.viewability,         fmt: (v: number) => `${v.toFixed(2)}%`,         accent: true  },
                { label: 'Kliks',                 cur: pacenamiTotal.clicks,              cmp: pacenamiCompareTotal?.clicks,              fmt: (v: number) => v.toLocaleString('da-DK'),  accent: false },
                { label: 'CTR',                   cur: pacenamiTotal.ctr,                 cmp: pacenamiCompareTotal?.ctr,                 fmt: (v: number) => `${v.toFixed(2)}%`,         accent: true  },
              ].map(({ label, cur, cmp, fmt, accent }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 flex flex-col gap-1"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {label}
                  </p>
                  <p
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: accent ? 'var(--accent)' : 'var(--foreground)' }}
                  >
                    {fmt(cur)}
                  </p>
                  {selectedCompare && cmp != null && (
                    <p className="text-xs tabular-nums" style={{ color: deltaColor(cur, cmp) }}>
                      {pctDelta(cur, cmp)} · {fmt(cmp)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Per kampagne — kun hvis der er flere */}
            {bannerCampaigns.length > 1 && (
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  Opdelt per kampagne
                </div>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Kampagne', 'Impressions', 'Viewable', 'Viewability', 'Kliks', 'CTR'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bannerCampaigns.map((c, i) => {
                      const s = pacenamiResults[c.id]
                      return (
                        <tr key={c.id} style={{ borderBottom: i < bannerCampaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                          <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--foreground)' }}>{s ? s.impressions.toLocaleString('da-DK') : '—'}</td>
                          <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--foreground)' }}>{s ? s.viewable_impressions.toLocaleString('da-DK') : '—'}</td>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{s ? `${s.viewability.toFixed(2)}%` : '—'}</td>
                          <td className="px-4 py-3 text-sm tabular-nums" style={{ color: 'var(--foreground)' }}>{s ? s.clicks.toLocaleString('da-DK') : '—'}</td>
                          <td className="px-4 py-3 text-sm font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{s ? `${s.ctr.toFixed(2)}%` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
