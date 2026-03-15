import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/cases — list all cases
// GET /api/cases?id=xxx — single case with stakeholders + notes
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const { data, error } = await sb
      .from('cases')
      .select('*, items(id, title), internal_controls(id, name, ref), case_stakeholders(*), case_notes(*)')
      .eq('id', id)
      .eq('workspace_id', WS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data } = await sb
    .from('cases')
    .select('*, items(id, title), internal_controls(id, name, ref)')
    .eq('workspace_id', WS)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

// POST /api/cases — create case (operator-confirmed only)
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  const { data: caseRow, error } = await sb
    .from('cases')
    .insert({
      workspace_id: WS,
      item_id: body.item_id || null,
      title: body.title,
      description: body.description || null,
      priority: body.priority || 'medium',
      status: 'open',
      owner_name: body.owner_name || null,
      owner_email: body.owner_email || null,
      due_date: body.due_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Write evidence record: case_created
  await sb.from('evidence_records').insert({
    workspace_id: WS,
    action_type: 'case_created',
    entity_type: 'case',
    entity_id: caseRow.id,
    actor: 'operator',
    metadata: { item_id: body.item_id, title: body.title, priority: body.priority },
  })

  return NextResponse.json(caseRow, { status: 201 })
}

// PATCH /api/cases — update case fields
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  updates.updated_at = new Date().toISOString()

  // Track status changes for evidence
  const oldStatus = updates._old_status
  delete updates._old_status

  if (updates.status === 'closed' && !updates.closed_at) {
    updates.closed_at = new Date().toISOString()
  }

  const { data, error } = await sb
    .from('cases')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', WS)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Evidence: case_status_changed or case_closed
  if (updates.status && updates.status !== oldStatus) {
    const actionType = updates.status === 'closed' ? 'case_closed' : 'case_status_changed'
    await sb.from('evidence_records').insert({
      workspace_id: WS,
      action_type: actionType,
      entity_type: 'case',
      entity_id: id,
      actor: 'operator',
      metadata: { old_status: oldStatus, new_status: updates.status },
    })
  }

  return NextResponse.json(data)
}
