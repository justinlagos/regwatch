import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/drafted-actions?case_id=xxx — list actions for a case
// GET /api/drafted-actions?id=xxx — single action
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  const caseId = req.nextUrl.searchParams.get('case_id')

  if (id) {
    const { data, error } = await sb
      .from('drafted_actions')
      .select('*, cases(id, title, item_id, items(id, title))')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 })

  const { data } = await sb
    .from('drafted_actions')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

// POST /api/drafted-actions — create a drafted action
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  if (!body.case_id || !body.action_type) {
    return NextResponse.json({ error: 'case_id and action_type required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('drafted_actions')
    .insert({
      case_id: body.case_id,
      action_type: body.action_type,
      recipient_name: body.recipient_name || null,
      recipient_email: body.recipient_email || null,
      subject: body.subject || null,
      body: body.body || null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Evidence: draft_created
  await sb.from('evidence_records').insert({
    workspace_id: WS,
    action_type: 'draft_created',
    entity_type: 'drafted_action',
    entity_id: data.id,
    actor: 'operator',
    metadata: { case_id: body.case_id, action_type: body.action_type },
  }).then(() => {}, console.error)

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/drafted-actions — update action (edit, mark ready, mark sent)
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  updates.updated_at = new Date().toISOString()

  // If marking as sent, set sent_at
  if (updates.status === 'sent' && !updates.sent_at) {
    updates.sent_at = new Date().toISOString()
  }

  const { data, error } = await sb
    .from('drafted_actions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Evidence: draft_sent when marking sent
  if (updates.status === 'sent') {
    await sb.from('evidence_records').insert({
      workspace_id: WS,
      action_type: 'draft_sent',
      entity_type: 'drafted_action',
      entity_id: id,
      actor: 'operator',
      metadata: { case_id: data.case_id, action_type: data.action_type, recipient_email: data.recipient_email },
    }).then(() => {}, console.error)
  }

  return NextResponse.json(data)
}

// DELETE /api/drafted-actions?id=xxx — delete a draft
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('drafted_actions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
