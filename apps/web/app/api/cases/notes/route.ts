import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// POST /api/cases/notes — add note
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  if (!body.case_id || !body.content) {
    return NextResponse.json({ error: 'case_id and content required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('case_notes')
    .insert({
      case_id: body.case_id,
      author: body.author || 'operator',
      content: body.content,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Evidence: note added to case
  await sb.from('evidence_records').insert({
    workspace_id: WS,
    action_type: 'case_note_added',
    entity_type: 'case',
    entity_id: body.case_id,
    actor: body.author || 'operator',
    metadata: { note_id: data.id },
  }).then(() => {}, console.error)

  return NextResponse.json(data, { status: 201 })
}

// GET /api/cases/notes?case_id=xxx — list notes for a case
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const caseId = req.nextUrl.searchParams.get('case_id')

  if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 })

  const { data } = await sb
    .from('case_notes')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

// DELETE /api/cases/notes?id=xxx — remove note
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('case_notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
