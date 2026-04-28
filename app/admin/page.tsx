import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name, slug, created_at, subscription_budget, subscription_start, subscription_end')
    .order('name')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, partner_id, name, status, start_date, end_date, monthly_budget')
    .order('start_date', { ascending: false })

  const { data: fixedPlacements } = await supabase
    .from('fixed_placements')
    .select('id, partner_id')

  const partnersWithCampaigns = (partners ?? []).map(p => ({
    ...p,
    campaigns: (campaigns ?? []).filter(c => c.partner_id === p.id),
    fixedCount: (fixedPlacements ?? []).filter(fp => fp.partner_id === p.id).length,
  }))

  const activeCampaigns = (campaigns ?? []).filter(c => c.status === 'active')
  const totalActive = activeCampaigns.length + (fixedPlacements ?? []).length
  const totalCampaignBudget = activeCampaigns.reduce((sum, c) => sum + (c.monthly_budget ?? 0), 0)
  const totalSubBudget = (partners ?? []).reduce((sum, p: any) => {
    if (!p.subscription_start || !p.subscription_end || !p.subscription_budget) return sum
    const start = new Date(p.subscription_start)
    const end = new Date(p.subscription_end)
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
    return sum + (months > 0 ? Math.round(p.subscription_budget / months) : 0)
  }, 0)
  const totalBudget = totalCampaignBudget + totalSubBudget

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Partnere</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {partners?.length ?? 0} total
          </p>
        </div>
        <a
          href="/admin/partners/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          + Ny partner
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Aktive kampagner</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--green)' }}>{totalActive}</p>
        </div>
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Samlet budget/md</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
            {totalBudget > 0 ? `${totalBudget.toLocaleString('da-DK')} kr` : '—'}
          </p>
        </div>
      </div>

      {/* Partners table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Alle partnere</h2>
        </div>

        {partnersWithCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Ingen partnere endnu.</p>
            <a href="/admin/partners/new" className="text-sm mt-2 inline-block" style={{ color: 'var(--accent)' }}>
              Opret den første partner →
            </a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Partner', 'Kampagner', 'Aktive', 'Budget/md', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partnersWithCampaigns.map((p, i) => {
                const active = p.campaigns.filter(c => c.status === 'active')
                const activeCount = active.length + p.fixedCount
                const campaignBudget = active.reduce((s, c) => s + (c.monthly_budget ?? 0), 0)

                // Abonnement/md — samme beregning som på partner-siden
                let subMonthly = 0
                if (p.subscription_start && p.subscription_end && p.subscription_budget) {
                  const start = new Date(p.subscription_start)
                  const end = new Date(p.subscription_end)
                  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
                  subMonthly = months > 0 ? Math.round(p.subscription_budget / months) : 0
                }

                const budget = campaignBudget + subMonthly
                return (
                  <tr
                    key={p.id}
                    style={{ borderBottom: i < partnersWithCampaigns.length - 1 ? '1px solid var(--border)' : 'none' }}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{p.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--muted)' }}>{p.campaigns.length}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--green)' }}>{activeCount}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>
                      {budget > 0 ? `${budget.toLocaleString('da-DK')} kr` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <a
                        href={`/admin/partners/${p.slug}`}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                      >
                        Åbn
                      </a>
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
