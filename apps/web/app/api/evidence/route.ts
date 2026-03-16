import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'
const PAGE_SIZE = 50

// GET /api/evidence — list evidence records with filters
// ?action_type=xxx — filter by action type
// ?entity_type=xxx — filter by entity type (case, signal, drafted_action, report)
// ?from=yyyy-mm-dd — filter from date
// ?to=yyyy-mm-dd — filter to date
// ?page=n — pagination (0-based)
// ?id=xxx — single record with linked entities
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const params = req.nextUrl.searchParams

  const id = params.get('id')

  // Single record detail with linked entities
  if (id) {
    const { data: record, error } = await sb
      .from('evidence_records')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', WS)
      .single()

    if (error || !record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Load linked entity based on entity_type
    let linkedEntity: any = null
    if (record.entity_type === 'case') {
      const { data } = await sb
        .from('cases')
        .select('id, title, status, priority, created_at, items(id, title)')
        .eq('id', record.entity_id)
        .single()
      linkedEntity = data
    } else if (record.entity_type === 'signal' || record.entity_type === 'item') {
      const { data } = await sb
        .from('items')
        .select('id, title, state, detected_at, sources(name)')
        .eq('id', record.entity_id)
        .single()
      linkedEntity = data
    } else if (record.entity_type === 'drafted_action') {
      const { data } = await sb
        .from('drafted_actions')
        .select('id, action_type, subject, status, case_id, cases(id, title)')
        .eq('id', record.entity_id)
        .single()
      linkedEntity = data
    } else if (record.entity_type === 'report') {
      const { data } = await sb
        .from('reporting_periods')
        .select('id, period_start, period_end, status')
        .eq('id', record.entity_id)
        .single()
      linkedEntity = data
    }

    return NextResponse.json({ record, linkedEntity })
  }

  // List with filters
  const actionType = params.get('action_type')
  const entityType = params.get('entity_type')
  const from = params.get('from')
  const to = params.get('to')
  const page = parseInt(params.get('page') || '0')

  let query = sb
    .from('evidence_records')
    .select('*', { count: 'exact' })
    .eq('workspace_id', WS)
    .order('created_at', { ascending: false })

  if (actionType) query = query.eq('action_type', actionType)
  if (entityType) query = query.eq('entity_type', entityType)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')

  query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get distinct action types for filter options
  const { data: types } = await sb
    .from('evidence_records')
    .select('action_type')
    .eq('workspace_id', WS)

  const actionTypes = Array.from(new Set((types || []).map((t: any) => t.action_type))).sort()

  return NextResponse.json({
    records: data || [],
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
    actionTypes,
  })
}
