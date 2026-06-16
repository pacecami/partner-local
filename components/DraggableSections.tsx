'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'

interface SectionMeta {
  id: string
  label: string
  node: React.ReactElement
}

export default function DraggableSections({
  children,
  storageKey,
}: {
  children: React.ReactNode
  storageKey: string
}) {
  const sections = useMemo<SectionMeta[]>(() => {
    return React.Children.toArray(children).flatMap(child => {
      if (!React.isValidElement(child)) return []
      const props = child.props as Record<string, unknown>
      const id = props['data-section-id'] as string | undefined
      if (!id) return []
      return [{ id, label: (props['data-section-label'] as string) ?? id, node: child }]
    })
  }, [children])

  const defaultOrder = useMemo(() => sections.map(s => s.id), [sections])
  const [order, setOrder] = useState<string[]>(defaultOrder)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const isDragHandle = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed: string[] = JSON.parse(saved)
        const idSet = new Set(defaultOrder)
        const valid = parsed.filter(id => idSet.has(id))
        const missing = defaultOrder.filter(id => !new Set(parsed).has(id))
        if (valid.length > 0) setOrder([...valid, ...missing])
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function saveOrder(newOrder: string[]) {
    setOrder(newOrder)
    try { localStorage.setItem(storageKey, JSON.stringify(newOrder)) } catch {}
  }

  const sectionMap = new Map(sections.map(s => [s.id, s]))
  const ordered = order.map(id => sectionMap.get(id)).filter(Boolean) as SectionMeta[]

  return (
    <div className="space-y-8">
      {ordered.map((section, idx) => (
        <div
          key={section.id}
          className="flex items-start gap-1 group/section"
          onDragOver={(e) => {
            e.preventDefault()
            if (dragIdx !== null && dragIdx !== idx) setOverIdx(idx)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIdx === null || dragIdx === idx) return
            const newOrder = [...order]
            const [moved] = newOrder.splice(dragIdx, 1)
            newOrder.splice(idx, 0, moved)
            saveOrder(newOrder)
            setDragIdx(null)
            setOverIdx(null)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverIdx(null)
          }}
          style={{
            opacity: dragIdx === idx ? 0.4 : 1,
            outline: overIdx === idx && dragIdx !== idx ? '2px solid var(--accent)' : 'none',
            outlineOffset: '3px',
            borderRadius: '12px',
            transition: 'opacity 0.15s',
          }}
        >
          {/* Drag handle i venstre side — som HubSpot */}
          <div
            className="opacity-0 group-hover/section:opacity-100 transition-opacity shrink-0 flex items-center"
            title={`Træk for at flytte "${section.label}"`}
            style={{
              marginTop: '14px',
              cursor: 'grab',
              padding: '4px 3px',
              borderRadius: '4px',
              color: 'var(--muted)',
              fontSize: '16px',
              lineHeight: 1,
              userSelect: 'none',
            }}
            onMouseDown={() => { isDragHandle.current = true }}
            onMouseUp={() => { isDragHandle.current = false }}
          >
            ⠿
          </div>

          {/* Section content — fylder resten af bredden */}
          <div
            className="flex-1 min-w-0"
            draggable
            onDragStart={(e) => {
              if (!isDragHandle.current) { e.preventDefault(); return }
              setDragIdx(idx)
            }}
            onDragEnd={() => {
              isDragHandle.current = false
              setDragIdx(null)
              setOverIdx(null)
            }}
          >
            {section.node}
          </div>
        </div>
      ))}
    </div>
  )
}
