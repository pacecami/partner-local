const BASE_URL = 'https://pacenami.pace.dk'

export interface PacenamiStats {
  served: number
  impressions: number
  viewable_impressions: number
  viewability: number   // procent, fx 57.07
  clicks: number
  ctr: number           // procent, fx 0.10
}

// ─── Hent statistik for én kampagne i en periode ───────────────────────────
export async function fetchPacenamiStats(
  pacenamiCampaignId: string,
  from: string,  // YYYY-MM-DD
  to: string,    // YYYY-MM-DD
): Promise<PacenamiStats | null> {
  const apiKey = process.env.PACENAMI_API_KEY
  if (!apiKey) return null

  const headers: Record<string, string> = {
    'X-ApiKey': apiKey,
  }

  try {
    const [statsRes, clicksRes, viewRes] = await Promise.all([
      fetch(
        `${BASE_URL}/functions/v1/app/campaigns/${pacenamiCampaignId}/daily-stats?from=${from}&to=${to}&limit=1000`,
        { headers, cache: 'no-store' }
      ),
      fetch(
        `${BASE_URL}/functions/v1/app/campaigns/${pacenamiCampaignId}/daily-clicks?from=${from}&to=${to}&limit=1000`,
        { headers, cache: 'no-store' }
      ),
      fetch(
        `${BASE_URL}/functions/v1/app/campaigns/${pacenamiCampaignId}/viewability?from=${from}&to=${to}`,
        { headers, cache: 'no-store' }
      ),
    ])

    if (!statsRes.ok || !clicksRes.ok || !viewRes.ok) return null

    const [statsData, clicksData, viewData] = await Promise.all([
      statsRes.json(),
      clicksRes.json(),
      viewRes.json(),
    ])

    // daily-stats: summer impression_count og script_served_count på tværs af dage + placeringer
    const statRows: any[] = Array.isArray(statsData) ? statsData : (statsData.data ?? statsData.rows ?? [])
    const clickRows: any[] = Array.isArray(clicksData) ? clicksData : (clicksData.data ?? clicksData.rows ?? [])
    const viewRows: any[] = Array.isArray(viewData) ? viewData : (viewData.data ?? viewData.rows ?? [])

    const impressions = statRows.reduce((s: number, r: any) => s + (r.impression_count ?? 0), 0)
    const served = statRows.reduce((s: number, r: any) => s + (r.script_served_count ?? 0), 0)
    const clicks = clickRows.reduce((s: number, r: any) => s + (r.click_count ?? 0), 0)

    // viewability: summer på tværs af placement + device — beregn % fra totaler
    const viewable_impressions = viewRows.reduce((s: number, r: any) => s + (r.viewable_impressions ?? 0), 0)
    const totalImpressionsForViewability = viewRows.reduce((s: number, r: any) => s + (r.impressions ?? 0), 0)
    const viewability = totalImpressionsForViewability > 0
      ? (viewable_impressions / totalImpressionsForViewability) * 100
      : 0

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

    return {
      served,
      impressions,
      viewable_impressions,
      viewability: Math.round(viewability * 100) / 100,
      clicks,
      ctr: Math.round(ctr * 10000) / 10000,
    }
  } catch (e) {
    console.error('Pacenami fetch fejl:', e)
    return null
  }
}
