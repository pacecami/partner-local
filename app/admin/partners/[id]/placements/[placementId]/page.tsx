import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EditPlacementPage({
  params,
}: {
  params: Promise<{ id: string; placementId: string }>
}) {
  const { id: slug, placementId } = await params
  const supabase = await createClient()

  const { data: partner } = await supabase
    .from('partners')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!partner) redirect('/admin')

  const { data: placement } = await supabase
    .from('fixed_placements')
    .select('*')
    .eq('id', placementId)
    .eq('partner_id', partner.id)
    .single()

  if (!placement) redirect(`/admin/partners/${slug}`)

  async function updatePlacement(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const name = (formData.get('name') as string).trim()
    const url = (formData.get('url') as string).trim() || null

    const imageFile = formData.get('image') as File | null
    let image_url = placement.image_url
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

    const site = (formData.get('site') as string).trim() || null

    await supabase
      .from('fixed_placements')
      .update({ name, url, image_url, site })
      .eq('id', placementId)

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
          Rediger fast placering
        </h1>
      </div>

      <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <form action={updatePlacement} className="space-y-4" encType="multipart/form-data">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Navn *</label>
              <input
                name="name"
                required
                defaultValue={placement.name}
                placeholder="fx Forsikring & finansiering — banner"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Site</label>
              <select name="site" defaultValue={placement.site ?? ''} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle}>
                <option value="">— Vælg site —</option>
                <option value="Bilhandel">Bilhandel</option>
                <option value="TjekBil">TjekBil</option>
                <option value="TjekBilsyn">TjekBilsyn</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>URL (linker til)</label>
              <input
                name="url"
                type="url"
                defaultValue={placement.url ?? ''}
                placeholder="https://www.eksempel.dk/side"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Billede{placement.image_url ? ' — upload nyt for at erstatte' : ''}
              </label>
              {placement.image_url && (
                <img
                  src={placement.image_url}
                  alt={placement.name}
                  className="mb-3 rounded-lg object-cover"
                  style={{ maxHeight: '200px', maxWidth: '100%' }}
                />
              )}
              <input
                name="image"
                type="file"
                accept="image/*"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <a
              href={`/admin/partners/${slug}`}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              Annuller
            </a>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Gem ændringer
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
