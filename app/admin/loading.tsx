export default function AdminLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-32 rounded-lg" style={{ background: 'var(--surface-2)' }} />
          <div className="h-4 w-16 rounded mt-1.5" style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="h-9 w-28 rounded-lg" style={{ background: 'var(--surface-2)' }} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="h-3 w-24 rounded mb-3" style={{ background: 'var(--surface-2)' }} />
            <div className="h-7 w-20 rounded" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 flex gap-4" style={{ background: 'var(--surface-2)' }}>
          {[40, 20, 20, 20].map((w, i) => (
            <div key={i} className="h-3 rounded" style={{ background: 'var(--surface)', width: `${w}%` }} />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="px-5 py-4 flex gap-4 items-center" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="h-4 rounded flex-1" style={{ background: 'var(--surface-2)', maxWidth: '40%' }} />
            <div className="h-4 rounded w-20" style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 rounded w-20" style={{ background: 'var(--surface-2)' }} />
            <div className="h-4 rounded w-20" style={{ background: 'var(--surface-2)' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
