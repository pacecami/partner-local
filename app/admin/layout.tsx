import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import SavedToast from '@/components/SavedToast'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name, slug')
    .order('name')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" partners={partners ?? []} />
      <main className="flex-1 p-8" style={{ background: 'var(--background)' }}>
        {children}
      </main>
      <Suspense>
        <SavedToast />
      </Suspense>
    </div>
  )
}
