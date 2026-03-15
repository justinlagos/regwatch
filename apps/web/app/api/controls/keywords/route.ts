import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { control_id, keyword } = await req.json()
  if (!control_id || !keyword?.trim()) return NextResponse.json({ error: 'control_id and keyword required' }, { status: 400 })

  const { data, error } = await sb.from('control_keywords')
    .insert({ control_id, keyword: keyword.trim() })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await sb.from('control_keywords').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
