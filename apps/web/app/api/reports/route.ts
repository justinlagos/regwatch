import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

type Template = 'monthly_monitoring' | 'gtco_metrics' | 'executive_snapshot' | 'audit_evidence'

/* ── Data gatherer ────────────────────────────────────────── */

async function gatherReportData(sb: ReturnType<typeof getServerClient>, start: string, end: string) {
  const dateFilter = (q: any, col: string) => q.gte(col, start).lte(col, end)

  // Signals in period
  const { data: signals, count: signalCount } = await dateFilter(
    sb.from('items').select('id, title, state, detected_at, source_id, sources(name, source_type)', { count: 'exact' }).eq('workspace_id', WS),
    'detected_at'
  )

  // Classifications
  const signalIds = (signals || []).map((s: any) => s.id)
  const { data: classifications } = signalIds.length > 0
    ? await sb.from('item_classifications').select('*').in('item_id', signalIds)
    : { data: [] }

  // Reviews in period
  const { data: reviews, count: reviewCount } = await dateFilter(
    sb.from('item_reviews').select('*', { count: 'exact' }).eq('workspace_id', WS),
    'created_at'
  )

  // Cases in period
  const { data: cases } = await dateFilter(
    sb.from('cases').select('*').eq('workspace_id', WS),
    'created_at'
  )

  // All open cases (regardless of period)
  const { data: openCases } = await sb
    .from('cases')
    .select('id, title, priority, status, due_date, created_at')
    .eq('workspace_id', WS)
    .neq('status', 'closed')

  // Evidence in period
  const { data: evidence } = await dateFilter(
    sb.from('evidence_records').select('*').eq('workspace_id', WS),
    'created_at'
  )

  // Controls
  const { data: controls } = await sb
    .from('internal_controls')
    .select('id, name, ref, status, type, next_review_at, owner_name, departments')
    .eq('workspace_id', WS)

  // Signal matches in period
  const { data: matches } = signalIds.length > 0
    ? await sb.from('signal_matches').select('*').in('item_id', signalIds)
    : { data: [] }

  // Drafted actions in period
  const { data: draftedActions } = await dateFilter(
    sb.from('drafted_actions').select('*'),
    'created_at'
  )

  // Source breakdown
  const sourceBreakdown: Record<string, number> = {}
  for (const s of signals || []) {
    const name = (s as any).sources?.name || 'Unknown'
    sourceBreakdown[name] = (sourceBreakdown[name] || 0) + 1
  }

  // Impact breakdown
  const impactBreakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const c of classifications || []) {
    const level = String((c as any).impact_level)
    impactBreakdown[level] = (impactBreakdown[level] || 0) + 1
  }

  // Review stats
  const reviewStats = { reviewed: 0, escalated: 0, dismissed: 0 }
  for (const r of reviews || []) {
    const s = (r as any).review_status as keyof typeof reviewStats
    if (s in reviewStats) reviewStats[s]++
  }

  // Control stats
  const now = new Date()
  const controlStats = { total: 0, active: 0, due_soon: 0, overdue: 0 }
  for (const c of controls || []) {
    controlStats.total++
    const next = (c as any).next_review_at ? new Date((c as any).next_review_at) : null
    if (next && next < now) controlStats.overdue++
    else if (next && next.getTime() - now.getTime() < 30 * 86400000) controlStats.due_soon++
    else controlStats.active++
  }

  return {
    period: { start, end },
    signals: signals || [],
    signalCount: signalCount || 0,
    classifications: classifications || [],
    reviews: reviews || [],
    reviewCount: reviewCount || 0,
    reviewStats,
    cases: cases || [],
    openCases: openCases || [],
    evidence: evidence || [],
    controls: controls || [],
    controlStats,
    matches: matches || [],
    draftedActions: draftedActions || [],
    sourceBreakdown,
    impactBreakdown,
  }
}

/* ── Template renderers ───────────────────────────────────── */

