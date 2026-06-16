'use client'

import { useState } from 'react'

interface Campaign {
  id: string
  name: string
  status: string
  start_date?: string | null
  end_date?: string | null
  monthly_budget?: number | null
  placements?: string[] | null
  graphic_url?: string | null
  subject_pending?: boolean | null
  impressions?: number | null
  clicks?: number | null
  emails_sent?: number | null
  emails_opened?: number | null
  clicks_to_advertiser?: number | null
  pacenami_report_url?: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:  { label: 'Aktiv',     color: '#22c55e' },
    planned: { label: 'Planlagt',  color: '#f5d000' },
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

function CampaignRows({
  campaigns,
  slug,
  deleteCampaign,
  dimmed = false,
}: {
  campaigns: Campaign[]
  slug: string
  deleteCampaign: (fd: FormData) => Promise<void>
  dimmed?: boolean
}) {
  return (
    <>
      {campaigns.map((c, i) => {
        const hasPerf = c.impressions != null || c.clicks != null || c.emails_sent != null || c.emails_opened != null || c.clicks_to_advertiser != null
        const placements: string[] = c.placements ?? []
        const isEmail = placements.some(p => p === 'Nyhedsbreve' || p === 'Tilbudsmail')
        const isBanner = placements.includes('Banner')
        const isInapp = placements.includes('Inapp')
        const isVisual = isBanner || isInapp
        const showVisual = isVisual || (!isEmail && (c.impressions != null || c.clicks != null))

        return (
          <tbody key={c.id} style={{ opacity: dimmed ? 0.55 : 1 }}>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td className="pl-4 pr-2 py-3">
                {c.graphic_url ? (
                  <img src={c.graphic_url} alt="" className="w-10 h-7 object-cover rounded" />
                ) : (
                  <div className="w-10 h-7 rounded flex items-center justify-center text-xs" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>—</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</span>
                {c.subject_pending && <span className="ml-1.5 text-red-500 font-bold text-sm">✱</span>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {placements.map(p => (
                    <span key={p} className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>{p}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                {c.start_date ? `${c.start_date.slice(5,7)}-${c.start_date.slice(0,4)}${c.end_date ? ` → ${c.end_date.slice(5,7)}-${c.end_date.slice(0,4)}` : ''}` : '—'}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--foreground)' }}>
                {c.monthly_budget ? `${c.monthly_budget.toLocaleString('da-DK')} kr` : '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={`/admin/partners/${slug}/campaigns/${c.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap"
                    style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                  >
                    Rediger
                  </a>
                  <form action={deleteCampaign} className="inline">
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <button type="submit" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>Slet</button>
                  </form>
                </div>
              </td>
            </tr>
            {hasPerf && (
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td />
                <td colSpan={6} className="px-4 pb-3">
                  <div className="flex flex-wrap gap-5">
                    {isEmail && (
                      <>
                        {c.emails_sent != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Sendte</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.emails_sent as number).toLocaleString('da-DK')}</span>
                          </div>
                        )}
                        {c.emails_sent != null && c.emails_opened != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Åbningsrate</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{((c.emails_opened / c.emails_sent) * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {c.clicks_to_advertiser != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks til annoncør</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks_to_advertiser as number).toLocaleString('da-DK')}</span>
                          </div>
                        )}
                      </>
                    )}
                    {isBanner && c.pacenami_report_url && (
                      <a
                        href={c.pacenami_report_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: 'var(--accent)', color: '#000' }}
                      >
                        Se fuld rapport →
                      </a>
                    )}
                    {showVisual && (
                      <>
                        {c.impressions != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Visninger</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.impressions as number).toLocaleString('da-DK')}</span>
                          </div>
                        )}
                        {c.clicks != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>Kliks</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{(c.clicks as number).toLocaleString('da-DK')}</span>
                          </div>
                        )}
                        {c.impressions != null && c.clicks != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>{isBanner ? 'Klikrate' : 'CTR'}</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{((c.clicks / c.impressions) * 100).toFixed(1)}%</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        )
      })}
    </>
  )
}

export default function CampaignsTable({
  campaigns,
  slug,
  deleteCampaign,
}: {
  campaigns: Campaign[]
  slug: string
  deleteCampaign: (fd: FormData) => Promise<void>
}) {
  const [endedOpen, setEndedOpen] = useState(false)

  const active = campaigns.filter(c => c.status !== 'ended')
  const ended  = campaigns.filter(c => c.status === 'ended')

  if (campaigns.length === 0) {
    return <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Ingen kampagner endnu.</div>
  }

  return (
    <table className="w-full">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)' }}>
          {['Grafik', 'Navn', 'Placeringer', 'Status', 'Periode', 'Budget/md', ''].map(h => (
            <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{h}</th>
          ))}
        </tr>
      </thead>

      {/* Aktive + planlagte */}
      <CampaignRows campaigns={active} slug={slug} deleteCampaign={deleteCampaign} />

      {/* Afsluttede — sammenfoldelig */}
      {ended.length > 0 && (
        <>
          <tbody>
            <tr
              className="cursor-pointer select-none"
              onClick={() => setEndedOpen(o => !o)}
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <td colSpan={7} className="px-4 py-2.5">
                <span className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
                  <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: endedOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  Afsluttede ({ended.length})
                </span>
              </td>
            </tr>
          </tbody>
          {endedOpen && (
            <CampaignRows campaigns={ended} slug={slug} deleteCampaign={deleteCampaign} dimmed />
          )}
        </>
      )}
    </table>
  )
}
