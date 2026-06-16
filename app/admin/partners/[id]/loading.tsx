function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={{ borderRadius: '6px', background: 'var(--surface-2)', ...style }} />
}

export default function PartnerLoading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Skeleton style={{ height: '28px', width: '180px' }} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton style={{ height: '32px', width: '32px', borderRadius: '8px' }} />
          <Skeleton style={{ height: '20px', width: '80px' }} />
          <Skeleton style={{ height: '32px', width: '32px', borderRadius: '8px' }} />
        </div>
      </div>

      {/* Stats bælker */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Skeleton style={{ height: '11px', width: '70px', marginBottom: '10px' }} />
            <Skeleton style={{ height: '26px', width: '100px' }} />
          </div>
        ))}
      </div>

      {/* Abonnement sektion */}
      <div className="rounded-xl mb-5 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <Skeleton style={{ height: '14px', width: '160px' }} />
          <Skeleton style={{ height: '30px', width: '100px', borderRadius: '8px' }} />
        </div>
        <div className="p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton style={{ height: '13px', flex: 1 }} />
              <Skeleton style={{ height: '13px', width: '80px' }} />
              <Skeleton style={{ height: '13px', width: '80px' }} />
              <Skeleton style={{ height: '13px', width: '80px' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Kampagner sektion */}
      <div className="rounded-xl mb-5 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <Skeleton style={{ height: '14px', width: '120px' }} />
          <Skeleton style={{ height: '30px', width: '110px', borderRadius: '8px' }} />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-4 items-center" style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}>
            <Skeleton style={{ height: '13px', flex: 1, maxWidth: '200px' }} />
            <Skeleton style={{ height: '18px', width: '50px', borderRadius: '20px' }} />
            <Skeleton style={{ height: '13px', width: '80px' }} />
            <Skeleton style={{ height: '13px', width: '80px' }} />
            <Skeleton style={{ height: '13px', width: '60px' }} />
          </div>
        ))}
      </div>

      {/* GA4 sektion */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Skeleton style={{ height: '14px', width: '140px' }} />
        </div>
        <div className="p-6 grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg p-4" style={{ background: 'var(--surface-2)' }}>
              <Skeleton style={{ height: '11px', width: '80px', marginBottom: '8px', background: 'var(--surface)' }} />
              <Skeleton style={{ height: '22px', width: '60px', background: 'var(--surface)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
