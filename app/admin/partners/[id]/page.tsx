import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { fetchGA4Events, type GA4EventResult } from '@/lib/ga4'
import { fetchPacenamiStats, type PacenamiStats } from '@/lib/pacenami'
import { GA4_PROPS } from '@/app/admin/indstillinger/page'

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

  // Hent globale GA4 property IDs
  const { data: settingsRows } = await supabase.from('settings').select('key, value')
  const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))

  const enabledFlags = [
    partner.ga4_prop_1_enabled,
    partner.ga4_prop_2_enabled,
    partner.ga4_prop_3_enabled,
    partner.ga4_prop_4_enabled,
  ]
  const partnerEvents  = [partner.ga4_events_1,  partner.ga4_events_2,  partner.ga4_events_3,  partner.ga4_events_4]
  const partnerAliases = [partner.ga4_aliases_1, partner.ga4_aliases_2, partner.ga4_aliases_3, partner.ga4_aliases_4]

  const ga4Properties = GA4_PROPS
    .map(({ key, label }, i) => ({
      id:      settings[key] ?? '',
      label,
      events:  partnerEvents[i]  ?? null,
      aliases: partnerAliases[i] ?? null,
      enabled: enabledFlags[i]   ?? false,
    }))
    .filter(p => p.id && p.enabled) as { id: string; label: string; events: string | null; aliases: string | null; enabled: boolean }[]

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

  const { data: fixedPlacements } = await supabase
    .from('fixed_placements')
    .select('*')
    .eq('partner_id', partner.id)
    .order('sort_order', { ascending: true })

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
    const subscription_start = (formData.get('subscription_start') as string) || null
    const subscription_end = (formData.get('subscription_end') as string) || null
    const subBudgetRaw = (formData.get('subscription_budget') as string).replace(/\./g, '').replace(/,/g, '.').trim()
    const subscription_budget = subBudgetRaw ? Number(subBudgetRaw) : null
    await supabase
      .from('partners')
      .update({
        name,
        subscription_start,
        subscription_end,
        subscription_budget,
      })
      .eq('id', partner.id)
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function updateEvents(formData: FormData) {
    'use server'
    const supabase = await createClient()

    function parsePairs(eventsKey: string, aliasesKey: string) {
      const evs = formData.getAll(eventsKey)  as string[]
      const als = formData.getAll(aliasesKey) as string[]
      return evs.map((e, i) => ({ e: e.trim(), a: (als[i] ?? '').trim() })).filter(p => p.e)
    }

    const p1 = parsePairs('ga4_event_1', 'ga4_alias_1')
    const p2 = parsePairs('ga4_event_2', 'ga4_alias_2')
    const p3 = parsePairs('ga4_event_3', 'ga4_alias_3')
    const p4 = parsePairs('ga4_event_4', 'ga4_alias_4')

    await supabase.from('partners').update({
      ga4_prop_1_enabled: formData.get('ga4_prop_1_enabled') === 'on',
      ga4_prop_2_enabled: formData.get('ga4_prop_2_enabled') === 'on',
      ga4_prop_3_enabled: formData.get('ga4_prop_3_enabled') === 'on',
      ga4_prop_4_enabled: formData.get('ga4_prop_4_enabled') === 'on',
      ga4_events_1:  p1.length ? p1.map(p => p.e).join(',') : null,
      ga4_aliases_1: p1.length ? p1.map(p => p.a).join(',') : null,
      ga4_events_2:  p2.length ? p2.map(p => p.e).join(',') : null,
      ga4_aliases_2: p2.length ? p2.map(p => p.a).join(',') : null,
      ga4_events_3:  p3.length ? p3.map(p => p.e).join(',') : null,
      ga4_aliases_3: p3.length ? p3.map(p => p.a).join(',') : null,
      ga4_events_4:  p4.length ? p4.map(p => p.e).join(',') : null,
      ga4_aliases_4: p4.length ? p4.map(p => p.a).join(',') : null,
    }).eq('id', partner.id)

    redirect(`/admin/partners/${slug}?saved=true`)
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
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function deleteCampaign(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const campaignId = formData.get('campaign_id') as string
    await supabase.from('campaigns').delete().eq('id', campaignId)
    redirect(`/admin/partners/${slug}`)
  }

  async function addFixedPlacement(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('fp_name') as string).trim()
    const sort_order = parseInt(formData.get('fp_sort_order') as string) || 0
    const url = (formData.get('fp_url') as string).trim() || null
    const imageFile = formData.get('fp_image') as File | null
    let image_url: string | null = null
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer()
      const filename = `${Date.now()}-${imageFile.name}`
      const { data: uploadData } = await supabase.storage
        .from('placement-images')
        .upload(filename, Buffer.from(bytes), { contentType: imageFile.type || 'image/png' })
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('placement-images')
          .getPublicUrl(uploadData.path)
        image_url = urlData.publicUrl
      }
    }
    const site = (formData.get('fp_site') as string).trim() || null
    await supabase.from('fixed_placements').insert({ partner_id: partner.id, name, image_url, sort_order, url, site })
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function deleteFixedPlacement(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const fpId = formData.get('fp_id') as string
    await supabase.from('fixed_placements').delete().eq('id', fpId)
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

      {/* Faste placeringer */}
      <section className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Faste placeringer ({fixedPlacements?.length ?? 0})
          </h2>
        </div>

        {/* Eksisterende */}
        {fixedPlacements && fixedPlacements.length > 0 && (
          <div className="p-6 grid grid-cols-2 gap-4 sm:grid-cols-3 border-b" style={{ borderColor: 'var(--border)' }}>
            {fixedPlacements.map(fp => (
              <div key={fp.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                {fp.image_url ? (
                  <img src={fp.image_url} alt={fp.name} className="w-full object-cover" style={{ maxHeight: '140px' }} />
                ) : (
                  <div className="w-full flex items-center justify-center text-xs" style={{ height: '100px', color: 'var(--muted)' }}>Intet billede</div>
                )}
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{fp.name}</p>
                      {fp.site && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                          {fp.site}
                        </span>
                      )}
                    </div>
                    {fp.url && (
                      <a
                        href={fp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs truncate block"
                        style={{ color: 'var(--accent)' }}
                        title={fp.url}
                      >
                        {fp.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={`/admin/partners/${slug}/placements/${fp.id}`}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                    >
                      Rediger
                    </a>
                    <form action={deleteFixedPlacement}>
                      <input type="hidden" name="fp_id" value={fp.id} />
                      <button type="submit" className="text-xs px-2 py-1 rounded" style={{ color: '#ef4444', background: 'transparent' }}>Slet</button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tilføj ny */}
        <form action={addFixedPlacement} className="p-6 space-y-4" encType="multipart/form-data">
          <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Tilføj fast placering</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn *</label>
              <input name="fp_name" required placeholder="fx Forsikring & finansiering — banner" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Site</label>
              <select name="fp_site" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="">— Vælg site —</option>
                <option value="Bilhandel">Bilhandel</option>
                <option value="TjekBil">TjekBil</option>
                <option value="TjekBilsyn">TjekBilsyn</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>URL (linker til)</label>
              <input name="fp_url" type="url" placeholder="https://www.eksempel.dk/side" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Billede (screenshot af placeringen)</label>
              <input name="fp_image" type="file" accept="image/*" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>+ Tilføj placering</button>
          </div>
        </form>
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
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn *</label>
              <input name="name" required defaultValue={partner.name} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
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
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>Gem ændringer</button>
          </div>
        </form>
      </section>

      {/* GA4 Events */}
      {(() => {
        const allProps = GA4_PROPS.map(({ key, label }, i) => {
          const id = settings[key] ?? ''
          const enabled = enabledFlags[i] ?? false
          const evRaw = (partnerEvents[i] ?? '').split(',').map((e: string) => e.trim()).filter(Boolean)
          const alRaw = (partnerAliases[i] ?? '').split(',').map((a: string) => a.trim())
          const rows = [
            ...evRaw.map((ev: string, j: number) => ({ ev, al: alRaw[j] ?? '' })),
            ...Array(Math.max(0, 5 - evRaw.length)).fill({ ev: '', al: '' }),
          ]
          return { key, label, id, enabled, rows, idx: i + 1 }
        })

        const hasAnyId = allProps.some(p => p.id)

        return (
          <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>GA4 Events</h2>
              <a
                href="/admin/indstillinger"
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                ⚙️ Rediger property IDs →
              </a>
            </div>

            {!hasAnyId ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Ingen GA4 property IDs konfigureret.{' '}
                <a href="/admin/indstillinger" style={{ color: 'var(--accent)' }}>Tilføj under Indstillinger →</a>
              </p>
            ) : (
              <form action={updateEvents} className="space-y-6">
                {/* Checkboxes — hvilke properties er aktive for denne partner */}
                <div>
                  <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted)' }}>Aktive properties for denne partner</p>
                  <div className="flex flex-wrap gap-3">
                    {allProps.map(p => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                        style={{
                          background: p.enabled ? 'var(--accent)' : 'var(--surface-2)',
                          color: p.enabled ? '#000' : 'var(--muted)',
                          border: '1px solid var(--border)',
                          opacity: p.id ? 1 : 0.4,
                        }}
                      >
                        <input
                          type="checkbox"
                          name={`ga4_prop_${p.idx}_enabled`}
                          defaultChecked={p.enabled}
                          disabled={!p.id}
                          className="accent-black"
                        />
                        <span className="font-medium text-xs">{p.label}</span>
                        {p.id && <span className="text-xs font-mono opacity-60">{p.id}</span>}
                        {!p.id && <span className="text-xs opacity-50">(ikke konfigureret)</span>}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Event-rækker per property */}
                {allProps.filter(p => p.id).map(p => (
                  <div key={p.key}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>{p.label}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{p.id}</p>
                    </div>
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      <div className="grid grid-cols-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Teknisk event navn</div>
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>Visningsnavn (hvad partneren ser)</div>
                      </div>
                      {p.rows.map((row: { ev: string; al: string }, i: number) => (
                        <div key={i} className="grid grid-cols-2" style={{ borderBottom: i < p.rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div className="px-2 py-1.5">
                            <input
                              name={`ga4_event_${p.idx}`}
                              defaultValue={row.ev}
                              placeholder="event_teknisk_navn"
                              className="w-full px-2 py-1 rounded text-xs outline-none font-mono"
                              style={{ background: 'transparent', color: 'var(--foreground)' }}
                            />
                          </div>
                          <div className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                            <input
                              name={`ga4_alias_${p.idx}`}
                              defaultValue={row.al}
                              placeholder="Visningsnavn"
                              className="w-full px-2 py-1 rounded text-xs outline-none"
                              style={{ background: 'transparent', color: 'var(--foreground)' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
                    Gem events
                  </button>
                </div>
              </form>
            )}
          </section>
        )
      })()}

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
                const raw = aliasMap[eventName] || eventName
                // Slå iOS og Android-varianter sammen til én linje
                const alias = raw.replace(/\s+(iOS|Android)$/i, '').trim()
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
