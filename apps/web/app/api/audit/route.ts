import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const item_id = searchParams.get('item_id')
    if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

    const sb = getServerClient()
    const { data, error } = await sb
      .from('audit_log')
      .select('*')
      .eq('item_id', item_id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data || [] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
