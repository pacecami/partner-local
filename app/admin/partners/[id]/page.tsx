import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchGA4Events, type GA4EventResult } from '@/lib/ga4'
import { fetchPacenamiStats, type PacenamiStats } from '@/lib/pacenami'

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

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const { id: slug } = await params
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

  if (!partner) redirect('/admin')

  const ga4Properties = [
    { id: partner.ga4_property_id, events: partner.ga4_events_1, label: partner.ga4_label_1, aliases: partner.ga4_aliases_1 },
    { id: partner.ga4_property_id_2, events: partner.ga4_events_2, label: partner.ga4_label_2, aliases: partner.ga4_aliases_2 },
    { id: partner.ga4_property_id_3, events: null, label: null, aliases: null },
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

  // Pacenami banner-statistik
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

  async function updatePartner(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('name') as string).trim()
    const ga4_1 = (formData.get('ga4_property_id') as string).trim()
    const ga4_2 = (formData.get('ga4_property_id_2') as string).trim()
    const ga4_3 = (formData.get('ga4_property_id_3') as string).trim()
    const events_1 = (formData.get('ga4_events_1') as string).trim()
    const events_2 = (formData.get('ga4_events_2') as string).trim()
    const label_1 = (formData.get('ga4_label_1') as string).trim()
    const label_2 = (formData.get('ga4_label_2') as string).trim()
    const aliases_1 = (formData.get('ga4_aliases_1') as string).trim()
    const aliases_2 = (formData.get('ga4_aliases_2') as string).trim()
    const subscription_start = (formData.get('subscription_start') as string) || null
    const subscription_end = (formData.get('subscription_end') as string) || null
    const subBudgetRaw = (formData.get('subscription_budget') as string).replace(/\./g, '').replace(/,/g, '.').trim()
    const subscription_budget = subBudgetRaw ? Number(subBudgetRaw) : null
    await supabase
      .from('partners')
      .update({
        name,
        ga4_property_id: ga4_1 || null,
        ga4_property_id_2: ga4_2 || null,
        ga4_property_id_3: ga4_3 || null,
        ga4_events_1: events_1 || null,
        ga4_events_2: events_2 || null,
        ga4_label_1: label_1 || null,
        ga4_label_2: label_2 || null,
        ga4_aliases_1: aliases_1 || null,
        ga4_aliases_2: aliases_2 || null,
        subscription_start,
        subscription_end,
        subscription_budget,
      })
      .eq('id', partner.id)
    redirect(`/admin/partners/${slug}`)
  }

  async function addCampaign(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('name') as string).trim()
    const status = formData.get('status') as string
    const start_date = formData.get('start_date') as string || null
    const end_date = formData.get('end_date') as string || null
    const budgetRaw = (formData.get('monthly_budget') as string).replace(/\./g, '').replace(/,/g, '.').trim()
    const monthly_budget = budgetRaw ? Number(budgetRaw) : null
    const placements = formData.getAll('placements') as string[]
    const graphicFile = formData.get('graphic') as File | null
    let graphic_url: string | null = null
    if (graphicFile && graphicFile.size > 0) {
      const bytes = await graphicFile.arrayBuffer()
      const filename = `${Date.now()}-${graphicFile.name}`
      const { data: uploadData } = await supabase.storage
        .from('campaign-graphics')
        .upload(filename, Buffer.from(bytes), { contentType: graphicFile.type || 'image/png' })
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('campaign-graphics')
          .getPublicUrl(uploadData.path)
        graphic_url = urlData.publicUrl
      }
    }
    await supabase.from('campaigns').insert({
      partner_id: partner.id,
      name,
      status,
      start_date,
      end_date,
      monthly_budget,
      placements,
      graphic_url,
    })
    redirect(`/admin/partners/${slug}`)
  }

  async function deleteCampaign(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const campaignId = formData.get('campaign_id') as string
    await supabase.from('campaigns').delete().eq('id', campaignId)
    redirect(`/admin/partners/${slug}`)
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <a href="/admin" className="text-sm" style={{ color: 'var(--muted)' }}>
            ← Alle partnere
          </a>
          <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>
            {partner.name}
          </h1>
        </div>
        <a
          href={`/partner/${slug}`}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        >
          Se partnerdashboard →
        </a>
      </div>

      {/* Subscription box */}
      <section className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Abonnement</h2>
        {partner.subscription_start || partner.subscription_end || partner.subscription_budget ? (() => {
          const start = partner.subscription_start ? new Date(partner.subscription_start) : null
          const end = partner.subscription_end ? new Date(partner.subscription_end) : null
          let monthlyCalc: number | null = null
          if (start && end && partner.subscription_budget) {
            const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
            monthlyCalc = months > 0 ? Math.round(partner.subscription_budget / months) : null
          }
          const campaignExtra = (campaigns ?? []).reduce((sum, c) => sum + (c.monthly_budget ?? 0), 0)
          const totalMonthly = (monthlyCalc ?? 0) + campaignExtra
          return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Startdato</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {start ? start.toLocaleDateString('da-DK') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Slutdato</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {end ? end.toLocaleDateString('da-DK') : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Samlet budget (ex. moms)</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {partner.subscription_budget ? `${partner.subscription_budget.toLocaleString('da-DK')} kr` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Abonnement/md</p>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {monthlyCalc ? `${monthlyCalc.toLocaleString('da-DK')} kr` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Samlet/md (ex. moms)</p>
                <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {totalMonthly > 0 ? `${totalMonthly.toLocaleString('da-DK')} kr` : '—'}
                </p>
                {(campaigns ?? []).filter(c => c.monthly_budget).map(c => (
                  <p key={c.id} className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    inkl. {(c.monthly_budget as number).toLocaleString('da-DK')} kr i {(c.placements ?? []).join(', ') || c.name}
                  </p>
                ))}
              </div>
            </div>
          )
        })() : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Ingen abonnementsdata — udfyld felterne under Partnerinfo.</p>
        )}
      </section>

      {/* Campaigns list */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Kampagner ({campaigns?.length ?? 0})
          </h2>
        </div>
        {!campaigns || campaigns.length === 0 ? (
          <div className="px-6 py-8 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Ingen kampagner endnu.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Grafik', 'Navn', 'Placeringer', 'Status', 'Periode', 'Budget/md', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const hasPerf = c.impressions != null || c.clicks != null || c.emails_sent != null || c.emails_opened != null || c.clicks_to_advertiser != null
                const placements: string[] = c.placements ?? []
                const isEmail = placements.some((p: string) => p === 'Nyhedsbreve' || p === 'Tilbudsmail')
                const isBanner = placements.includes('Banner')
                const isInapp = placements.includes('Inapp')
                const isVisual = isBanner || isInapp
                const showVisual = isVisual || (!isEmail && (c.impressions != null || c.clicks != null))
                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ borderBottom: (!hasPerf && i < campaigns.length - 1) ? '1px solid var(--border)' : 'none' }}>
                      <td className="pl-4 pr-2 py-4">
                        {c.graphic_url ? (
                          <img src={c.graphic_url} alt="" className="w-10 h-7 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-7 rounded flex items-center justify-center text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>—</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(c.placements ?? []).map((p: string) => (
                            <span key={p} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>{p}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-4 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {c.start_date ? `${c.start_date.slice(0,7)}${c.end_date ? `→${c.end_date.slice(0,7)}` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                        {c.monthly_budget ? `${c.monthly_budget.toLocaleString('da-DK')} kr` : '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/admin/partners/${slug}/campaigns/${c.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                            style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                          >
                            Rediger
                          </a>
                          <form action={deleteCampaign} className="inline">
                            <input type="hidden" name="campaign_id" value={c.id} />
                            <button type="submit" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Slet</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    {hasPerf && (
                      <tr style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td />
                        <td colSpan={6} className="px-4 pb-3">
                          <div className="flex flex-wrap gap-5">
                            {isEmail && (
                              <>
                                {c.emails_sent != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Sendte</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.emails_sent as number).toLocaleString('da-DK')}</span>
                                  </div>
                                )}
                                {c.emails_sent != null && c.emails_opened != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Åbningsrate</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{((c.emails_opened / c.emails_sent) * 100).toFixed(1)}%</span>
                                  </div>
                                )}
                                {c.clicks_to_advertiser != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks til annoncør</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks_to_advertiser as number).toLocaleString('da-DK')}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {isBanner && c.pacenami_report_url && (
                              <a
                                href={c.pacenami_report_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: 'var(--accent)', color: '#000' }}
                              >
                                Se fuld rapport →
                              </a>
                            )}
                            {showVisual && (
                              <>
                                {c.impressions != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Visninger</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.impressions as number).toLocaleString('da-DK')}</span>
                                  </div>
                                )}
                                {c.clicks != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks as number).toLocaleString('da-DK')}</span>
                                  </div>
                                )}
                                {c.impressions != null && c.clicks != null && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{isBanner ? 'Klikrate' : 'CTR'}</span>
                                    <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{((c.clicks / c.impressions) * 100).toFixed(1)}%</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Add campaign */}
      <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Tilføj kampagne</h2>
        <form action={addCampaign} className="space-y-4" encType="multipart/form-data">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kampagnenavn *</label>
              <input name="name" required placeholder="fx Forårskampagne 2025" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Status</label>
              <select name="status" defaultValue="planned" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="planned">Planlagt</option>
                <option value="active">Aktiv</option>
                <option value="ended">Afsluttet</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Budget/md (kr)</label>
              <input name="monthly_budget" type="text" inputMode="numeric" placeholder="15.000" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Startdato</label>
              <input name="start_date" type="date" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slutdato</label>
              <input name="end_date" type="date" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Grafik (PNG)</label>
              <input name="graphic" type="file" accept="image/png,image/jpeg" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Placeringer</label>
              <div className="flex flex-wrap gap-2">
                {['Inapp', 'Nyhedsbreve', 'Tilbudsmail', 'Banner', 'Placeringer på TjekBil', 'Placeringer på Bilhandel'].map(p => (
                  <label key={p} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    <input type="checkbox" name="placements" value={p} className="accent-yellow-400" />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>+ Tilføj kampagne</button>
          </div>
        </form>
      </section>

      {/* Edit partner */}
      <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>Partnerinfo</h2>
        <form action={updatePartner} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn *</label>
              <input name="name" required defaultValue={partner.name} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>GA4 Property ID 1</label>
              <input name="ga4_property_id" defaultValue={partner.ga4_property_id ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>GA4 Property ID 2</label>
              <input name="ga4_property_id_2" defaultValue={partner.ga4_property_id_2 ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>GA4 Property ID 3</label>
              <input name="ga4_property_id_3" defaultValue={partner.ga4_property_id_3 ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Label — Property 1</label>
              <input name="ga4_label_1" defaultValue={partner.ga4_label_1 ?? ''} placeholder="fx TjekBil web" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Label — Property 2</label>
              <input name="ga4_label_2" defaultValue={partner.ga4_label_2 ?? ''} placeholder="fx TjekBil app" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Abonnement startdato</label>
              <input name="subscription_start" type="date" defaultValue={partner.subscription_start ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Abonnement slutdato</label>
              <input name="subscription_end" type="date" defaultValue={partner.subscription_end ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Samlet budget for perioden (kr, ex. moms)</label>
              <input name="subscription_budget" type="text" inputMode="numeric" defaultValue={partner.subscription_budget ? partner.subscription_budget.toLocaleString('da-DK') : ''} placeholder="120.000" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Events — Property 1 <span className="font-normal">(kommasepareret, tekniske navne)</span></label>
              <input name="ga4_events_1" defaultValue={partner.ga4_events_1 ?? ''} placeholder="event_navn_1,event_navn_2" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Visningsnavne — Property 1 <span className="font-normal">(hvad partneren ser, samme rækkefølge)</span></label>
              <input name="ga4_aliases_1" defaultValue={partner.ga4_aliases_1 ?? ''} placeholder="App visninger,Nummerplade klik,App download" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Events — Property 2 <span className="font-normal">(kommasepareret, tekniske navne)</span></label>
              <input name="ga4_events_2" defaultValue={partner.ga4_events_2 ?? ''} placeholder="event_navn_1,event_navn_2" className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>Visningsnavne — Property 2 <span className="font-normal">(hvad partneren ser, samme rækkefølge)</span></label>
              <input name="ga4_aliases_2" defaultValue={partner.ga4_aliases_2 ?? ''} placeholder="App visninger,Nummerplade klik" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>Gem ændringer</button>
          </div>
        </form>
      </section>

      {/* GA4 Stats */}
      {ga4Properties.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              GA4 statistik
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
          {ga4Properties.map(({ id, label, aliases }, i) => {
            const events = ga4Results[i]
            const aliasMap = aliases
              ? Object.fromEntries(
                  (ga4Properties[i].events ?? '').split(',').map((e, idx) => [
                    e.trim(),
                    aliases.split(',')[idx]?.trim() || e.trim(),
                  ])
                )
              : {}
            return (
              <div key={id} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs mb-4 font-mono" style={{ color: 'var(--muted)' }}>{label ?? `Property ${i + 1}`}: {id}</p>
                {events && events.length > 0 ? (
                  <div className="space-y-1">
                    {events.map(({ eventName, count }) => {
                      const displayName = aliasMap[eventName] || eventName
                      const hasAlias = displayName !== eventName
                      return (
                        <div key={eventName} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                          <div>
                            {hasAlias && (
                              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{displayName}</p>
                            )}
                            <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{eventName}</p>
                          </div>
                          <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{count.toLocaleString('da-DK')}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {events === null ? 'Kunne ikke hente data — tjek at service accounten har adgang.' : 'Ingen events konfigureret.'}
                  </p>
                )}
              </div>
            )
          })}

          {/* I alt */}
          {(() => {
            const totals: Record<string, number> = {}
            ga4Properties.forEach(({ aliases, events: eventsStr }, i) => {
              const events = ga4Results[i]
              if (!events || events.length === 0) return
              const aliasList = aliases ? aliases.split(',').map(a => a.trim()) : []
              const eventList = (eventsStr ?? '').split(',').map(e => e.trim())
              const aliasMap = Object.fromEntries(eventList.map((e, idx) => [e, aliasList[idx] || e]))
              events.forEach(({ eventName, count }: { eventName: string; count: number }) => {
                const alias = aliasMap[eventName] || eventName
                totals[alias] = (totals[alias] ?? 0) + count
              })
            })
            const grandTotal = Object.values(totals).reduce((s, c) => s + c, 0)
            if (grandTotal === 0) return null
            return (
              <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--accent)' }}>I alt</p>
                <div className="space-y-1">
                  {Object.entries(totals).map(([alias, count]) => (
                    <div key={alias} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{alias}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{count.toLocaleString('da-DK')}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-3 mt-1" style={{ borderTop: '2px solid var(--border)' }}>
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Samlet total</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{grandTotal.toLocaleString('da-DK')}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </section>
      )}

      {/* ── Banner statistik (Pacenami) ── */}
      {pacenamiTotal && (
        <section className="space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Banner statistik <span className="font-normal text-xs ml-1" style={{ color: 'var(--muted)' }}>(Pacenami — {monthLabel(selectedMonth)})</span>
          </h2>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: 'Served',              value: pacenamiTotal.served.toLocaleString('da-DK'),               accent: false },
              { label: 'Impressions',         value: pacenamiTotal.impressions.toLocaleString('da-DK'),          accent: true  },
              { label: 'Viewable Impr.',      value: pacenamiTotal.viewable_impressions.toLocaleString('da-DK'), accent: false },
              { label: 'Viewability',         value: `${pacenamiTotal.viewability.toFixed(2)}%`,                 accent: true  },
              { label: 'Kliks',               value: pacenamiTotal.clicks.toLocaleString('da-DK'),              accent: false },
              { label: 'CTR',                 value: `${pacenamiTotal.ctr.toFixed(2)}%`,                        accent: true  },
            ].map(({ label, value, accent }) => (
              <div
                key={label}
                className="rounded-xl p-4 flex flex-col gap-1"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: accent ? 'var(--accent)' : 'var(--foreground)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

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

    </div>
  )
}
