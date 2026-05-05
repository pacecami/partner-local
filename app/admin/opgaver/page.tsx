import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OpgaverPage() {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, start_date, placements, partners(name, slug)')
    .eq('subject_pending', true)
    .order('start_date', { ascending: true })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Opgaver <span className="text-red-500">✱</span>
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Kampagner hvor emnet endnu ikke er fastlagt
        </p>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Ingen opgaver!</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Alle kampagner har et fastlagt emne.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Partner', 'Kampagne', 'Startdato', 'Placeringer', ''].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const partner = (Array.isArray(c.partners) ? c.partners[0] : c.partners) as { name: string; slug: string } | null
                return (
                  <tr key={c.id} style={{ borderBottom: i < campaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {partner?.name ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {c.name} <span className="text-red-500 font-bold">✱</span>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: 'var(--muted)' }}>
                      {c.start_date ? new Date(c.start_date + 'T00:00:00').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(c.placements ?? []).map((p: string) => (
                          <span key={p} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {partner && (
                        <a
                          href={`/admin/partners/${partner.slug}`}
                          className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                          style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                        >
                          Åbn partner
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
