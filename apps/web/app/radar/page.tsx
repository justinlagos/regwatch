import { getServerClient, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'
import FilterBar from '../items/FilterBar'
import { matchSignal } from '@/lib/matching'

export const revalidate = 60

interface Props {
  searchParams: { level?: string; source?: string; page?: string; q?: string; watchlist?: string }
}

export default async function RadarPage({ searchParams }: Props) {
  const sb = getServerClient()
  const WS = '00000000-0000-0000-0000-000000000001'
  const level = searchParams.level
  const sourceFilter = searchParams.source
  const q = searchParams.q
  const watchlistFilter = searchParams.watchlist
  const page = parseInt(searchParams.page || '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  const [
    { data: sources },
    { data: watchlists },
  ] = await Promise.all([
    sb.from('sources').select('id, name').order('name'),
    sb.from('watchlists').select('id, name, watchlist_terms(watchlist_id, term)').eq('workspace_id', WS),
  ])

  // Flatten all watchlist terms for matching
  const allWlTerms = (watchlists || []).flatMap((wl: any) =>
    (wl.watchlist_terms || []).map((t: any) => ({ watchlist_id: t.watchlist_id || wl.id, term: t.term }))
  )

  let query = sb
    .from('items')
    .select(`
      id, title, canonical_url, detected_at, state, extracted_text,
      sources(id, name, source_type),
      classifications(impact_level, summary, confidence_score)
    `, { count: 'exact' })
    .eq('state', 'classified')
    .order('detected_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (sourceFilter) query = query.eq('source_id', sourceFilter)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: items, count } = await query

  // Run lightweight watchlist matching on page results
  const itemsWithMatches = (items || []).map((item: any) => {
    const matches = matchSignal(
      { title: item.title, extracted_text: item.extracted_text },
      allWlTerms,
      []
    )
    const watchlistHits = matches
      .filter(m => m.type === 'watchlist' && m.match_tier === 'direct')
      .map(m => {
        const wl = (watchlists || []).find((w: any) => w.id === m.ref_id)
        return { watchlist_id: m.ref_id, watchlist_name: wl?.name || 'Unknown', term: m.term }
      })
    return { ...item, watchlistHits }
  })

  // Apply filters
  let filtered = level
    ? itemsWithMatches.filter((i: any) => i.classifications?.[0]?.impact_level === level)
    : itemsWithMatches

  if (watchlistFilter) {
    filtered = filtered.filter((i: any) =>
      i.watchlistHits.some((h: any) => h.watchlist_id === watchlistFilter)
    )
  }

  const totalPages = Math.ceil((count || 0) / pageSize)

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Radar</h1>
          <p className="text-slate-500 text-sm mt-1">
            {q ? `${count?.toLocaleString()} results for "${q}"` : `${count?.toLocaleString()} classified signals`}
          </p>
        </div>
      </div>

      <FilterBar
        sources={sources || []}
        watchlists={(watchlists || []).map((w: any) => ({ id: w.id, name: w.name }))}
        currentLevel={level}
        currentSource={sourceFilter}
        currentQ={q}
        currentWatchlist={watchlistFilter}
        basePath="/radar"
      />

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left w-20">Level</th>
                <th className="px-6 py-3 text-left">Signal</th>
                <th className="px-6 py-3 text-left w-36">Source</th>
                <th className="px-6 py-3 text-left w-28">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">No signals found</td></tr>
              )}
              {filtered.map((item: any) => {
                const cls = item.classifications?.[0]
                const itemLevel = cls?.impact_level
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {itemLevel && (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${IMPACT_COLORS[itemLevel]}`}>
                          L{itemLevel}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/radar/${item.id}`} className="font-medium text-slate-800 hover:text-blue-600 line-clamp-2">
                        {item.title || 'Untitled'}
                      </Link>
                      {cls?.summary && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{cls.summary}</p>
                      )}
                      {/* Watchlist hit badges */}
                      {item.watchlistHits.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {item.watchlistHits.map((h: any, i: number) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              {h.watchlist_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{(item.sources as any)?.name}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.detected_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No signals found</div>
        )}
        {filtered.map((item: any) => {
          const cls = item.classifications?.[0]
          const itemLevel = cls?.impact_level
          return (
            <Link key={item.id} href={`/radar/${item.id}`}
              className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 shadow-sm active:bg-gray-50">
              {itemLevel && (
                <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${IMPACT_COLORS[itemLevel]}`}>
                  L{itemLevel}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 line-clamp-2">{item.title || 'Untitled'}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(item.sources as any)?.name} · {new Date(item.detected_at).toLocaleDateString()}
                </p>
                {item.watchlistHits.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {item.watchlistHits.map((h: any, i: number) => (
                      <span key={i} className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">{h.watchlist_name}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {page > 1 && (
            <Link href={`/radar?page=${page - 1}${level ? `&level=${level}` : ''}${sourceFilter ? `&source=${sourceFilter}` : ''}${watchlistFilter ? `&watchlist=${watchlistFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Prev</Link>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/radar?page=${page + 1}${level ? `&level=${level}` : ''}${sourceFilter ? `&source=${sourceFilter}` : ''}${watchlistFilter ? `&watchlist=${watchlistFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Next</Link>
          )}
        </div>
      )}
    </div>
  )
}
