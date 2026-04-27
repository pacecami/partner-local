import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const MONTHS = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']

const CATEGORIES = [
  'Inapp',
  'Placering på TjekBil',
  'Placeringer på Bilhandel',
  'E-mail & Flows',
]

export default async function NewPlanningEntryPage() {
  const currentYear = new Date().getFullYear()

  async function createEntry(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const category = (formData.get('category') as string).trim()
    const placement = (formData.get('placement') as string).trim()
    const placement_comment = (formData.get('placement_comment') as string).trim() || null
    const sort_order = parseInt(formData.get('sort_order') as string) || 999
    const year = parseInt(formData.get('year') as string) || currentYear

    const monthsData: Record<string, string[]> = {}
    for (let i = 1; i <= 12; i++) {
      const raw = (formData.get(`month_${i}`) as string || '').trim()
      const partners = raw.split(',').map(p => p.trim()).filter(Boolean)
      if (partners.length > 0) {
        monthsData[String(i)] = partners
      }
    }

    await supabase.from('planning_entries').insert({
      category,
      placement,
      placement_comment,
      sort_order,
      year,
      months: monthsData,
    })

    redirect('/admin/overblik?saved=true')
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <a href="/admin/overblik" className="text-sm" style={{ color: 'var(--muted)' }}>
          ← Overblik
        </a>
        <h1 className="text-2xl font-bold mt-2" style={{ color: 'var(--foreground)' }}>
          Tilføj placering
        </h1>
      </div>

      <section className="rounded-xl p-6 space-y-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <form action={createEntry} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kategori *</label>
              <input
                name="category"
                required
                list="categories"
                placeholder="fx Placering på TjekBil"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
              <datalist id="categories">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Placering *</label>
              <input
                name="placement"
                required
                placeholder="fx VIP Banner"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Kommentar</label>
              <input
                name="placement_comment"
                placeholder="fx Max 3 partnere, Alle biler..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>År</label>
                <input
                  name="year"
                  type="number"
                  defaultValue={currentYear}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Rækkefølge</label>
                <input
                  name="sort_order"
                  type="number"
                  defaultValue={999}
                  placeholder="999"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Måneder */}
          <div className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold mb-4" style={{ color: 'var(--muted)' }}>
              Partnere per måned <span className="font-normal">(kommasepareret, fx: Motorstyrelsen, DAH)</span>
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {MONTHS.map((month, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>{month}</label>
                  <input
                    name={`month_${i + 1}`}
                    placeholder="—"
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Tilføj placering
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
