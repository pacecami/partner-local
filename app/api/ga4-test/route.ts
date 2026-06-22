import { NextRequest, NextResponse } from 'next/server'
import { BetaAnalyticsDataClient } from '@google-analytics/data'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const propertyId = searchParams.get('prop') ?? '355021445'
  const eventName  = searchParams.get('event') ?? ''

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}')
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
