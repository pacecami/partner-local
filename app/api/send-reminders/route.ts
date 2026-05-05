import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const testMode = searchParams.get('test') === 'true'

  // Check required env vars
  const smtpUser = process.env.OUTLOOK_EMAIL
  const smtpPass = process.env.OUTLOOK_PASSWORD
  if (!smtpUser || !smtpPass) {
    return NextResponse.json({
      error: 'OUTLOOK_EMAIL eller OUTLOOK_PASSWORD mangler i .env.local',
    }, { status: 500 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY mangler i .env.local — find den på Supabase → Settings → API',
    }, { status: 500 })
  }

  // Nodemailer via Outlook SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      ciphers: 'SSLv3',
    },
  })

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
    const partner = (Array.isArray(c.partners) ? c.partners[0] : c.partners) as { name: string; slug: string }
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
      ? `[TEST] Påmindelse: ${placementText} til ${partner.name} — ${periodeText}`
      : `Påmindelse: Husk at udforme ${placementText} til ${partner.name} — ${periodeText}`

    const textBody = `Hej Camilla

Nu er det snart tid til at udforme ${placementText} til ${partner.name}, som er planlagt til ${periodeText}.

Tjek inde i portalen, for at se, hvad artiklen skal handle om:
${portalLink}

Mvh
Partner Portalen`

    const htmlBody = `
<div style="font-family:sans-serif;max-width:520px;color:#111">
  <p>Hej Camilla</p>
  <p>Nu er det snart tid til at udforme <strong>${placementText}</strong> til <strong>${partner.name}</strong>, som er planlagt til <strong>${periodeText}</strong>.</p>
  <p>Tjek inde i <a href="${portalLink}" style="color:#c8a800;font-weight:600">portalen</a>, for at se, hvad artiklen skal handle om.</p>
  <br>
  <p style="color:#999;font-size:12px">Mvh Partner Portalen</p>
</div>`

    try {
      await transporter.sendMail({
        from: `"Partner Portalen" <${smtpUser}>`,
        to: 'cp@pace.dk',
        subject,
        text: textBody,
        html: htmlBody,
      })
      results.push({
        kampagne: c.name,
        partner: partner.name,
        placering: placementText,
        periode: periodeText,
        status: '✓ Sendt',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({
        kampagne: c.name,
        partner: partner.name,
        placering: placementText,
        periode: periodeText,
        status: `✗ Fejl: ${message}`,
      })
    }
  }

  const sentCount = results.filter(r => r.status.startsWith('✓')).length

  return NextResponse.json({
    mode: testMode ? 'test' : 'produktion',
    sent: sentCount,
    results,
  })
}
