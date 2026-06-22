import { NextRequest, NextResponse } from 'next/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('prop') ?? '355021445'
  const eventName  = searchParams.get('event') ?? ''

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: settingRow } = await sb.from('settings').select('value').eq('key', 'google_service_account_json').single()
    const raw = settingRow?.value ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (!raw) return NextResponse.json({ error: 'Ingen service account JSON fundet' }, { status: 500 })
    const credentials = JSON.parse(raw)
    const client = new BetaAnalyticsDataClient({ credentials })

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      ...(eventName ? {
        dimensionFilter: {
          filter: { fieldName: 'eventName', inListFilter: { values: [eventName] } },
        },
      } : {}),
      limit: 20,
    })

    return NextResponse.json({
      property: propertyId,
      rows: (response.rows ?? []).map(r => ({
        event: r.dimensionValues?.[0]?.value,
        count: r.metricValues?.[0]?.value,
      })),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
