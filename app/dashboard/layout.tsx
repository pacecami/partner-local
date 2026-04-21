import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, partner_id, partners(name)')
    .eq('id', user.id)
    .single()

  const partnersField = profile?.partners as unknown
  const partnerName = (Array.isArray(partnersField) ? (partnersField[0] as { name: string }) : (partnersField as { name: string } | null))?.name

  return (
    <div className="flex min-h-screen">
      <Sidebar role="partner" partnerName={partnerName} />
      <main className="flex-1 p-8" style={{ background: 'var(--background)' }}>
        {children}
      </main>
    </div>
  )
}
