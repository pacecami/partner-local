import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const { id, task_status, material_received, task_note } = body

  const supabase = await createClient()
  const updates: Record<string, unknown> = {}

  if (task_status !== undefined) updates.task_status = task_status
  if (material_received !== undefined) updates.material_received = material_received
  if (task_note !== undefined) updates.task_note = task_note

  const { error } = await supabase.from('campaigns').update(updates).eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
