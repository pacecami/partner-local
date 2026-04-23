import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testMode = searchParams.get('test') === 'true'

  // Check required env vars
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({
      error: 'RESEND_API_KEY mangler i .env.local — opret konto på resend.com og tilføj nøglen',
    }, { status: 500 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY mangler i .env.local — find den på Supabase → Settings → API',
    }, { status: 500 })
  }

  // Supabase admin client (bypasser RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  )

  // Beregn hvilken dato vi leder efter (14 dage frem)
  const today = new Date()
  const target = new Date(today)
  target.setDate(today.getDate() + 14)
  const targetDateStr = target.toISOString().split('T')[0]

  // Hent kampagner med email-placeringer
  const baseQuery = supabase
    .from('campaigns')
    .select('id, name, start_date, placements, partners(name, slug)')
    .eq('status', 'planned')
    .overlaps('placements', ['Nyhedsbreve', 'Tilbudsmail'])

  const { data: campaigns, error } = testMode
    ? await baseQuery.gte('start_date', today.toISOString().split('T')[0])
    : await baseQuery.eq('start_date', targetDateStr)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({
      message: testMode
        ? 'Ingen planlagte mailkampagner fundet'
        : `Ingen kampagner starter om 14 dage (${targetDateStr})`,
      sent: 0,
    })
  }

  const results = []

  for (const c of campaigns) {
    const partner = c.partners as { name: string; slug: string }
    const emailPlacements = (c.placements ?? []).filter((p: string) =>
      ['Nyhedsbreve', 'Tilbudsmail'].includes(p),
    )
    const placementText = emailPlacements.join(' og ')

    const startDate = c.start_date ? new Date(c.start_date + 'T00:00:00') : null
    const periodeText = startDate
      ? startDate.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
      : 'ukendt periode'

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const portalLink = `${baseUrl}/admin/partners/${partner.slug}`

    const subject = testMode
      ? `[TEST] 📧 Påmindelse: ${placementText} til ${partner.name} — ${periodeText}`
      : `📧 Husk at udforme ${placementText} til ${partner.name} — ${periodeText}`

    const textBody = `Hej Camilla

Nu er det snart tid til at udforme ${placementText} til ${partner.name}, som er planlagt til ${periodeText}.

Tjek inde i portalen, for at se, hvad artiklen skal handle om:
${portalLink}

Mvh
Partner Portalen`

    const htmlBody = `
<p>Hej Camilla</p>
<p>Nu er det snart tid til at udforme <strong>${placementText}</strong> til ${partner.name}, som er planlagt til <strong>${periodeText}</strong>.</p>
<p>Tjek inde i <a href="${portalLink}" style="color:#f5d000">portalen</a>, for at se, hvad artiklen skal handle om.</p>
<br>
<p style="color:#888;font-size:12px">Mvh Partner Portalen</p>
`

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
        to: ['cp@pace.dk'],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    })

    const data = await res.json()
    results.push({
      kampagne: c.name,
      partner: partner.name,
      placering: placementText,
      periode: periodeText,
      status: res.ok ? '✓ Sendt' : `✗ Fejl: ${data.message ?? JSON.stringify(data)}`,
    })
  }

  const sentCount = results.filter(r => r.status.startsWith('✓')).length

  return NextResponse.json({
    mode: testMode ? 'test' : 'produktion',
    sent: sentCount,
    results,
  })
}
