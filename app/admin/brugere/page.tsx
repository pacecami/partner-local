import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BrugerePage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>
}) {
  const { created, error } = await searchParams
  const supabase = await createClient()

  const { data: admins } = await supabase
    .from('profiles')
    .select('id, display_name, email, role')
    .eq('role', 'admin')
    .order('display_name')

  async function createUser(formData: FormData) {
    'use server'
    const name     = (formData.get('name')     as string).trim()
    const email    = (formData.get('email')    as string).trim().toLowerCase()
    const password = (formData.get('password') as string)
    if (!name || !email || !password) return

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error || !data?.user) {
      redirect('/admin/brugere?error=1')
    }

    const supabase = await createClient()
    await supabase.from('profiles').upsert({
      id:           data.user.id,
      display_name: name,
      email,
      role:         'admin',
      partner_id:   null,
    })

    redirect('/admin/brugere?created=1')
  }

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Brugere</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Admins med adgang til partnerportalen
        </p>
      </div>

      {/* Statusbeskeder */}
      {created && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: 'rgb(34,197,94)' }}>
          ✓ Brugeren er oprettet og kan nu logge ind.
        </div>
      )}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
          Noget gik galt. Tjek at emailen ikke allerede er i brug.
        </div>
      )}

      {/* Brugertabel */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            Adgang ({admins?.length ?? 0})
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Navn', 'Email', 'Rolle'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(admins ?? []).map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < (admins?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {u.display_name ?? '—'}
                </td>
                <td className="px-6 py-4 text-sm font-mono" style={{ color: 'var(--muted)' }}>
                  {u.email ?? '—'}
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}>
                    Admin
                  </span>
                </td>
              </tr>
            ))}
            {(admins?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  Ingen brugere fundet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Opret bruger */}
      <section className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
          Opret ny bruger
        </h2>
        <p className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
          Brugeren kan logge ind med det samme med den valgte adgangskode.
        </p>

        {hasServiceKey ? (
          <form action={createUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Fuldt navn *</label>
                <input name="name" required placeholder="fx Dorthe Thomsen" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Email *</label>
                <input name="email" type="email" required placeholder="fx dt@pace.dk" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Adgangskode *</label>
              <input name="password" type="password" required minLength={8} placeholder="Min. 8 tegn" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: '#000' }}>
                Opret bruger →
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg px-4 py-4 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>Opsætning mangler</p>
            <p className="text-xs">
              Tilføj <code className="px-1.5 py-0.5 rounded text-xs mx-0.5" style={{ background: 'var(--background)' }}>SUPABASE_SERVICE_ROLE_KEY</code>
              som environment variable på Netlify for at kunne oprette brugere.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
