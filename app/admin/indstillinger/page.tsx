import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function IndstillingerPage() {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name, slug, ga4_property_id, ga4_property_id_2, ga4_property_id_3')
    .order('name')

  async function saveGa4(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const partnerId = formData.get('partner_id') as string
    await supabase
      .from('partners')
      .update({
        ga4_property_id:   (formData.get('ga4_property_id')   as string).trim() || null,
        ga4_property_id_2: (formData.get('ga4_property_id_2') as string).trim() || null,
        ga4_property_id_3: (formData.get('ga4_property_id_3') as string).trim() || null,
      })
      .eq('id', partnerId)
    redirect('/admin/indstillinger')
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Indstillinger</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          GA4 property-konfiguration per partner
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>GA4 Properties</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Property 1 = TjekBil web &middot; Property 2 = TjekBil app &middot; Property 3 = Bilhandel
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {(partners ?? []).map(p => (
            <form key={p.id} action={saveGa4} className="px-6 py-5">
              <input type="hidden" name="partner_id" value={p.id} />
              <div className="flex items-end gap-4">
                <div className="w-40 shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{p.name}</p>
                  <a
                    href={`/admin/partners/${p.slug}`}
                    className="text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    Se partner →
                  </a>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                      TjekBil web
                    </label>
                    <input
                      name="ga4_property_id"
                      defaultValue={p.ga4_property_id ?? ''}
                      placeholder="properties/xxxxxxx"
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                      TjekBil app
                    </label>
                    <input
                      name="ga4_property_id_2"
                      defaultValue={p.ga4_property_id_2 ?? ''}
                      placeholder="properties/xxxxxxx"
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                      Bilhandel
                    </label>
                    <input
                      name="ga4_property_id_3"
                      defaultValue={p.ga4_property_id_3 ?? ''}
                      placeholder="properties/xxxxxxx"
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none font-mono"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="shrink-0">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: 'var(--accent)', color: '#000' }}
                  >
                    Gem
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
