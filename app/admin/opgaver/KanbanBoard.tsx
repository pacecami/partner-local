'use client'

import { useState, useRef } from 'react'

export type KanbanCampaign = {
  id: string
  name: string
  start_date: string | null
  placements: string[] | null
  material_received: boolean
  task_status: 'todo' | 'in_progress' | 'done'
  task_note: string | null
  partners: { name: string; slug: string } | null
}

const COLUMNS = [
  { id: 'todo' as const, label: 'To do', dot: '#9ca3af' },
  { id: 'in_progress' as const, label: 'In progress', dot: '#f97316' },
  { id: 'done' as const, label: 'Done', dot: '#22c55e' },
]

async function patchCampaign(id: string, updates: Record<string, unknown>) {
  await fetch('/api/campaigns/update-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...updates }),
  })
}

function Card({
  c,
  onMaterialToggle,
  onNoteChange,
}: {
  c: KanbanCampaign
  onMaterialToggle: (id: string, current: boolean) => void
  onNoteChange: (id: string, note: string) => void
}) {
  const [note, setNote] = useState(c.task_note ?? '')
  const [saving, setSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleNoteChange(val: string) {
    setNote(val)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    setSaving(true)
    saveTimeout.current = setTimeout(async () => {
      await onNoteChange(c.id, val)
      setSaving(false)
    }, 800)
  }

  return (
    <div
      className="rounded-xl p-3.5 space-y-2.5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Partner badge */}
      {c.partners && (
        <span
          className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'var(--accent)', color: '#000' }}
        >
          {c.partners.name}
        </span>
      )}

      {/* Campaign name */}
      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
        {c.name}
      </p>

      {/* Start date */}
      {c.start_date && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {new Date(c.start_date + 'T00:00:00').toLocaleDateString('da-DK', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      {/* Placements */}
      {(c.placements ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(c.placements ?? []).map(p => (
            <span
              key={p}
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Note field */}
      <div>
        <textarea
          value={note}
          onChange={e => handleNoteChange(e.target.value)}
          placeholder="Tilføj en note..."
          rows={2}
          className="w-full text-xs px-2.5 py-2 rounded-lg outline-none resize-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        />
        {saving && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Gemmer...</p>
        )}
      </div>

      {/* Bottom row */}
      <div
        className="flex items-center justify-between pt-1"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={() => onMaterialToggle(c.id, c.material_received)}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-all"
          style={{
            background: c.material_received ? 'rgba(34,197,94,0.15)' : 'var(--surface-2)',
            color: c.material_received ? 'rgb(34,197,94)' : 'var(--muted)',
            border: `1px solid ${c.material_received ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
          }}
        >
          <span>{c.material_received ? '✓' : '○'}</span>
          <span>Materiale</span>
        </button>

        {c.partners && (
          <a
            href={`/admin/partners/${c.partners.slug}`}
            className="text-xs"
            style={{ color: 'var(--muted)' }}
          >
            Åbn →
          </a>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ campaigns: initial }: { campaigns: KanbanCampaign[] }) {
  const [campaigns, setCampaigns] = useState(initial)
  const [draggingOver, setDraggingOver] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)

  function handleDragStart(e: React.DragEvent, id: string) {
    dragId.current = id
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDraggingOver(colId)
  }

  function handleDragLeave() {
    setDraggingOver(null)
  }

  async function handleDrop(e: React.DragEvent, targetCol: 'todo' | 'in_progress' | 'done') {
    e.preventDefault()
    setDraggingOver(null)
    const id = e.dataTransfer.getData('text/plain') || dragId.current
    if (!id) return
    const campaign = campaigns.find(c => c.id === id)
    if (!campaign || campaign.task_status === targetCol) return

    setCampaigns(prev =>
      prev.map(c => (c.id === id ? { ...c, task_status: targetCol } : c))
    )
    await patchCampaign(id, { task_status: targetCol })
    dragId.current = null
  }

  async function handleMaterialToggle(id: string, current: boolean) {
    setCampaigns(prev =>
      prev.map(c => (c.id === id ? { ...c, material_received: !current } : c))
    )
    await patchCampaign(id, { material_received: !current })
  }

  async function handleNoteChange(id: string, note: string) {
    await patchCampaign(id, { task_note: note })
  }

  const total = campaigns.length
  const doneCount = campaigns.filter(c => c.task_status === 'done').length

  return (
    <div>
      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--muted)' }}>
            <span>{doneCount} af {total} opgaver færdige</span>
            <span>{Math.round((doneCount / total) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(doneCount / total) * 100}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-3 gap-5">
        {COLUMNS.map(col => {
          const cards = campaigns.filter(c => c.task_status === col.id)
          const isOver = draggingOver === col.id

          return (
            <div
              key={col.id}
              onDragOver={e => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.id)}
              className="rounded-xl min-h-48 transition-all"
              style={{
                background: isOver ? 'var(--surface)' : 'var(--surface-2)',
                border: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                padding: '2px',
              }}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.dot }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {col.label}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--surface)', color: 'var(--muted)' }}
                >
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <div className="px-2 pb-3 space-y-2">
                {cards.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={e => handleDragStart(e, c.id)}
                    style={{ cursor: 'grab' }}
                  >
                    <Card c={c} onMaterialToggle={handleMaterialToggle} onNoteChange={handleNoteChange} />
                  </div>
                ))}

                {cards.length === 0 && (
                  <div
                    className="rounded-lg p-5 text-center text-xs"
                    style={{
                      border: '2px dashed var(--border)',
                      color: 'var(--muted)',
                    }}
                  >
                    Træk kort hertil
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
