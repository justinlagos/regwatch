import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

/**
 * GET /api/controls
 *   - No params: list all controls with keywords, regulations, and computed status
 *   - ?item_id=xxx: list all controls + mappings for a specific signal
 *   - ?id=xxx: get single control detail with keywords + regulations + linked signals
 */
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const item_id = req.nextUrl.searchParams.get('item_id')
  const controlId = req.nextUrl.searchParams.get('id')

  // Single control detail
  if (controlId) {
    const { data: control, error } = await sb
      .from('internal_controls')
      .select('*')
      .eq('id', controlId)
      .eq('workspace_id', WS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })

    const [
      { data: keywords },
      { data: regulations },
      { data: matches },
      { data: mappings },
    ] = await Promise.all([
      sb.from('control_keywords').select('*').eq('control_id', controlId).order('created_at'),
      sb.from('control_regulations').select('*').eq('control_id', controlId).order('created_at'),
      sb.from('signal_matches').select('*, items(id, title, detected_at)').eq('control_id', controlId).order('confidence_score', { ascending: false }),
      sb.from('control_mappings').select('*, items(id, title)').eq('control_id', controlId),
    ])

    return NextResponse.json({
      ...computeControlStatus(control),
      keywords: keywords || [],
      regulations: regulations || [],
      signal_matches: matches || [],
      mappings: mappings || [],
    })
  }

  // All controls (register view)
  const { data: controls } = await sb
    .from('internal_controls')
    .select('*')
    .eq('workspace_id', WS)
    .order('ref')

  if (item_id) {
    const { data: mappings } = await sb
      .from('control_mappings')
      .select('*, internal_controls(*)')
      .eq('item_id', item_id)
      .eq('workspace_id', WS)

    return NextResponse.json({
      controls: (controls || []).map(computeControlStatus),
      mappings: mappings || [],
    })
  }

  // Enrich with keyword/regulation counts
  const controlIds = (controls || []).map(c => c.id)

  const [
    { data: kwCounts },
    { data: regCounts },
    { data: matchCounts },
  ] = await Promise.all([
    sb.from('control_keywords').select('control_id').in('control_id', controlIds),
    sb.from('control_regulations').select('control_id').in('control_id', controlIds),
    sb.from('signal_matches').select('control_id').in('control_id', controlIds),
  ])

  const kwMap = countBy(kwCounts || [], 'control_id')
  const regMap = countBy(regCounts || [], 'control_id')
  const matchMap = countBy(matchCounts || [], 'control_id')

  const enriched = (controls || []).map(c => ({
    ...computeControlStatus(c),
    keyword_count: kwMap[c.id] || 0,
    regulation_count: regMap[c.id] || 0,
    match_count: matchMap[c.id] || 0,
  }))

  return NextResponse.json(enriched)
}

/**
 * POST /api/controls
 *   - { action: 'create', ...fields } — create new control
 *   - { item_id, control_id, ... } — legacy: map item to control (backward compat)
 */
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  if (body.action === 'create') {
    const { data, error } = await sb
      .from('internal_controls')
      .insert({
        workspace_id: WS,
        name: body.name,
        description: body.description || null,
        framework: body.framework || 'Custom',
        ref: body.ref || null,
        type: body.type || 'policy',
        owner_name: body.owner_name || null,
        owner_email: body.owner_email || null,
        review_cycle: body.review_cycle || '12 months',
        departments: body.departments || [],
        status: 'active',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  }

  // Legacy: map item to control
  const { item_id, control_id, notes, mapped_by } = body
  const { data, error } = await sb.from('control_mappings').upsert(
    { item_id, control_id, workspace_id: WS, notes, mapped_by, status: 'mapped' },
    { onConflict: 'item_id,control_id' }
  ).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/controls
 *   - { id, ...fields } — update control register fields
 *   - { id, status, notes } (with no 'type' or 'name') — legacy: update mapping
 */
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  // Detect if this is a control update (has name/type/owner_name) vs mapping update
  if (body.name || body.type || body.owner_name !== undefined || body.review_cycle || body.departments) {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    const fields = ['name', 'description', 'framework', 'ref', 'type', 'owner_name', 'owner_email',
                    'review_cycle', 'last_reviewed_at', 'next_review_at', 'status', 'departments']
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f]
    }

    const { data, error } = await sb
      .from('internal_controls')
      .update(updates)
      .eq('id', body.id)
      .eq('workspace_id', WS)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  }

  // Legacy: update mapping
  const { id, status, notes } = body
  const { data, error } = await sb
    .from('control_mappings')
    .update({ status, notes })
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/controls?id=xxx — remove mapping (legacy)
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  await sb.from('control_mappings').delete().eq('id', id!)
  return NextResponse.json({ ok: true })
}

// ─── Helpers ──────────────────────────────────────────────

function computeControlStatus(control: any) {
  if (!control.next_review_at) return control

  const now = new Date()
  const next = new Date(control.next_review_at)
  const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  let computed_status = control.status
  if (control.status !== 'archived') {
    if (diffDays < 0) computed_status = 'overdue'
    else if (diffDays <= 30) computed_status = 'due_soon'
    else computed_status = 'active'
  }

  return { ...control, status: computed_status }
}

function countBy(rows: any[], key: string): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) {
    map[r[key]] = (map[r[key]] || 0) + 1
  }
  return map
}
