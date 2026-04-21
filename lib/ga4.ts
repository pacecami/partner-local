import { BetaAnalyticsDataClient } from '@google-analytics/data'

function getClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const credentials = JSON.parse(raw)
  return new BetaAnalyticsDataClient({ credentials })
}

export interface GA4EventResult {
  eventName: string
  count: number
}

export async function fetchGA4Events(
  propertyId: string,
  eventNames: string[],
  startDate = '28daysAgo',
  endDate = 'today'
): Promise<GA4EventResult[]> {
  if (!eventNames.length) return []

  const client = getClient()

  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: eventNames },
      },
    },
  })

  const resultMap = new Map(
    (response.rows ?? []).map(row => [
      row.dimensionValues?.[0]?.value ?? '',
      parseInt(row.metricValues?.[0]?.value ?? '0'),
    ])
  )

  return eventNames.map(name => ({
    eventName: name,
    count: resultMap.get(name) ?? 0,
  }))
}
