import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/cases/stakeholders — add stakeholder
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()

  if (!body.case_id || !body.name) {
    return NextResponse.json({ error: 'case_id and name required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('case_stakeholders')
    .insert({
      case_id: body.case_id,
      name: body.name,
      email: body.email || null,
      role: body.role || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/cases/stakeholders?id=xxx — remove stakeholder
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await sb.from('case_stakeholders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

// GET /api/cases/stakeholders?case_id=xxx — list stakeholders for a case
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const caseId = req.nextUrl.searchParams.get('case_id')

  if (!caseId) return NextResponse.json({ error: 'case_id required' }, { status: 400 })

  const { data } = await sb
    .from('case_stakeholders')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  return NextResponse.json(data || [])
}
