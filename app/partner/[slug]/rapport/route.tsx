import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchGA4Events } from '@/lib/ga4'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import React from 'react'

export const dynamic = 'force-dynamic'

// ─── Farver ───────────────────────────────────────────────────────────────────
const ACCENT = '#b89600'   // mørkere gul der printer godt
const MUTED  = '#888888'
const BORDER = '#e8e8e8'
const BG_CARD = '#f9f9f9'

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 44,
    paddingTop: 40,
    paddingBottom: 52,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#111111',
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 24,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
  },
  brand: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#111' },
  partnerName: { fontSize: 9, color: MUTED, marginTop: 3 },
  monthBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  monthText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff' },

  // Sektion
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#111',
    marginBottom: 6,
    marginTop: 18,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  // Summary kort
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
  summaryCard: {
    flex: 1,
    backgroundColor: BG_CARD,
    borderRadius: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryLabel: { color: MUTED, fontSize: 8, marginBottom: 3 },
  summaryValue: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#111' },
  summaryAccent: { fontFamily: 'Helvetica-Bold', fontSize: 14, color: ACCENT },

  // Abonnement
  subGrid: { flexDirection: 'row', gap: 8 },
  subCell: { flex: 1, backgroundColor: BG_CARD, borderRadius: 5, padding: 10, borderWidth: 1, borderColor: BORDER },
  subLabel: { color: MUTED, fontSize: 8, marginBottom: 3 },
  subValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#111' },

  // Tabel header
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 1,
  },
  th: { color: MUTED, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },

  // Kampagne-række
  campaignRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: 'flex-start',
  },
  campaignName: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#111' },
  campaignMeta: { fontSize: 8, color: MUTED, marginTop: 1 },

  // Performance chips under kampagne
  perfRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 6,
    paddingTop: 2,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: '#fcfcfc',
  },
  perfItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perfLabel: { color: MUTED, fontSize: 7.5 },
  perfValue: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#111' },
  perfAccent: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: ACCENT },

  // Status badge
  badgeActive:  { backgroundColor: '#dcfce7', color: '#166534', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7.5 },
  badgePlanned: { backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7.5 },
  badgeEnded:   { backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, fontSize: 7.5 },

  // GA4
  ga4Card: {
    backgroundColor: BG_CARD,
    borderRadius: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  ga4Title: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#111', marginBottom: 6 },
  ga4Row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  ga4Event: { fontSize: 9, color: '#111' },
  ga4Count: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: ACCENT },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: { fontSize: 7.5, color: '#bbbbbb' },
})

// ─── Hjælpefunktioner ─────────────────────────────────────────────────────────
function fmtNum(n: number) {
  return n.toLocaleString('da-DK')
}

function statusStyle(status: string) {
  if (status === 'active')  return s.badgeActive
  if (status === 'planned') return s.badgePlanned
  return s.badgeEnded
}

