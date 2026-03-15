import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { control_id, regulation_name, section_ref } = await req.json()
  if (!control_id || !regulation_name?.trim()) return NextResponse.json({ error: 'control_id and regulation_name required' }, { status: 400 })

  const { data, error } = await sb.from('control_regulations')
    .insert({ control_id, regulation_name: regulation_name.trim(), section_ref: section_ref || null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await sb.from('control_regulations').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
