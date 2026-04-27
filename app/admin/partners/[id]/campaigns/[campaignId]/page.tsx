import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const PLACEMENTS = ['Inapp', 'Nyhedsbreve', 'Tilbudsmail', 'Banner', 'Placeringer på TjekBil', 'Placeringer på Bilhandel']

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>
}) {
  const { id: slug, campaignId } = await params
  const supabase = await createClient()

  const { data: partner } = await supabase
    .from('partners')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!partner) redirect('/admin')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('partner_id', partner.id)
    .single()

  if (!campaign) redirect(`/admin/partners/${slug}`)

  async function updateCampaign(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('name') as string).trim()
    const status = formData.get('status') as string
    const start_date = formData.get('start_date') as string || null
    const end_date = formData.get('end_date') as string || null
    const budgetRaw = (formData.get('monthly_budget') as string).replace(/\./g, '').replace(/,/g, '.').trim()
    const monthly_budget = budgetRaw ? Number(budgetRaw) : null
    const placements = formData.getAll('placements') as string[]
    const impressionsRaw = (formData.get('impressions') as string || '').replace(/\./g, '').trim()
    const clicksRaw = (formData.get('clicks') as string || '').replace(/\./g, '').trim()
    const impressions = impressionsRaw ? parseInt(impressionsRaw) : null
    const clicks = clicksRaw ? parseInt(clicksRaw) : null
    const emailsSentRaw = (formData.get('emails_sent') as string || '').replace(/\./g, '').trim()
    const emailsOpenedRaw = (formData.get('emails_opened') as string || '').replace(/\./g, '').trim()
    const clicksToAdvertiserRaw = (formData.get('clicks_to_advertiser') as string || '').replace(/\./g, '').trim()
    const emails_sent = emailsSentRaw ? parseInt(emailsSentRaw) : null
    const emails_opened = emailsOpenedRaw ? parseInt(emailsOpenedRaw) : null
    const clicks_to_advertiser = clicksToAdvertiserRaw ? parseInt(clicksToAdvertiserRaw) : null
    const pacenamiRaw = (formData.get('pacenami_campaign_id') as string || '').trim()
    const pacenami_campaign_id = pacenamiRaw || null
    const pacenami_report_url = (formData.get('pacenami_report_url') as string || '').trim() || null

    const graphicFile = formData.get('graphic') as File | null
    let graphic_url = campaign.graphic_url
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

    await supabase
      .from('campaigns')
      .update({ name, status, start_date, end_date, monthly_budget, placements, graphic_url, impressions, clicks, emails_sent, emails_opened, clicks_to_advertiser, pacenami_campaign_id, pacenami_report_url })
      .eq('id', campaignId)

    redirect(`/admin/partners/${slug}?saved=true`)
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <a href={`/admin/partners/${slug}`} className="text-sm" style={{ color: 'var(--muted)' }}>
          ← {partner.name}
        </a>
        <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>
          Rediger kampagne
        </h1>
      </div>

      <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <form action={updateCampaign} className="space-y-4" encType="multipart/form-data">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kampagnenavn *</label>
              <input name="name" required defaultValue={campaign.name} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Status</label>
              <select name="status" defaultValue={campaign.status} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="planned">Planlagt</option>
                <option value="active">Aktiv</option>
                <option value="ended">Afsluttet</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Budget/md (kr)</label>
              <input name="monthly_budget" type="text" inputMode="numeric" defaultValue={campaign.monthly_budget ? campaign.monthly_budget.toLocaleString('da-DK') : ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Startdato</label>
              <input name="start_date" type="date" defaultValue={campaign.start_date ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slutdato</label>
              <input name="end_date" type="date" defaultValue={campaign.end_date ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Pacenami Campaign ID <span className="font-normal">(til automatisk banner-statistik)</span>
              </label>
              <input
                name="pacenami_campaign_id"
                type="text"
                defaultValue={campaign.pacenami_campaign_id ?? ''}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                style={inputStyle}
              />
            </div>
            {(campaign.placements ?? []).includes('Banner') && (
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                  Link til fuld Pacenami-rapport <span className="font-normal">(vises som knap hos partneren)</span>
                </label>
                <input
                  name="pacenami_report_url"
                  type="url"
                  defaultValue={campaign.pacenami_report_url ?? ''}
                  placeholder="https://pacenami.pace.dk/..."
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Grafik (PNG){campaign.graphic_url ? ' — upload ny for at erstatte' : ''}
              </label>
              {campaign.graphic_url && (
                <img src={campaign.graphic_url} alt="" className="mb-2 h-16 rounded object-cover" />
              )}
              <input name="graphic" type="file" accept="image/png,image/jpeg" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Placeringer</label>
              <div className="flex flex-wrap gap-2">
                {PLACEMENTS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                    <input
                      type="checkbox"
                      name="placements"
                      value={p}
                      defaultChecked={(campaign.placements ?? []).includes(p)}
                      className="accent-yellow-400"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                Performance — E-mail <span className="font-normal">(Nyhedsbreve / Tilbudsmail)</span>
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Antal sendte</label>
                  <input name="emails_sent" type="text" inputMode="numeric" defaultValue={campaign.emails_sent ? campaign.emails_sent.toLocaleString('da-DK') : ''} placeholder="fx 12.500" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Åbninger <span className="font-normal">(åbningsrate auto)</span></label>
                  <input name="emails_opened" type="text" inputMode="numeric" defaultValue={campaign.emails_opened ? campaign.emails_opened.toLocaleString('da-DK') : ''} placeholder="fx 3.800" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kliks til annoncør</label>
                  <input name="clicks_to_advertiser" type="text" inputMode="numeric" defaultValue={campaign.clicks_to_advertiser ? campaign.clicks_to_advertiser.toLocaleString('da-DK') : ''} placeholder="fx 210" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
            <div className="col-span-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted)' }}>
                Performance — Visninger <span className="font-normal">(Banner / Inapp)</span>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Visninger</label>
                  <input name="impressions" type="text" inputMode="numeric" defaultValue={campaign.impressions ? campaign.impressions.toLocaleString('da-DK') : ''} placeholder="fx 4.012" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kliks <span className="font-normal">(klikrate auto)</span></label>
                  <input name="clicks" type="text" inputMode="numeric" defaultValue={campaign.clicks ? campaign.clicks.toLocaleString('da-DK') : ''} placeholder="fx 315" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
              Gem ændringer
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
