import React from 'react'
import { createServiceClient as createClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { fetchGA4Events, type GA4EventResult } from '@/lib/ga4'
import { fetchPacenamiStats, type PacenamiStats } from '@/lib/pacenami'
import { GA4_PROPS } from '@/app/admin/indstillinger/page'
import CopyLinkBox from '@/components/CopyLinkBox'
import DraggableSections from '@/components/DraggableSections'
import AddPlacementModal from '@/components/AddPlacementModal'
import AddCampaignModal from '@/components/AddCampaignModal'
import CampaignsTable from '@/components/CampaignsTable'
import AddLeadModal from '@/components/AddLeadModal'
import DateRangePicker from '@/components/DateRangePicker'
import { formatRange } from '@/lib/dateUtils'

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

export default async function PartnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ start?: string; end?: string; cmpStart?: string; cmpEnd?: string }>
}) {
  const { id: slug } = await params
  const { start: startParam, end: endParam, cmpStart: cmpStartParam, cmpEnd: cmpEndParam } = await searchParams
  const supabase = await createClient()

  const now = new Date()
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
  const ga4Start = startParam ?? defaultStart
  const ga4End   = endParam   ?? defaultEnd
  const cmpStart: string | null = (cmpStartParam && cmpEndParam) ? cmpStartParam : null
  const cmpEnd:   string | null = (cmpStartParam && cmpEndParam) ? cmpEndParam   : null
  const selectedCompare = !!(cmpStart && cmpEnd)

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
    partner.ga4_prop_5_enabled,
  ]
  const partnerEvents  = [partner.ga4_events_1,  partner.ga4_events_2,  partner.ga4_events_3,  partner.ga4_events_4,  partner.ga4_events_5]
  const partnerAliases = [partner.ga4_aliases_1, partner.ga4_aliases_2, partner.ga4_aliases_3, partner.ga4_aliases_4, partner.ga4_aliases_5]

  const ga4Properties = GA4_PROPS
    .map(({ key, label }, i) => ({
      id:      settings[key] ?? '',
      label,
      events:  partnerEvents[i]  ?? null,
      aliases: partnerAliases[i] ?? null,
      enabled: enabledFlags[i]   ?? false,
    }))
    .filter(p => p.id && p.enabled) as { id: string; label: string; events: string | null; aliases: string | null; enabled: boolean }[]

  const [ga4Results, ga4CompareResults] = await Promise.all([
    Promise.all(
      ga4Properties.map(({ id, events }) => {
        const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
        return fetchGA4Events(id, eventNames, ga4Start, ga4End).catch((err) => { console.error(`GA4 fejl (${id}):`, err?.message ?? err); return null })
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

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: true })

  const { data: fixedPlacements } = await supabase
    .from('fixed_placements')
    .select('*')
    .eq('partner_id', partner.id)
    .order('sort_order', { ascending: true })

  const { data: subscriptionPeriods } = await supabase
    .from('subscription_periods')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('partner_id', partner.id)
    .order('month', { ascending: false })

  // Vis "Tilføj ny periode"-knap når der er ≤ 2 måneder til udløb
  const latestPeriod = subscriptionPeriods?.[0] ?? null
  const twoMonthsFromNow = new Date()
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2)
  const showAddPeriod = !latestPeriod || new Date(latestPeriod.end_date) <= twoMonthsFromNow

  // Pacenami banner-statistik
  const bannerCampaigns = (campaigns ?? []).filter(c =>
    c.pacenami_campaign_id && (c.placements ?? []).includes('Banner')
  )
  const activeBannerCampaigns = bannerCampaigns.filter(c => c.status !== 'ended')
  const endedBannerCampaigns  = bannerCampaigns.filter(c => c.status === 'ended')

  const pacenamiResults: Record<string, PacenamiStats | null> = {}
  const pacenamiCompareResults: Record<string, PacenamiStats | null> = {}
  await Promise.all([
    ...activeBannerCampaigns.map(async c => {
      pacenamiResults[c.id] = await fetchPacenamiStats(c.pacenami_campaign_id, ga4Start, ga4End).catch(() => null)
    }),
    ...(selectedCompare ? activeBannerCampaigns.map(async c => {
      pacenamiCompareResults[c.id] = await fetchPacenamiStats(c.pacenami_campaign_id, cmpStart!, cmpEnd!).catch(() => null)
    }) : []),
    ...endedBannerCampaigns.map(async c => {
      const from = c.start_date ?? ga4Start
      const to   = c.end_date   ?? ga4End
      pacenamiResults[c.id] = await fetchPacenamiStats(c.pacenami_campaign_id, from, to).catch(() => null)
    }),
  ])
  function sumPacenami(results: Record<string, PacenamiStats | null>, ids: string[]): PacenamiStats | null {
    return ids.map(id => results[id]).reduce<PacenamiStats | null>((acc, s) => {
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
  const activeIds = activeBannerCampaigns.map(c => c.id)
  const pacenamiTotal = sumPacenami(pacenamiResults, activeIds)
  const pacenamiCompareTotal = selectedCompare ? sumPacenami(pacenamiCompareResults, activeIds) : null

  function pctDelta(current: number, compare: number | undefined | null): string | null {
    if (!compare || compare === 0) return null
    const d = ((current - compare) / compare) * 100
    return (d >= 0 ? '+' : '') + d.toFixed(0) + '%'
  }
  function deltaColor(current: number, compare: number | undefined | null): string {
    if (!compare || compare === 0) return 'var(--muted)'
    return current >= compare ? '#22c55e' : '#ef4444'
  }

  async function addLead(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name  = (formData.get('lead_name') as string).trim()
    const month = (formData.get('lead_month') as string).trim()
    const count = parseInt(formData.get('lead_count') as string, 10)
    await supabase.from('leads').upsert(
      { partner_id: partner.id, month, name, count },
      { onConflict: 'partner_id,month,name' }
    )
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function deleteLead(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const leadId = formData.get('lead_id') as string
    await supabase.from('leads').delete().eq('id', leadId)
    redirect(`/admin/partners/${slug}`)
  }

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

  async function addSubscriptionPeriod(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const start_date = formData.get('sp_start') as string
    const end_date = formData.get('sp_end') as string
    const budgetRaw = (formData.get('sp_budget') as string).replace(/\./g, '').replace(/,/g, '.').trim()
    const budget = budgetRaw ? Number(budgetRaw) : null
    await supabase.from('subscription_periods').insert({ partner_id: partner.id, start_date, end_date, budget })
    // Synkronisér også partner-felterne, så dashboardet viser den nye periode
    await supabase.from('partners').update({ subscription_start: start_date, subscription_end: end_date, subscription_budget: budget }).eq('id', partner.id)
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function deleteSubscriptionPeriod(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const periodId = formData.get('period_id') as string
    await supabase.from('subscription_periods').delete().eq('id', periodId)
    redirect(`/admin/partners/${slug}`)
  }

  async function updateEvents(formData: FormData) {
    'use server'
    const supabase = await createClient()

    function parsePairs(eventsKey: string, aliasesKey: string, groupsKey: string) {
      const evs = formData.getAll(eventsKey)  as string[]
      const als = formData.getAll(aliasesKey) as string[]
      const grs = formData.getAll(groupsKey)  as string[]
      return evs.map((e, i) => ({
        e: e.trim(),
        // Gem gruppe som "gruppe > alias" hvis gruppe er udfyldt
        a: (grs[i] ?? '').trim()
          ? `${(grs[i] ?? '').trim()} > ${(als[i] ?? '').trim()}`
          : (als[i] ?? '').trim(),
      })).filter(p => p.e)
    }

    const p1 = parsePairs('ga4_event_1', 'ga4_alias_1', 'ga4_group_1')
    const p2 = parsePairs('ga4_event_2', 'ga4_alias_2', 'ga4_group_2')
    const p3 = parsePairs('ga4_event_3', 'ga4_alias_3', 'ga4_group_3')
    const p4 = parsePairs('ga4_event_4', 'ga4_alias_4', 'ga4_group_4')
    const p5 = parsePairs('ga4_event_5', 'ga4_alias_5', 'ga4_group_5')

    await supabase.from('partners').update({
      ga4_prop_1_enabled: formData.get('ga4_prop_1_enabled') === 'on',
      ga4_prop_2_enabled: formData.get('ga4_prop_2_enabled') === 'on',
      ga4_prop_3_enabled: formData.get('ga4_prop_3_enabled') === 'on',
      ga4_prop_4_enabled: formData.get('ga4_prop_4_enabled') === 'on',
      ga4_prop_5_enabled: formData.get('ga4_prop_5_enabled') === 'on',
      ga4_events_1:  p1.length ? p1.map(p => p.e).join(',') : null,
      ga4_aliases_1: p1.length ? p1.map(p => p.a).join(',') : null,
      ga4_events_2:  p2.length ? p2.map(p => p.e).join(',') : null,
      ga4_aliases_2: p2.length ? p2.map(p => p.a).join(',') : null,
      ga4_events_3:  p3.length ? p3.map(p => p.e).join(',') : null,
      ga4_aliases_3: p3.length ? p3.map(p => p.a).join(',') : null,
      ga4_events_4:  p4.length ? p4.map(p => p.e).join(',') : null,
      ga4_aliases_4: p4.length ? p4.map(p => p.a).join(',') : null,
      ga4_events_5:  p5.length ? p5.map(p => p.e).join(',') : null,
      ga4_aliases_5: p5.length ? p5.map(p => p.a).join(',') : null,
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
      try {
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
      } catch (_) {
        // upload failed — keep graphic_url as null
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
      subject_pending: formData.get('subject_pending') === 'on',
    })
    revalidatePath('/admin', 'layout')
    redirect(`/admin/partners/${slug}?saved=true`)
  }

  async function deleteCampaign(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const campaignId = formData.get('campaign_id') as string
    await supabase.from('campaigns').delete().eq('id', campaignId)
    revalidatePath('/admin', 'layout')
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
          href={`/p/${partner.access_token}`}
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        >
          Se partnerdashboard →
        </a>
      </div>

      {/* Partner-link */}
      <CopyLinkBox url={`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/p/${partner.access_token}`} />

      <DraggableSections storageKey={`partner-sections-${slug}`}>

      {/* Abonnementsperioder */}
      <div data-section-id="abonnement" data-section-label="Abonnementsperioder">
      <section className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Abonnementsperioder</h2>
        </div>

        {/* Periodeoversigt */}
        {subscriptionPeriods && subscriptionPeriods.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Startdato', 'Slutdato', 'Samlet budget', 'Budget/md', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscriptionPeriods.map((sp, i) => {
                const start = new Date(sp.start_date)
                const end = new Date(sp.end_date)
                const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
                const monthly = sp.budget && months > 0 ? Math.round(sp.budget / months) : null
                const isExpiringSoon = new Date(sp.end_date) <= twoMonthsFromNow && new Date(sp.end_date) >= new Date()
                const isExpired = new Date(sp.end_date) < new Date()
                return (
                  <tr key={sp.id} style={{ borderBottom: i < subscriptionPeriods.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                      {start.toLocaleDateString('da-DK')}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: isExpiringSoon ? '#f59e0b' : isExpired ? 'var(--muted)' : 'var(--foreground)' }}>
                      {end.toLocaleDateString('da-DK')}
                      {isExpiringSoon && <span className="ml-2 text-xs">⚠ Udløber snart</span>}
                    </td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--foreground)' }}>
                      {sp.budget ? `${(sp.budget as number).toLocaleString('da-DK')} kr` : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {monthly ? `${monthly.toLocaleString('da-DK')} kr` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteSubscriptionPeriod}>
                        <input type="hidden" name="period_id" value={sp.id} />
                        <button type="submit" className="text-xs px-2 py-1 rounded" style={{ color: '#ef4444', background: 'transparent' }}>Slet</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* Ingen perioder i tabellen — vis eksisterende partner-data som præ-udfyldt import */
          partner.subscription_start || partner.subscription_end ? (
            <div className="px-6 py-4 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: '#f59e0b', fontSize: '15px', marginTop: '1px' }}>⚠</span>
              <p className="text-xs leading-relaxed" style={{ color: '#f59e0b' }}>
                Der er abonnementsdata i Partnerinfo, som endnu ikke er registreret som en periode.
                Klik "+ Tilføj periode" herunder for at importere den.
              </p>
            </div>
          ) : (
            <p className="px-6 py-5 text-sm" style={{ color: 'var(--muted)' }}>Ingen perioder endnu.</p>
          )
        )}

        {/* Tilføj ny periode — vises kun når ≤ 2 måneder til udløb */}
        {showAddPeriod && (
          <div className="border-t" style={{ borderColor: 'var(--border)' }}>
            {latestPeriod && (
              <div className="px-6 pt-4 flex items-center gap-2">
                <span style={{ color: '#f59e0b', fontSize: '13px' }}>⚠</span>
                <p className="text-xs" style={{ color: '#f59e0b' }}>
                  Nuværende periode udløber {new Date(latestPeriod.end_date).toLocaleDateString('da-DK')} — tilføj en ny herunder.
                </p>
              </div>
            )}
            <form action={addSubscriptionPeriod} className="p-6 space-y-4">
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                {latestPeriod ? 'Tilføj ny abonnementsperiode' : 'Opret første abonnementsperiode'}
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Startdato *</label>
                  <input
                    name="sp_start" type="date" required
                    defaultValue={!latestPeriod && partner.subscription_start ? partner.subscription_start : ''}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slutdato *</label>
                  <input
                    name="sp_end" type="date" required
                    defaultValue={!latestPeriod && partner.subscription_end ? partner.subscription_end : ''}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Samlet budget (kr, ex. moms)</label>
                  <input
                    name="sp_budget" type="text" inputMode="numeric"
                    defaultValue={!latestPeriod && partner.subscription_budget ? partner.subscription_budget.toLocaleString('da-DK') : ''}
                    placeholder="120.000"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
                  + Tilføj periode
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      </div>{/* /abonnement */}

      {/* Faste placeringer */}
      <div data-section-id="faste" data-section-label="Faste placeringer">
      <section className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Faste placeringer ({fixedPlacements?.length ?? 0})
          </h2>
          <AddPlacementModal action={addFixedPlacement} />
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

      </section>

      </div>{/* /faste */}

      {/* Kampagner */}
      <div data-section-id="kampagner" data-section-label="Kampagner">
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Kampagner ({campaigns?.length ?? 0})
          </h2>
          <AddCampaignModal action={addCampaign} />
        </div>
        <CampaignsTable campaigns={campaigns ?? []} slug={slug} deleteCampaign={deleteCampaign} />
      </section>

      </div>{/* /kampagner */}

      {/* Partnerinfo */}
      {/* GA4 Events */}
      <div data-section-id="ga4-config" data-section-label="GA4 Events">
      {(() => {
        const allProps = GA4_PROPS.map(({ key, label }, i) => {
          const id = settings[key] ?? ''
          const enabled = enabledFlags[i] ?? false
          const evRaw = (partnerEvents[i] ?? '').split(',').map((e: string) => e.trim()).filter(Boolean)
          const alRaw = (partnerAliases[i] ?? '').split(',').map((a: string) => a.trim())
          const rows = [
            ...evRaw.map((ev: string, j: number) => {
              const full = alRaw[j] ?? ''
              const sep = full.indexOf(' > ')
              const gr = sep > -1 ? full.slice(0, sep) : ''
              const al = sep > -1 ? full.slice(sep + 3) : full
              return { ev, al, gr }
            }),
            ...Array(Math.max(0, 5 - evRaw.length)).fill({ ev: '', al: '', gr: '' }),
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
                {allProps.filter(p => p.id && p.enabled).map(p => (
                  <div key={p.key}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground)' }}>{p.label}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{p.id}</p>
                    </div>
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                      <div className="grid grid-cols-3" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Teknisk event navn</div>
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>Visningsnavn (hvad partneren ser)</div>
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)', borderLeft: '1px solid var(--border)' }}>
                          Gruppe
                          <span className="ml-1 normal-case font-normal" style={{ color: 'var(--muted)', opacity: 0.6 }}>(sæt samme navn på visninger + klik)</span>
                        </div>
                      </div>
                      {p.rows.map((row: { ev: string; al: string; gr: string }, i: number) => (
                        <div key={i} className="grid grid-cols-3" style={{ borderBottom: i < p.rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                          <div className="px-2 py-1.5" style={{ borderLeft: '1px solid var(--border)' }}>
                            <input
                              name={`ga4_group_${p.idx}`}
                              defaultValue={row.gr}
                              placeholder="fx ejerskifte"
                              className="w-full px-2 py-1 rounded text-xs outline-none"
                              style={{ background: 'transparent', color: 'var(--accent)' }}
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

      </div>{/* /ga4-config */}

      {/* GA4 Stats */}
      {ga4Properties.length > 0 && (
      <div data-section-id="ga4-stats" data-section-label="GA4 statistik">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              GA4 statistik
            </h2>
            <DateRangePicker start={ga4Start} end={ga4End} cmpStart={cmpStart} cmpEnd={cmpEnd} />
          </div>
          {/* Samlet tabel — samme format som partnersiden */}
          {(() => {
            function buildTotals(results: (typeof ga4Results)) {
              const perProp: Record<string, Record<string, number>> = {}
              ga4Properties.forEach(({ label: propLabel, aliases, events: eventsStr }, i) => {
                const events = results[i]
                if (!events || events.length === 0) return
                const aliasList = aliases ? aliases.split(',').map((a: string) => a.trim()) : []
                const eventList = (eventsStr ?? '').split(',').map((e: string) => e.trim())
                const aliasMap = Object.fromEntries(eventList.map((e: string, idx: number) => [e, aliasList[idx] || e]))
                if (!perProp[propLabel]) perProp[propLabel] = {}
                events.forEach(({ eventName, count }: { eventName: string; count: number }) => {
                  const raw = aliasMap[eventName] || eventName
                  const alias = raw.replace(/\s+(iOS|Android)$/i, '').trim()
                  perProp[propLabel][alias] = (perProp[propLabel][alias] ?? 0) + count
                })
              })
              const totals: Record<string, number> = {}
              Object.values(perProp).forEach(propTotals => {
                Object.entries(propTotals).forEach(([alias, count]) => {
                  totals[alias] = (totals[alias] ?? 0) + count
                })
              })
              return { perProp, totals }
            }

            // Byg per-property totals: { propLabel -> { encodedAlias -> count } }
            const perProp: Record<string, Record<string, number>> = {}
            ga4Properties.forEach(({ label: propLabel, aliases, events: eventsStr }, i) => {
              const events = ga4Results[i]
              if (!events || events.length === 0) return
              const aliasList = aliases ? aliases.split(',').map((a: string) => a.trim()) : []
              const eventList = (eventsStr ?? '').split(',').map((e: string) => e.trim())
              const aliasMap = Object.fromEntries(eventList.map((e: string, idx: number) => [e, aliasList[idx] || e]))
              if (!perProp[propLabel]) perProp[propLabel] = {}
              events.forEach(({ eventName, count }: { eventName: string; count: number }) => {
                const raw = aliasMap[eventName] || eventName
                const alias = raw.replace(/\s+(iOS|Android)$/i, '').trim()
                perProp[propLabel][alias] = (perProp[propLabel][alias] ?? 0) + count
              })
            })

            const cmpTotals = ga4CompareResults ? buildTotals(ga4CompareResults).totals : null

            // Samlet total på tværs af alle properties
            const totals: Record<string, number> = {}
            Object.values(perProp).forEach(propTotals => {
              Object.entries(propTotals).forEach(([alias, count]) => {
                totals[alias] = (totals[alias] ?? 0) + count
              })
            })

            if (Object.keys(totals).length === 0) return null

            // Gruppe-logik: { gruppe -> { visninger, kliks } }
            function pairEvents(t: Record<string, number>) {
              const grouped: Record<string, { visninger: number | null; kliks: number | null }> = {}
              for (const [alias, count] of Object.entries(t)) {
                const sep = alias.indexOf(' > ')
                const gruppe  = sep > -1 ? alias.slice(0, sep).trim() : alias
                const display = sep > -1 ? alias.slice(sep + 3).trim() : alias
                const isKlik  = /^klik/i.test(display)
                if (!grouped[gruppe]) grouped[gruppe] = { visninger: null, kliks: null }
                if (isKlik) grouped[gruppe].kliks = (grouped[gruppe].kliks ?? 0) + count
                else grouped[gruppe].visninger = (grouped[gruppe].visninger ?? 0) + count
              }
              return grouped
            }

            const paired = pairEvents(totals)
            const cmpPaired = cmpTotals ? pairEvents(cmpTotals) : null

            // Per-property breakdown per gruppe
            const breakdown: Record<string, { label: string; visninger: number | null; kliks: number | null }[]> = {}
            Object.entries(perProp).forEach(([propLabel, propTotals]) => {
              const propPaired = pairEvents(propTotals)
              Object.entries(propPaired).forEach(([gruppe, vals]) => {
                if (!breakdown[gruppe]) breakdown[gruppe] = []
                breakdown[gruppe].push({ label: propLabel, ...vals })
              })
            })

            const totalVis  = Object.values(paired).reduce((s, p) => s + (p.visninger ?? 0), 0)
            const totalKlik = Object.values(paired).reduce((s, p) => s + (p.kliks ?? 0), 0)
            const cmpTotalVis  = cmpPaired ? Object.values(cmpPaired).reduce((s, p) => s + (p.visninger ?? 0), 0) : null
            const cmpTotalKlik = cmpPaired ? Object.values(cmpPaired).reduce((s, p) => s + (p.kliks ?? 0), 0) : null

            const colW = { vis: '90px', klik: '70px', rate: '70px' }

            return (
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* Kolonneoverskrifter */}
                <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Placering</p>
                  <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    <span style={{ minWidth: colW.vis, textAlign: 'right' }}>Visninger</span>
                    <span style={{ minWidth: colW.klik, textAlign: 'right' }}>Kliks</span>
                    <span style={{ minWidth: colW.rate, textAlign: 'right' }}>Klikrate</span>
                  </div>
                </div>

                {/* Rækker */}
                <div className="px-5">
                  {Object.entries(paired).map(([gruppe, { visninger, kliks }]) => {
                    const klikrate = visninger && kliks && visninger > 0
                      ? ((kliks / visninger) * 100).toFixed(2) : null
                    const cmp = cmpPaired?.[gruppe]
                    const subs = breakdown[gruppe] ?? []
                    const showSubs = subs.length > 1

                    return (
                      <div key={gruppe} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        {/* Hoved-række */}
                        <div className="flex items-center justify-between py-3">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{gruppe}</span>
                          <div className="flex items-center gap-4 tabular-nums">
                            <div className="text-right" style={{ minWidth: colW.vis }}>
                              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                                {visninger != null ? visninger.toLocaleString('da-DK') : '—'}
                              </span>
                              {cmpPaired && cmp && visninger != null && (
                                <div className="text-xs" style={{ color: deltaColor(visninger, cmp.visninger) }}>
                                  {pctDelta(visninger, cmp.visninger)} · {cmp.visninger?.toLocaleString('da-DK') ?? '—'}
                                </div>
                              )}
                            </div>
                            <div className="text-right" style={{ minWidth: colW.klik }}>
                              <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                                {kliks != null ? kliks.toLocaleString('da-DK') : '—'}
                              </span>
                              {cmpPaired && cmp && kliks != null && (
                                <div className="text-xs" style={{ color: deltaColor(kliks, cmp.kliks) }}>
                                  {pctDelta(kliks, cmp.kliks)} · {cmp.kliks?.toLocaleString('da-DK') ?? '—'}
                                </div>
                              )}
                            </div>
                            <span className="text-sm font-bold text-right" style={{ minWidth: colW.rate, color: klikrate ? 'var(--accent)' : 'var(--muted)' }}>
                              {klikrate ? `${klikrate}%` : '—'}
                            </span>
                          </div>
                        </div>
                        {/* Sub-rækker per property */}
                        {showSubs && subs.map(sub => (
                          <div key={sub.label} className="flex items-center justify-between pb-2" style={{ paddingLeft: '16px' }}>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>
                              <span style={{ color: 'var(--border)', marginRight: '4px' }}>↳</span>
                              {sub.label}
                            </span>
                            <div className="flex items-center gap-4 tabular-nums">
                              <span className="text-xs text-right" style={{ minWidth: colW.vis, color: 'var(--muted)' }}>
                                {sub.visninger != null ? sub.visninger.toLocaleString('da-DK') : '—'}
                              </span>
                              <span className="text-xs text-right" style={{ minWidth: colW.klik, color: 'var(--muted)' }}>
                                {sub.kliks != null ? sub.kliks.toLocaleString('da-DK') : '—'}
                              </span>
                              <span className="text-xs text-right" style={{ minWidth: colW.rate, color: 'var(--muted)' }}>—</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className="px-5 py-3 flex items-center justify-between border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Total</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <div className="text-right" style={{ minWidth: colW.vis }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{totalVis.toLocaleString('da-DK')}</span>
                      {cmpTotalVis != null && (
                        <div className="text-xs" style={{ color: deltaColor(totalVis, cmpTotalVis) }}>
                          {pctDelta(totalVis, cmpTotalVis)} · {cmpTotalVis.toLocaleString('da-DK')}
                        </div>
                      )}
                    </div>
                    <div className="text-right" style={{ minWidth: colW.klik }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{totalKlik.toLocaleString('da-DK')}</span>
                      {cmpTotalKlik != null && (
                        <div className="text-xs" style={{ color: deltaColor(totalKlik, cmpTotalKlik) }}>
                          {pctDelta(totalKlik, cmpTotalKlik)} · {cmpTotalKlik.toLocaleString('da-DK')}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold text-right" style={{ minWidth: colW.rate, color: 'var(--accent)' }}>
                      {totalVis > 0 ? `${((totalKlik / totalVis) * 100).toFixed(2)}%` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </section>
      </div>
      )}

      {/* ── Banner statistik (Pacenami) ── */}
      {pacenamiTotal && (
      <div data-section-id="banner-stats" data-section-label="Banner statistik">
        <section className="space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Banner statistik <span className="font-normal text-xs ml-1" style={{ color: 'var(--muted)' }}>(Pacenami — {formatRange(ga4Start, ga4End)})</span>
          </h2>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              { label: 'Served',         cur: pacenamiTotal.served,               cmp: pacenamiCompareTotal?.served,               fmt: (v: number) => v.toLocaleString('da-DK'),      accent: false },
              { label: 'Impressions',    cur: pacenamiTotal.impressions,           cmp: pacenamiCompareTotal?.impressions,           fmt: (v: number) => v.toLocaleString('da-DK'),      accent: true  },
              { label: 'Viewable Impr.', cur: pacenamiTotal.viewable_impressions,  cmp: pacenamiCompareTotal?.viewable_impressions,  fmt: (v: number) => v.toLocaleString('da-DK'),      accent: false },
              { label: 'Viewability',    cur: pacenamiTotal.viewability,           cmp: pacenamiCompareTotal?.viewability,           fmt: (v: number) => `${v.toFixed(2)}%`,             accent: true  },
              { label: 'Kliks',          cur: pacenamiTotal.clicks,               cmp: pacenamiCompareTotal?.clicks,               fmt: (v: number) => v.toLocaleString('da-DK'),      accent: false },
              { label: 'CTR',            cur: pacenamiTotal.ctr,                  cmp: pacenamiCompareTotal?.ctr,                  fmt: (v: number) => `${v.toFixed(2)}%`,             accent: true  },
            ].map(({ label, cur, cmp, fmt, accent }) => (
              <div
                key={label}
                className="rounded-xl p-4 flex flex-col gap-1"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: accent ? 'var(--accent)' : 'var(--foreground)' }}>
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

          {activeBannerCampaigns.length > 1 && (
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
                  {activeBannerCampaigns.map((c, i) => {
                    const s = pacenamiResults[c.id]
                    return (
                      <tr key={c.id} style={{ borderBottom: i < activeBannerCampaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
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

          {endedBannerCampaigns.length > 0 && (
            <details className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <summary className="px-5 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer list-none flex items-center justify-between" style={{ color: 'var(--muted)' }}>
                Afsluttede kampagner ({endedBannerCampaigns.length})
                <span className="text-base leading-none">›</span>
              </summary>
              <div style={{ borderTop: '1px solid var(--border)' }}>
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Kampagne', 'Periode', 'Impressions', 'Viewable', 'Viewability', 'Kliks', 'CTR'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-medium" style={{ color: 'var(--muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {endedBannerCampaigns.map((c, i) => {
                      const s = pacenamiResults[c.id]
                      const from = c.start_date ? new Date(c.start_date).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      const to   = c.end_date   ? new Date(c.end_date).toLocaleDateString('da-DK',   { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                      return (
                        <tr key={c.id} style={{ borderBottom: i < endedBannerCampaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                          <td className="px-4 py-3 text-sm tabular-nums whitespace-nowrap" style={{ color: 'var(--muted)' }}>{from} – {to}</td>
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
            </details>
          )}
        </section>
      </div>
      )}

      {/* Leads */}
      <div data-section-id="leads" data-section-label="Leads">
      <section className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Leads ({leads?.length ?? 0})
          </h2>
          <AddLeadModal action={addLead} />
        </div>

        {leads && leads.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Måned', 'Navn', 'Antal', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const [y, m] = lead.month.split('-').map(Number)
                const label = new Date(y, m - 1, 1).toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
                return (
                  <tr key={lead.id} style={{ borderBottom: i < leads.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3 text-sm capitalize" style={{ color: 'var(--foreground)' }}>{label}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: 'var(--foreground)' }}>{lead.name}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{lead.count.toLocaleString('da-DK')}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={deleteLead} className="inline">
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <button type="submit" className="text-xs px-2 py-1 rounded" style={{ color: '#ef4444', background: 'transparent' }}>Slet</button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="px-6 py-5 text-sm" style={{ color: 'var(--muted)' }}>Ingen leads registreret endnu.</p>
        )}
      </section>
      </div>

      </DraggableSections>

    </div>
  )
}
