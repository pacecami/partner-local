import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { createClient } from '@supabase/supabase-js'

async function getClient() {
  // Hent Google Service Account JSON fra Supabase settings-tabellen
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'google_service_account_json')
    .single()

  const raw = data?.value ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('Google Service Account JSON er ikke konfigureret')
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

  const client = await getClient()

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
