import { createClient } from '@/lib/supabase/server'
import { upsertLead, deleteLead } from './actions'

export const dynamic = 'force-dynamic'

const MONTHS_DA = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December']

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name')
    .order('name')

  const { data: leads } = await supabase
    .from('partner_leads')
    .select('id, partner_id, month, lead_count, price, partners(name)')
    .order('month', { ascending: false })

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Leads</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Registrer månedlige leads sendt til partnere
        </p>
      </div>

      {/* Formular */}
      <div className="rounded-xl p-6 mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Tilføj / opdater leads</h2>
        <form action={upsertLead} className="grid grid-cols-2 gap-4">
          {/* Partner */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Partner</label>
            <select
              name="partner_id"
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Vælg partner…</option>
              {(partners ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Måned */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Måned</label>
            <input
              type="month"
              name="month"
              defaultValue={defaultMonth}
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Antal leads */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Antal leads</label>
            <input
              type="number"
              name="lead_count"
              min={0}
              placeholder="0"
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Pris */}
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Pris (kr)</label>
            <input
              type="number"
              name="price"
              min={0}
              step="0.01"
              placeholder="0,00"
              required
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div className="col-span-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Gem
            </button>
          </div>
        </form>
      </div>

      {/* Liste */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Registrerede leads</h2>
        </div>

        {!leads || leads.length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Ingen leads registreret endnu.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Partner', 'Måned', 'Leads', 'Pris', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((l, i) => {
                const partner = (Array.isArray(l.partners) ? l.partners[0] : l.partners) as { name: string } | null
                const d = new Date(l.month)
                const monthLabel = `${MONTHS_DA[d.getUTCMonth()]} ${d.getUTCFullYear()}`
                return (
                  <tr key={l.id} style={{ borderBottom: i < leads.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {partner?.name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>{monthLabel}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>{l.lead_count}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {Number(l.price).toLocaleString('da-DK', { minimumFractionDigits: 2 })} kr
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={deleteLead.bind(null, l.id)}>
                        <button
                          type="submit"
                          className="text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                        >
                          Slet
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
