import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/controls?item_id=xxx  — list controls + mappings for item
// GET /api/controls              — list all controls
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const item_id = req.nextUrl.searchParams.get('item_id')

  const { data: controls } = await sb
    .from('internal_controls')
    .select('*')
    .eq('workspace_id', WS)
    .order('ref')

  if (!item_id) return NextResponse.json(controls || [])

  const { data: mappings } = await sb
    .from('control_mappings')
    .select('*, internal_controls(*)')
    .eq('item_id', item_id)
    .eq('workspace_id', WS)

  return NextResponse.json({ controls: controls || [], mappings: mappings || [] })
}

// POST /api/controls — map item to control
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { item_id, control_id, notes, mapped_by } = await req.json()

  const { data, error } = await sb.from('control_mappings').upsert(
    { item_id, control_id, workspace_id: WS, notes, mapped_by, status: 'mapped' },
    { onConflict: 'item_id,control_id' }
  ).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// PATCH /api/controls — update mapping status
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const { id, status, notes } = await req.json()

  const { data, error } = await sb
    .from('control_mappings')
    .update({ status, notes })
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/controls?id=xxx — remove mapping
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  await sb.from('control_mappings').delete().eq('id', id!)
  return NextResponse.json({ ok: true })
}
