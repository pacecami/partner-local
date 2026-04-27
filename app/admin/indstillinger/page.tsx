import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TestMailButton from './TestMailButton'

export const dynamic = 'force-dynamic'

export const GA4_PROPS = [
  { key: 'ga4_prop_1_id', label: 'TjekBil web' },
  { key: 'ga4_prop_2_id', label: 'TjekBil app' },
  { key: 'ga4_prop_3_id', label: 'Bilhandel' },
  { key: 'ga4_prop_4_id', label: 'Tjekbilsyn' },
] as const

export default async function IndstillingerPage() {
  const supabase = await createClient()

  const { data: settingsRows } = await supabase
    .from('settings')
    .select('key, value')

  const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value]))

  async function saveGa4Global(formData: FormData) {
    'use server'
    const supabase = await createClient()
    await Promise.all(
      GA4_PROPS.map(({ key }) =>
        supabase.from('settings').upsert({
          key,
          value: (formData.get(key) as string).trim(),
        })
      )
    )
    redirect('/admin/indstillinger?saved=true')
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Indstillinger</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          Globale indstillinger for portalen
        </p>
      </div>

      {/* GA4 Properties — globale, gælder alle partnere */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>GA4 Property IDs</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Disse IDs er globale og gælder for alle partnere. Hvilke properties der er aktive per partner styres på den enkelte partnerside.
          </p>
        </div>
        <form action={saveGa4Global} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {GA4_PROPS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                  {label}
                </label>
                <input
                  name={key}
                  defaultValue={settings[key] ?? ''}
                  placeholder="355021445"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--accent)', color: '#000' }}
            >
              Gem property IDs
            </button>
          </div>
        </form>
      </div>

      {/* E-mail påmindelser */}
      <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>E-mail påmindelser</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Automatisk påmindelse til cp@pace.dk 14 dage inden en mailkampagne starter.
          Kræver <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)' }}>OUTLOOK_EMAIL</code>,{' '}
          <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)' }}>OUTLOOK_PASSWORD</code> og{' '}
          <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surface-2)' }}>SUPABASE_SERVICE_ROLE_KEY</code> i .env.local
        </p>
        <TestMailButton />
      </div>
    </div>
  )
}
