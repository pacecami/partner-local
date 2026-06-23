import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const AUTO_PLACEMENTS = ['Banner', 'Inapp', 'Facebook']

export async function GET(request: Request) {
  // Beskyt med secret token
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = new Date().toISOString().split('T')[0]

  // Hent alle kampagner med relevante placeringer
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date, placements')
    .overlaps('placements', AUTO_PLACEMENTS)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const activated: string[] = []
  const ended: string[] = []

  for (const c of campaigns ?? []) {
    if (c.status === 'planned' && c.start_date && c.start_date <= today) {
      await supabase.from('campaigns').update({ status: 'active' }).eq('id', c.id)
      activated.push(c.name)
    } else if (c.status === 'active' && c.end_date && c.end_date < today) {
      await supabase.from('campaigns').update({ status: 'ended' }).eq('id', c.id)
      ended.push(c.name)
    }
  }

  return NextResponse.json({ activated, ended, date: today })
}
