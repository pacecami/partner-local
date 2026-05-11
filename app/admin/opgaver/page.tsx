import { createClient } from '@/lib/supabase/server'
import KanbanBoard from './KanbanBoard'

export const dynamic = 'force-dynamic'

export default async function OpgaverPage() {
  const supabase = await createClient()

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, start_date, placements, material_received, task_status, task_note, partners(name, slug)')
    .eq('subject_pending', true)
    .order('start_date', { ascending: true })

  const normalized = (campaigns ?? []).map(c => ({
    ...c,
    task_status: (c.task_status ?? 'todo') as 'todo' | 'in_progress' | 'done',
    task_note: c.task_note ?? null,
    material_received: c.material_received ?? false,
    partners: (Array.isArray(c.partners) ? c.partners[0] ?? null : c.partners) as {
      name: string
      slug: string
    } | null,
  }))

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Opgaver
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Kampagner hvor emnet endnu ikke er fastlagt
        </p>
      </div>

      {normalized.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Ingen opgaver!
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            Alle kampagner har et fastlagt emne.
          </p>
        </div>
      ) : (
        <KanbanBoard campaigns={normalized} />
      )}
    </div>
  )
}
