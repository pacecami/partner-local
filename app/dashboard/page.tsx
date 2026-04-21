import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:  { label: 'Aktiv',    color: '#22c55e' },
    planned: { label: 'Planlagt', color: '#f5d000' },
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('partner_id, partners(name)')
    .eq('id', user.id)
    .single()

  if (!profile?.partner_id) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Din konto er ikke tilknyttet en partner endnu. Kontakt HeyMate.
        </p>
      </div>
    )
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('partner_id', profile.partner_id)
    .order('start_date', { ascending: false })

  const partnersField = profile.partners
  const partnerName = (Array.isArray(partnersField) ? partnersField[0] : partnersField as { name: string } | null)?.name ?? 'Partner'
  const active = (campaigns ?? []).filter(c => c.status === 'active')
  const totalBudget = active.reduce((s, c) => s + (c.monthly_budget ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{partnerName}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Kampagneoversigt</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Aktive kampagner</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--green)' }}>{active.length}</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Budget/md</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
            {totalBudget >= 1000 ? `${Math.round(totalBudget / 1000)}k` : totalBudget > 0 ? totalBudget : '—'}
          </p>
        </div>
      </div>

      {/* Campaigns */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Kampagner</h2>
        </div>

        {(campaigns ?? []).length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Ingen kampagner endnu.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Kampagne', 'Status', 'Periode', 'Budget/md'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(campaigns ?? []).map((c, i) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: i < (campaigns ?? []).length - 1 ? '1px solid var(--border)' : 'none' }}
                >
                  <td className="px-6 py-4 font-medium text-sm" style={{ color: 'var(--foreground)' }}>{c.name}</td>
                  <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--muted)' }}>
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>
                    {c.monthly_budget ? (c.monthly_budget >= 1000 ? `${Math.round(c.monthly_budget / 1000)}k` : c.monthly_budget) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
