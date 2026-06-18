'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertLead(formData: FormData) {
  const supabase = await createClient()

  const partnerId = formData.get('partner_id') as string
  const monthRaw = formData.get('month') as string // "YYYY-MM"
  const leadCount = parseInt(formData.get('lead_count') as string, 10)
  const price = parseFloat((formData.get('price') as string).replace(',', '.'))

  if (!partnerId || !monthRaw || isNaN(leadCount) || isNaN(price)) return

  const month = `${monthRaw}-01`

  const { data: existing } = await supabase
    .from('partner_leads')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('month', month)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('partner_leads')
      .update({ lead_count: leadCount, price, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('partner_leads')
      .insert({ partner_id: partnerId, month, lead_count: leadCount, price })
  }

  revalidatePath('/admin/leads')
}

export async function deleteLead(id: string) {
  const supabase = await createClient()
  await supabase.from('partner_leads').delete().eq('id', id)
  revalidatePath('/admin/leads')
}
