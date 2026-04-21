import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default function NewPartnerPage() {
  async function createPartner(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('name') as string).trim()
    const slug = (formData.get('slug') as string).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const ga4_1 = (formData.get('ga4_property_id') as string).trim()
    const ga4_2 = (formData.get('ga4_property_id_2') as string).trim()
    const ga4_3 = (formData.get('ga4_property_id_3') as string).trim()

    const { data, error } = await supabase
      .from('partners')
      .insert({ name, slug, ga4_property_id: ga4_1 || null, ga4_property_id_2: ga4_2 || null, ga4_property_id_3: ga4_3 || null })
      .select('slug')
      .single()

    if (error || !data) redirect('/admin')
    redirect(`/admin/partners/${data.slug}`)
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <a href="/admin" className="text-sm" style={{ color: 'var(--muted)' }}>
          ← Tilbage til oversigt
        </a>
        <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>
          Ny partner
        </h1>
      </div>

      <form
        action={createPartner}
        className="rounded-xl p-6 space-y-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            Partnernavn *
          </label>
          <input
            name="name"
            required
            placeholder="fx Motorstyrelsen"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            URL-slug *{' '}
            <span className="font-normal" style={{ color: 'var(--muted)' }}>(bruges i URL'en)</span>
          </label>
          <input
            name="slug"
            required
            placeholder="fx motorstyrelsen"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            Kun små bogstaver, tal og bindestreger. fx: dansk-auto-hjaelp
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            GA4 Property ID 1{' '}
            <span className="font-normal" style={{ color: 'var(--muted)' }}>(valgfri)</span>
          </label>
          <input
            name="ga4_property_id"
            placeholder="123456789"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            GA4 Property ID 2{' '}
            <span className="font-normal" style={{ color: 'var(--muted)' }}>(valgfri)</span>
          </label>
          <input
            name="ga4_property_id_2"
            placeholder="123456789"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
            GA4 Property ID 3{' '}
            <span className="font-normal" style={{ color: 'var(--muted)' }}>(valgfri)</span>
          </label>
          <input
            name="ga4_property_id_3"
            placeholder="123456789"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={inputStyle}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            Find dem i GA4 → Admin → Property settings
          </p>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg font-semibold text-sm"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          Opret partner
        </button>
      </form>
    </div>
  )
}
