import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default async function AdminPage() {
  const supabase = getServiceClient()

  const [{ data: partners }, { data: campaigns }, { data: fixedPlacements }] = await Promise.all([
    supabase.from('partners').select('id,name,slug,created_at,subscription_budget,subscription_start,subscription_end').order('name'),
    supabase.from('campaigns').select('id,partner_id,name,status,start_date,end_date,monthly_budget').order('start_date', { ascending: false }),
    supabase.from('fixed_placements').select('id,partner_id'),
  ])

  const partnersWithCampaigns = (partners ?? []).map((p: any) => ({
    ...p,
    campaigns: (campaigns ?? []).filter((c: any) => c.partner_id === p.id),
    fixedCount: (fixedPlacements ?? []).filter((fp: any) => fp.partner_id === p.id).length,
  }))

  const activeCampaigns = (campaigns ?? []).filter((c: any) => c.status === 'active')
  const totalActive = activeCampaigns.length + (fixedPlacements ?? []).length
  const totalCampaignBudget = activeCampaigns.reduce((sum: number, c: any) => sum + (c.monthly_budget ?? 0), 0)
  const totalSubBudget = (partners ?? []).reduce((sum: number, p: any) => {
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
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{partners?.length ?? 0} total</p>
        </div>
        <Link href="/admin/partners/new" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
          + Ny partner
        </Link>
      </div>

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

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Alle partnere</h2>
        </div>
        {partnersWithCampaigns.length === 0 ? (
          <div className="px-6 py-12 text-center" style={{ color: 'var(--muted)' }}>
            <p className="text-sm">Ingen partnere endnu.</p>
            <a href="/admin/partners/new" className="text-sm mt-2 inline-block" style={{ color: 'var(--accent)' }}>Opret den første partner →</a>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Partner', 'Aktive', 'Budget/md', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partnersWithCampaigns.map((p: any, i: number) => {
                const active = p.campaigns.filter((c: any) => c.status === 'active')
                const activeCount = active.length + p.fixedCount
                const campaignBudget = active.reduce((s: number, c: any) => s + (c.monthly_budget ?? 0), 0)
                let subMonthly = 0
                if (p.subscription_start && p.subscription_end && p.subscription_budget) {
                  const start = new Date(p.subscription_start)
                  const end = new Date(p.subscription_end)
                  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
                  subMonthly = months > 0 ? Math.round(p.subscription_budget / months) : 0
                }
                const budget = campaignBudget + subMonthly
                return (
                  <tr key={p.id} style={{ borderBottom: i < partnersWithCampaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-6 py-4"><span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{p.name}</span></td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--green)' }}>{activeCount}</td>
                    <td className="px-6 py-4 text-sm" style={{ color: 'var(--foreground)' }}>{budget > 0 ? `${budget.toLocaleString('da-DK')} kr` : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/admin/partners/${p.slug}`} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>Åbn</Link>
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
