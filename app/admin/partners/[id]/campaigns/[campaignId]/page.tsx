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
      .update({ name, status, start_date, end_date, monthly_budget, placements, graphic_url })
      .eq('id', campaignId)

    redirect(`/admin/partners/${slug}`)
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
