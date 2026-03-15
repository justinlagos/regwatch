import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/watchlists — list all watchlists with terms
// GET /api/watchlists?id=xxx — single watchlist with terms
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const { data, error } = await sb
      .from('watchlists')
      .select('*, watchlist_terms(*)')
      .eq('id', id)
      .eq('workspace_id', WS)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data } = await sb
    .from('watchlists')
    .select('*, watchlist_terms(id, term, match_type)')
    .eq('workspace_id', WS)
    .order('created_at')

  return NextResponse.json(data || [])
}

// POST /api/watchlists — create watchlist (optionally with terms)
// Body: { name, description?, terms?: string[] }
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const { name, description, terms } = await req.json()

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const { data: wl, error } = await sb
    .from('watchlists')
    .insert({ workspace_id: WS, name, description })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Insert terms if provided
  if (terms && Array.isArray(terms) && terms.length > 0) {
    const termRows = terms
      .filter((t: string) => t.trim())
      .map((t: string) => ({ watchlist_id: wl.id, term: t.trim(), match_type: 'keyword' }))

    if (termRows.length > 0) {
      await sb.from('watchlist_terms').insert(termRows)
    }
  }

  // Re-fetch with terms
  const { data: full } = await sb
    .from('watchlists')
    .select('*, watchlist_terms(id, term, match_type)')
    .eq('id', wl.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}

// PATCH /api/watchlists — update watchlist name/description
// Body: { id, name?, description? }
export async function PATCH(req: NextRequest) {
  const sb = getServerClient()
  const { id, name, description } = await req.json()

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description

  const { data, error } = await sb
    .from('watchlists')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', WS)
    .select('*, watchlist_terms(id, term, match_type)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE /api/watchlists?id=xxx — delete watchlist (cascades terms)
export async function DELETE(req: NextRequest) {
  const sb = getServerClient()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await sb.from('watchlists').delete().eq('id', id).eq('workspace_id', WS)
  return NextResponse.json({ ok: true })
}
