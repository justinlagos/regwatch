import { getServerClient } from '@/lib/supabase'
import { matchSignal } from '@/lib/matching'
import { NextRequest, NextResponse } from 'next/server'

const WS = '00000000-0000-0000-0000-000000000001'

// GET /api/signal-matches?item_id=xxx — get matches for a signal
export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const itemId = req.nextUrl.searchParams.get('item_id')

  if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  const { data: matches } = await sb
    .from('signal_matches')
    .select('*, internal_controls(id, name, ref)')
    .eq('item_id', itemId)
    .order('confidence_score', { ascending: false })

  return NextResponse.json(matches || [])
}

// POST /api/signal-matches/run — run matching engine for a signal (or batch)
// Body: { item_id: string } or { item_ids: string[] }
export async function POST(req: NextRequest) {
  const sb = getServerClient()
  const body = await req.json()
  const itemIds: string[] = body.item_ids || (body.item_id ? [body.item_id] : [])

  if (itemIds.length === 0) {
    return NextResponse.json({ error: 'item_id or item_ids required' }, { status: 400 })
  }

  // Load all watchlist terms
  const { data: watchlists } = await sb
    .from('watchlists')
    .select('id, watchlist_terms(watchlist_id, term)')
    .eq('workspace_id', WS)

  const allWlTerms = (watchlists || []).flatMap((wl: any) =>
    (wl.watchlist_terms || []).map((t: any) => ({ watchlist_id: t.watchlist_id, term: t.term }))
  )

  // Load all control keywords
  const { data: keywords } = await sb
    .from('control_keywords')
    .select('control_id, keyword')

  const allCtrlKw = (keywords || []).map((k: any) => ({ control_id: k.control_id, keyword: k.keyword }))

  // Load the signals
  const { data: items } = await sb
    .from('items')
    .select('id, title, extracted_text')
    .in('id', itemIds)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items found' }, { status: 404 })
  }

  let totalInserted = 0

  for (const item of items) {
    const matches = matchSignal(
      { title: item.title, extracted_text: item.extracted_text },
      allWlTerms,
      allCtrlKw
    )

    // Upsert into signal_matches
    for (const m of matches) {
      if (m.type === 'control') {
        const { error } = await sb.from('signal_matches').upsert(
          {
            item_id: item.id,
            control_id: m.ref_id,
            match_tier: m.match_tier,
            confidence_score: m.confidence_score,
            matched_keyword: m.term,
            explanation: `Keyword "${m.term}" found in signal ${m.matched_in}`,
          },
          { onConflict: 'item_id,control_id' }
        )
        if (!error) totalInserted++
      }
      // Watchlist matches are informational — we don't store them in signal_matches
      // (signal_matches links signals to controls only)
    }
  }

  return NextResponse.json({
    processed: items.length,
    matches_written: totalInserted,
  })
}
