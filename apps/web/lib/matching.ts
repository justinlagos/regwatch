/**
 * Watchlist + Control keyword matching engine.
 *
 * Runs server-side. Checks signal title + extracted_text against:
 *   1. Watchlist terms → produces watchlist matches
 *   2. Control keywords → produces control matches
 *
 * Returns match objects with tier + score per the plan:
 *   - Direct (80-100): exact term found in title
 *   - Context (50-79): term found in body/extracted text
 *   - Weak (1-49): partial overlap (substring in a longer phrase)
 */

export interface MatchResult {
  type: 'watchlist' | 'control'
  ref_id: string            // watchlist_id or control_id
  term: string              // the matched term
  match_tier: 'direct' | 'context' | 'weak'
  confidence_score: number
  matched_in: 'title' | 'body'
}

/**
 * Run matching for a single signal against all terms.
 */
export function matchSignal(
  signal: { title: string | null; extracted_text: string | null },
  watchlistTerms: { watchlist_id: string; term: string }[],
  controlKeywords: { control_id: string; keyword: string }[]
): MatchResult[] {
  const results: MatchResult[] = []
  const title = (signal.title || '').toLowerCase()
  const body = (signal.extracted_text || '').toLowerCase()

  // Match watchlist terms
  for (const wt of watchlistTerms) {
    const term = wt.term.toLowerCase()
    if (!term) continue

    if (title.includes(term)) {
      results.push({
        type: 'watchlist',
        ref_id: wt.watchlist_id,
        term: wt.term,
        match_tier: 'direct',
        confidence_score: 90,
        matched_in: 'title',
      })
    } else if (body.includes(term)) {
      results.push({
        type: 'watchlist',
        ref_id: wt.watchlist_id,
        term: wt.term,
        match_tier: 'context',
        confidence_score: 60,
        matched_in: 'body',
      })
    }
    // Weak: check if any word in the term appears as substring
    else {
      const words = term.split(/\s+/).filter(w => w.length >= 4)
      const hasPartial = words.some(w => title.includes(w) || body.includes(w))
      if (hasPartial) {
        results.push({
          type: 'watchlist',
          ref_id: wt.watchlist_id,
          term: wt.term,
          match_tier: 'weak',
          confidence_score: 30,
          matched_in: title.includes(words[0]) ? 'title' : 'body',
        })
      }
    }
  }

  // Match control keywords
  for (const ck of controlKeywords) {
    const kw = ck.keyword.toLowerCase()
    if (!kw) continue

    if (title.includes(kw)) {
      results.push({
        type: 'control',
        ref_id: ck.control_id,
        term: ck.keyword,
        match_tier: 'direct',
        confidence_score: 85,
        matched_in: 'title',
      })
    } else if (body.includes(kw)) {
      results.push({
        type: 'control',
        ref_id: ck.control_id,
        term: ck.keyword,
        match_tier: 'context',
        confidence_score: 55,
        matched_in: 'body',
      })
    }
  }

  // Deduplicate: keep highest score per ref_id
  const bestByRef = new Map<string, MatchResult>()
  for (const r of results) {
    const key = `${r.type}:${r.ref_id}`
    const existing = bestByRef.get(key)
    if (!existing || r.confidence_score > existing.confidence_score) {
      bestByRef.set(key, r)
    }
  }

  return Array.from(bestByRef.values()).sort((a, b) => b.confidence_score - a.confidence_score)
}
