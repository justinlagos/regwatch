import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/watchlists/terms — add term to watchlist
// Body: { watchlist_id, term, match_type? }
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { watchlist_id, term, match_type } = await req.json()

  if (!watchlist_id || !term?.trim()) {
    return NextResponse.json({ error: 'watchlist_id and term required' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('watchlist_terms')
    .insert({ watchlist_id, term: term.trim(), match_type: match_type || 'keyword' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/watchlists/terms?id=xxx — remove term
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await sb.from('watchlist_terms').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
