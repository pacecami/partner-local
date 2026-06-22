import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function PartnerSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: partner } = await supabase
    .from('partners')
    .select('access_token')
    .eq('slug', slug)
    .single()

  if (!partner?.access_token) {
    redirect('/login')
  }

  redirect(`/p/${partner.access_token}`)
}