function renderMonthlyMonitoring(data: Awaited<ReturnType<typeof gatherReportData>>) {
  const { period, signalCount, reviewStats, sourceBreakdown, impactBreakdown, controlStats, cases, openCases } = data
  return {
    title: `Monthly Monitoring Summary`,
    subtitle: `${new Date(period.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    sections: [
      {
        heading: 'Overview',
        content: `During this period, ${signalCount} regulatory signals were detected. Of these, ${reviewStats.reviewed} were reviewed, ${reviewStats.escalated} escalated, and ${reviewStats.dismissed} dismissed. ${cases.length} new case(s) were created.`,
      },
      {
        heading: 'Signal Sources',
        table: { headers: ['Source', 'Count'], rows: Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]) },
      },
      {
        heading: 'Impact Distribution',
        table: { headers: ['Level', 'Count'], rows: [['L4 — Critical', String(impactBreakdown['4'])], ['L3 — High', String(impactBreakdown['3'])], ['L2 — Medium', String(impactBreakdown['2'])], ['L1 — Low', String(impactBreakdown['1'])]] },
      },
      {
        heading: 'Controls Health',
        content: `${controlStats.total} controls registered. ${controlStats.active} active, ${controlStats.due_soon} due for review within 30 days, ${controlStats.overdue} overdue.`,
      },
      {
        heading: 'Open Cases',
        content: openCases.length === 0 ? 'No open cases.' : undefined,
        table: openCases.length > 0 ? { headers: ['Case', 'Priority', 'Status', 'Due'], rows: openCases.map((c: any) => [c.title, c.priority, c.status, c.due_date ? new Date(c.due_date).toLocaleDateString('en-GB') : '—']) } : undefined,
      },
    ],
  }
}

function renderGtcoMetrics(data: Awaited<ReturnType<typeof gatherReportData>>) {
  const { period, signalCount, reviewStats, controlStats, cases, evidence } = data
  const casesCreated = cases.length
  const casesClosed = cases.filter((c: any) => c.status === 'closed').length
  return {
    title: 'GTCO Metrics Support Pack',
    subtitle: `${new Date(period.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    sections: [
      {
        heading: 'Key Metrics',
        table: {
          headers: ['Metric', 'Value'],
          rows: [
            ['Regulatory signals detected', String(signalCount)],
            ['Signals reviewed', String(reviewStats.reviewed)],
            ['Signals escalated', String(reviewStats.escalated)],
            ['Cases created', String(casesCreated)],
            ['Cases closed', String(casesClosed)],
            ['Controls active', String(controlStats.active)],
            ['Controls overdue', String(controlStats.overdue)],
            ['Evidence records', String(evidence.length)],
          ],
        },
      },
      {
        heading: 'Response Rate',
        content: signalCount > 0
          ? `${Math.round(((reviewStats.reviewed + reviewStats.escalated + reviewStats.dismissed) / signalCount) * 100)}% of signals triaged.`
          : 'No signals in period.',
      },
      {
        heading: 'Control Review Compliance',
        content: controlStats.total > 0
          ? `${Math.round((controlStats.active / controlStats.total) * 100)}% of controls are current. ${controlStats.overdue} require immediate review.`
          : 'No controls registered.',
      },
    ],
  }
}

function renderExecutiveSnapshot(data: Awaited<ReturnType<typeof gatherReportData>>) {
  const { period, signalCount, reviewStats, impactBreakdown, openCases, controlStats } = data
  const criticalSignals = impactBreakdown['4'] + impactBreakdown['3']
  const criticalCases = openCases.filter((c: any) => c.priority === 'critical' || c.priority === 'high')
  return {
    title: 'Executive Snapshot',
    subtitle: `${new Date(period.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    sections: [
      {
        heading: 'Headline',
        content: `${signalCount} signals monitored. ${criticalSignals} high/critical impact. ${reviewStats.escalated} escalated. ${openCases.length} cases open (${criticalCases.length} high priority).`,
      },
      {
        heading: 'Key Risks',
        content: criticalCases.length === 0 ? 'No high-priority open cases.' : undefined,
        table: criticalCases.length > 0 ? { headers: ['Case', 'Priority', 'Due'], rows: criticalCases.slice(0, 5).map((c: any) => [c.title, c.priority, c.due_date ? new Date(c.due_date).toLocaleDateString('en-GB') : '—']) } : undefined,
      },
      {
        heading: 'Control Health',
        content: `${controlStats.overdue} controls overdue. ${controlStats.due_soon} due within 30 days.`,
      },
      {
        heading: 'Recommendation',
        content: controlStats.overdue > 0
          ? `Priority review needed for ${controlStats.overdue} overdue control(s). Escalation recommended if not addressed within current cycle.`
          : 'All controls current. Continue monitoring.',
      },
    ],
  }
}

function renderAuditEvidence(data: Awaited<ReturnType<typeof gatherReportData>>) {
  const { period, evidence, signalCount, reviewStats, cases } = data
  const evidenceByType: Record<string, number> = {}
  for (const e of evidence) {
    const t = (e as any).action_type
    evidenceByType[t] = (evidenceByType[t] || 0) + 1
  }
  return {
    title: 'Audit Evidence Summary',
    subtitle: `${new Date(period.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    sections: [
      {
        heading: 'Evidence Overview',
        content: `${evidence.length} evidence records generated during this period across ${Object.keys(evidenceByType).length} checkpoint types.`,
      },
      {
        heading: 'Evidence by Checkpoint',
        table: {
          headers: ['Checkpoint', 'Count'],
          rows: Object.entries(evidenceByType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k.replace(/_/g, ' '), String(v)]),
        },
      },
      {
        heading: 'Monitoring Activity',
        table: {
          headers: ['Activity', 'Count'],
          rows: [
            ['Signals detected', String(signalCount)],
            ['Signals triaged', String(reviewStats.reviewed + reviewStats.escalated + reviewStats.dismissed)],
            ['Cases created', String(cases.length)],
          ],
        },
      },
      {
        heading: 'Completeness',
        content: signalCount > 0
          ? `Triage coverage: ${Math.round(((reviewStats.reviewed + reviewStats.escalated + reviewStats.dismissed) / signalCount) * 100)}%`
          : 'No signals in period.',
      },
    ],
  }
}

/* ── Routes ───────────────────────────────────────────────── */

// POST /api/reports — generate report
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  const template: Template = body.template
  const start: string = body.period_start
  const end: string = body.period_end

  if (!template || !start || !end) {
    return NextResponse.json({ error: 'template, period_start, period_end required' }, { status: 400 })
  }

  const data = await gatherReportData(sb, start, end)

  let report
  switch (template) {
    case 'monthly_monitoring': report = renderMonthlyMonitoring(data); break
    case 'gtco_metrics':       report = renderGtcoMetrics(data); break
    case 'executive_snapshot': report = renderExecutiveSnapshot(data); break
    case 'audit_evidence':     report = renderAuditEvidence(data); break
    default: return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  // Record in generated_reports
  // First ensure reporting_period exists
  const { data: period } = await sb
    .from('reporting_periods')
    .upsert({ workspace_id: WS, period_start: start, period_end: end, status: 'active' }, { onConflict: 'workspace_id,period_start,period_end' })
    .select()
    .single()

  if (period) {
    await sb.from('generated_reports').insert({
      reporting_period_id: period.id,
      template,
      generated_by: 'operator',
    })
  }

  // Evidence
  await sb.from('evidence_records').insert({
    workspace_id: WS,
    action_type: 'report_generated',
    entity_type: 'report',
    entity_id: period?.id || 'unknown',
    actor: 'operator',
    metadata: { template, period_start: start, period_end: end },
  }).then(() => {}, console.error)

  return NextResponse.json({ report, raw: data })
}

// POST /api/reports/export — log export event
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  await sb.from('evidence_records').insert({
    workspace_id: WS,
    action_type: 'report_exported',
    entity_type: 'report',
    entity_id: body.period_id || 'unknown',
    actor: 'operator',
    metadata: { template: body.template, format: body.format },
  }).then(() => {}, console.error)

  return NextResponse.json({ ok: true })
}
