const BASE_URL = 'https://pacenami.pace.dk'

export interface PacenamiStats {
  served: number
  impressions: number
  viewable_impressions: number
  viewability: number   // procent, fx 57.07
  clicks: number
  ctr: number           // procent, fx 0.10
}

// ─── Auth ──────────────────────────────────────────────────────────────────
let _cachedToken: string | null = null
let _tokenExpiry: number = 0

async function getToken(): Promise<string | null> {
  const username = process.env.PACENAMI_USERNAME
  const password = process.env.PACENAMI_PASSWORD
  const apiKey   = process.env.PACENAMI_API_KEY
  if (!username || !password || !apiKey) return null

  // Genbrug token hvis stadig gyldig (5 min buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 5 * 60 * 1000) {
    return _cachedToken
  }

  const res = await fetch(`${BASE_URL}/functions/v1/app/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-ApiKey': apiKey,
    },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  })
  if (!res.ok) return null

  const data = await res.json()
  // Prøv de mest almindelige token-felter
  _cachedToken = data.token ?? data.accessToken ?? data.access_token ?? null
  // Antag 1 times gyldighed hvis expires_in ikke er angivet
  const expiresIn = (data.expires_in ?? data.expiresIn ?? 3600) as number
  _tokenExpiry = Date.now() + expiresIn * 1000

  return _cachedToken
}

// ─── Hent statistik for én kampagne i en periode ───────────────────────────
export async function fetchPacenamiStats(
  pacenamiCampaignId: string,
  from: string,  // YYYY-MM-DD
  to: string,    // YYYY-MM-DD
): Promise<PacenamiStats | null> {
  const apiKey = process.env.PACENAMI_API_KEY
  const token  = await getToken()
  if (!token || !apiKey) return null

  const headers: Record<string, string> = {
    'X-ApiKey': apiKey,
    'Authorization': `Bearer ${token}`,
  }

  try {
    const [statsRes, clicksRes, viewRes] = await Promise.all([
      fetch(
        `${BASE_URL}/functions/v1/app/campaigns/${pacenamiCampaignId}/daily-stats?from=${from}&to=${to}&limit=100`,
        { headers, cache: 'no-store' }
      ),
      fetch(
        `${BASE_URL}/functions/v1/app/campaigns/${pacenamiCampaignId}/daily-clicks?from=${from}&to=${to}&limit=100`,
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

    // daily-stats: summer impressions og served på tværs af dage
    // Forventet format: [{ date, impressions, served, ... }] eller { data: [...] }
    const statRows: any[] = Array.isArray(statsData)
      ? statsData
      : (statsData.data ?? statsData.rows ?? [])

    const clickRows: any[] = Array.isArray(clicksData)
      ? clicksData
      : (clicksData.data ?? clicksData.rows ?? [])

    const impressions = statRows.reduce((s: number, r: any) =>
      s + (r.impressions ?? r.impression_count ?? 0), 0)
    const served = statRows.reduce((s: number, r: any) =>
      s + (r.served ?? r.served_count ?? 0), 0)
    const clicks = clickRows.reduce((s: number, r: any) =>
      s + (r.clicks ?? r.click_count ?? 0), 0)

    // viewability: kan være { viewable_impressions, viewability } eller array
    const viewRow = Array.isArray(viewData) ? viewData[0] : viewData
    const viewable_impressions: number =
      viewRow?.viewable_impressions ?? viewRow?.viewable ?? 0
    const viewability: number =
      viewRow?.viewability ?? viewRow?.viewability_rate ??
      (impressions > 0 ? (viewable_impressions / impressions) * 100 : 0)

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
