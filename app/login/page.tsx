export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <p className="text-2xl font-bold mb-2" style={{ color: 'var(--accent)' }}>
          Partner Portal
        </p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Kontakt Pace Group for at få adgang til dit dashboard.
        </p>
      </div>
    </div>
  )
}