function statusLabel(status: string) {
  if (status === 'active')  return 'Aktiv'
  if (status === 'planned') return 'Planlagt'
  return 'Afsluttet'
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const EARLIEST = '2026-01'
  const selectedMonth =
    monthParam && monthParam >= EARLIEST && monthParam <= currentYM
      ? monthParam
      : currentYM
  const [selYear, selMonth] = selectedMonth.split('-').map(Number)
  const ga4Start = `${selectedMonth}-01`
  const ga4End   = `${selectedMonth}-${String(new Date(selYear, selMonth, 0).getDate()).padStart(2, '0')}`
  const monthLabel = new Date(selYear, selMonth - 1, 1).toLocaleDateString('da-DK', {
    month: 'long',
    year: 'numeric',
  })

  const supabase = await createClient()

  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!partner) return new NextResponse('Ikke fundet', { status: 404 })

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('partner_id', partner.id)
    .order('start_date', { ascending: false })

  // Abonnement
  const subStart = partner.subscription_start ? new Date(partner.subscription_start) : null
  const subEnd   = partner.subscription_end   ? new Date(partner.subscription_end)   : null
  let subMonthly: number | null = null
  if (subStart && subEnd && partner.subscription_budget) {
    const months =
      (subEnd.getFullYear() - subStart.getFullYear()) * 12 +
      (subEnd.getMonth() - subStart.getMonth()) + 1
    subMonthly = months > 0 ? Math.round(partner.subscription_budget / months) : null
  }
  const campaignBudget = (campaigns ?? []).reduce((s, c) => s + (c.monthly_budget ?? 0), 0)
  const totalMonthly   = (subMonthly ?? 0) + campaignBudget

  // GA4
  const ga4Properties = [
    { id: partner.ga4_property_id,   events: partner.ga4_events_1, label: partner.ga4_label_1, aliases: partner.ga4_aliases_1 },
    { id: partner.ga4_property_id_2, events: partner.ga4_events_2, label: partner.ga4_label_2, aliases: partner.ga4_aliases_2 },
  ].filter(p => p.id) as { id: string; events: string | null; label: string | null; aliases: string | null }[]

  const ga4Results = await Promise.all(
    ga4Properties.map(({ id, events }) => {
      const eventNames = events ? events.split(',').map(e => e.trim()).filter(Boolean) : []
      return fetchGA4Events(id, eventNames, ga4Start, ga4End).catch(() => null)
    })
  )

  // ─── PDF-dokument ──────────────────────────────────────────────────────────
  const pdf = await renderToBuffer(
    <Document
      title={`Rapport – ${partner.name} – ${monthLabel}`}
      author="Pace Group ApS"
      creator="Pace Group ApS Partnerportal"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brand}>Pace Group ApS</Text>
            <Text style={s.partnerName}>{partner.name} · Partnerdashboard</Text>
          </View>
          <View style={s.monthBadge}>
            <Text style={s.monthText}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
          </View>
        </View>

        {/* ── Opsummering ── */}
        <Text style={s.sectionTitle}>Opsummering</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Kampagner i alt</Text>
            <Text style={s.summaryValue}>{campaigns?.length ?? 0}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Aktive kampagner</Text>
            <Text style={{ ...s.summaryValue, color: '#166534' }}>
              {(campaigns ?? []).filter(c => c.status === 'active').length}
            </Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Samlet budget/md (ex. moms)</Text>
            <Text style={s.summaryAccent}>
              {totalMonthly > 0 ? `${fmtNum(totalMonthly)} kr` : '—'}
            </Text>
          </View>
        </View>

        {/* ── Abonnement ── */}
        {(subStart || subEnd || partner.subscription_budget) && (
          <>
            <Text style={s.sectionTitle}>Abonnement</Text>
            <View style={s.subGrid}>
              <View style={s.subCell}>
                <Text style={s.subLabel}>Startdato</Text>
                <Text style={s.subValue}>{subStart ? subStart.toLocaleDateString('da-DK') : '—'}</Text>
              </View>
              <View style={s.subCell}>
                <Text style={s.subLabel}>Slutdato</Text>
                <Text style={s.subValue}>{subEnd ? subEnd.toLocaleDateString('da-DK') : '—'}</Text>
              </View>
              <View style={s.subCell}>
                <Text style={s.subLabel}>Samlet budget (ex. moms)</Text>
                <Text style={s.subValue}>
                  {partner.subscription_budget ? `${fmtNum(partner.subscription_budget)} kr` : '—'}
                </Text>
              </View>
              <View style={s.subCell}>
                <Text style={s.subLabel}>Budget/md (beregnet)</Text>
                <Text style={{ ...s.subValue, color: ACCENT }}>
                  {subMonthly ? `${fmtNum(subMonthly)} kr` : '—'}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── Kampagner ── */}
        <Text style={s.sectionTitle}>Kampagner</Text>
        {/* Tabelhovedlinje */}
        <View style={s.tableHead}>
          <Text style={{ ...s.th, flex: 3 }}>Kampagne</Text>
          <Text style={{ ...s.th, flex: 2 }}>Placeringer</Text>
          <Text style={{ ...s.th, flex: 1 }}>Status</Text>
          <Text style={{ ...s.th, flex: 2 }}>Periode</Text>
          <Text style={{ ...s.th, flex: 1.5, textAlign: 'right' }}>Budget/md</Text>
        </View>

        {(campaigns ?? []).map(c => {
          const placements: string[] = c.placements ?? []
          const isEmail  = placements.some((p: string) => p === 'Nyhedsbreve' || p === 'Tilbudsmail')
          const isBanner = placements.includes('Banner')
          const isInapp  = placements.includes('Inapp')
          const isVisual = isBanner || isInapp
          const showVisual = isVisual || (!isEmail && (c.impressions != null || c.clicks != null))
          const hasEmailPerf  = c.emails_sent != null || c.emails_opened != null || c.clicks_to_advertiser != null
          const hasVisualPerf = c.impressions  != null || c.clicks        != null
          const hasPerf = (isEmail && hasEmailPerf) || (showVisual && hasVisualPerf)

          return (
            <React.Fragment key={c.id}>
              {/* Kampagnerække */}
              <View style={s.campaignRow}>
                <View style={{ flex: 3 }}>
                  <Text style={s.campaignName}>{c.name}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.campaignMeta}>{placements.join(', ') || '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={statusStyle(c.status)}>{statusLabel(c.status)}</Text>
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.campaignMeta}>
                    {c.start_date
                      ? `${c.start_date.slice(0, 7)}${c.end_date ? ` → ${c.end_date.slice(0, 7)}` : ''}`
                      : '—'}
                  </Text>
                </View>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 9 }}>
                    {c.monthly_budget ? `${fmtNum(c.monthly_budget)} kr` : '—'}
                  </Text>
                </View>
              </View>

              {/* Performance */}
              {hasPerf && (
                <View style={s.perfRow}>
                  {isEmail && hasEmailPerf && (
                    <>
                      {c.emails_sent != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>Antal sendte</Text>
                          <Text style={s.perfValue}>{fmtNum(c.emails_sent)}</Text>
                        </View>
                      )}
                      {c.emails_sent != null && c.emails_opened != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>Åbningsrate</Text>
                          <Text style={s.perfAccent}>
                            {((c.emails_opened / c.emails_sent) * 100).toFixed(1)}%
                          </Text>
                        </View>
                      )}
                      {c.clicks_to_advertiser != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>Kliks til annoncør</Text>
                          <Text style={s.perfValue}>{fmtNum(c.clicks_to_advertiser)}</Text>
                        </View>
                      )}
                    </>
                  )}
                  {showVisual && hasVisualPerf && (
                    <>
                      {c.impressions != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>Visninger</Text>
                          <Text style={s.perfValue}>{fmtNum(c.impressions)}</Text>
                        </View>
                      )}
                      {c.clicks != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>Kliks</Text>
                          <Text style={s.perfValue}>{fmtNum(c.clicks)}</Text>
                        </View>
                      )}
                      {c.impressions != null && c.clicks != null && (
                        <View style={s.perfItem}>
                          <Text style={s.perfLabel}>{isBanner ? 'Klikrate' : 'CTR'}</Text>
                          <Text style={s.perfAccent}>
                            {((c.clicks / c.impressions) * 100).toFixed(1)}%
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}
            </React.Fragment>
          )
        })}

        {/* ── GA4 Statistik ── */}
        {ga4Properties.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Statistik</Text>
            {ga4Properties.map(({ id, label, aliases, events: eventsStr }, i) => {
              const events    = ga4Results[i]
              const aliasList = aliases ? aliases.split(',').map(a => a.trim()) : []
              const eventList = (eventsStr ?? '').split(',').map(e => e.trim())
              const aliasMap  = Object.fromEntries(eventList.map((e, idx) => [e, aliasList[idx] || e]))

              if (!events || events.length === 0) return null
              return (
                <View key={id} style={s.ga4Card}>
                  <Text style={s.ga4Title}>{label ?? `Property ${i + 1}`}</Text>
                  {events.map(({ eventName, count }) => (
                    <View key={eventName} style={s.ga4Row}>
                      <Text style={s.ga4Event}>{aliasMap[eventName] || eventName}</Text>
                      <Text style={s.ga4Count}>{fmtNum(count)}</Text>
                    </View>
                  ))}
                </View>
              )
            })}
          </>
        )}

        {/* ── Footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Pace Group ApS · Fortrolig partnerrapport</Text>
          <Text style={s.footerText}>
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} · Genereret {now.toLocaleDateString('da-DK')}
          </Text>
        </View>

      </Page>
    </Document>
  )

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rapport-${slug}-${selectedMonth}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
