import { schedule } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const AUTO_PLACEMENTS = ['Banner', 'Inapp', 'Facebook']

// Kører den 1. i hver måned kl. 06:00
const handler = schedule('0 6 1 * *', async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, start_date, end_date, placements')
    .overlaps('placements', AUTO_PLACEMENTS)

  for (const c of campaigns ?? []) {
    if (c.status === 'planned' && c.start_date && c.start_date <= today) {
      await supabase.from('campaigns').update({ status: 'active' }).eq('id', c.id)
    } else if (c.status === 'active' && c.end_date && c.end_date < today) {
      await supabase.from('campaigns').update({ status: 'ended' }).eq('id', c.id)
    }
  }

  return { statusCode: 200 }
})

export { handler }
