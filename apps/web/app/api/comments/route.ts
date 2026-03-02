import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/comments?item_id=xxx
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const item_id = req.nextUrl.searchParams.get('item_id')
  if (!item_id) return NextResponse.json([], { status: 400 })

  const { data } = await sb
    .from('item_comments')
    .select('*')
    .eq('item_id', item_id)
    .eq('workspace_id', WS)
    .order('created_at', { ascending: true })

  return NextResponse.json(data || [])
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { item_id, author, body } = await req.json()
  if (!item_id || !author?.trim() || !body?.trim())
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data, error } = await sb
    .from('item_comments')
    .insert({ item_id, workspace_id: WS, author: author.trim(), body: body.trim() })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/comments?id=xxx
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  await sb.from('item_comments').delete().eq('id', id!)
  return NextResponse.json({ ok: true })
}
