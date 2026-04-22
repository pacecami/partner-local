import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function BrugerePage() {
  const supabase = await createClient()

  // Hent alle admin-profiler — email er gemt direkte i profiles
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, display_name, email, role')
    .eq('role', 'admin')
    .order('display_name')

  // ── Server actions ────────────────────────────────────────────────────────
  async function inviteUser(formData: FormData) {
    'use server'
    const name  = (formData.get('name')  as string).trim()
    const email = (formData.get('email') as string).trim().toLowerCase()
    if (!name || !email) return

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY mangler i .env.local')
      redirect('/admin/brugere?error=no-key')
    }

    const adminClient = createAdminClient()

    // Send invite-mail via Supabase Auth
    const { data: inviteData, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: name },
    })

    if (error || !inviteData?.user) {
      console.error('Invite fejl:', error?.message)
      redirect('/admin/brugere?error=invite-failed')
    }

    // Gem profil med admin-rolle og email
    const supabase = await createClient()
    await supabase.from('profiles').upsert({
      id:           inviteData.user.id,
      display_name: name,
      email:        email,
      role:         'admin',
      partner_id:   null,
    })

    redirect('/admin/brugere')
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border:     '1px solid var(--border)',
    color:      'var(--foreground)',
  }

  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Brugere
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Admins med adgang til partnerportalen
        </p>
      </div>

      {/* ── Brugertabel ─────────────────────────────────────────────────── */}
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
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(admins ?? []).map((u, i) => (
              <tr
                key={u.id}
                style={{ borderBottom: i < (admins?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td className="px-6 py-4">
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {u.display_name ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-mono" style={{ color: 'var(--muted)' }}>
                    {u.email ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--foreground)' }}
                  >
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

      {/* ── Inviter ny bruger ────────────────────────────────────────────── */}
      <section
        className="rounded-xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
          Inviter ny bruger
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Brugeren modtager en invite-mail med et link til at oprette adgangskode.
        </p>

        {!hasServiceKey && (
          <div
            className="rounded-lg px-4 py-3 mb-4 text-sm"
            style={{ background: '#2a1a00', border: '1px solid #b45309', color: '#fbbf24' }}
          >
            <strong>Opsætning mangler:</strong> Tilføj <code className="font-mono text-xs mx-1 px-1 py-0.5 rounded" style={{ background: '#1a1000' }}>SUPABASE_SERVICE_ROLE_KEY</code> til <code className="font-mono text-xs mx-1 px-1 py-0.5 rounded" style={{ background: '#1a1000' }}>.env.local</code> for at kunne sende invitationer.
            <br />
            <span className="text-xs mt-1 block" style={{ color: '#d97706' }}>
              Find nøglen på: Supabase Dashboard → Project Settings → API → service_role
            </span>
          </div>
        )}

        <form action={inviteUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Fuldt navn *
              </label>
              <input
                name="name"
                required
                placeholder="fx Dorthe Thomsen"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                Email *
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="fx dt@pace.dk"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Send invitation →
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
