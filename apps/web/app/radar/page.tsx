import { getServerClient, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'
import FilterBar from '../items/FilterBar'
import { matchSignal } from '@/lib/matching'
import { SectionHeader } from '@/app/components/ui'

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
    <div className="space-y-4">
      <SectionHeader
        title="Radar"
        subtitle={q ? `${count?.toLocaleString()} results for "${q}"` : `${count?.toLocaleString()} classified signals`}
      />

      <FilterBar
        sources={sources || []}
        watchlists={(watchlists || []).map((w: any) => ({ id: w.id, name: w.name }))}
        currentLevel={level}
        currentSource={sourceFilter}
        currentQ={q}
        currentWatchlist={watchlistFilter}
        basePath="/radar"
      />

      {/* Table */}
      <div className="rw-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rw-table">
            <thead>
              <tr>
                <th className="w-16">Level</th>
                <th>Signal</th>
                <th className="w-32">Source</th>
                <th className="w-28">Detected</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-[13px]">No signals found</td></tr>
              )}
              {filtered.map((item: any) => {
                const cls = item.classifications?.[0]
                const itemLevel = cls?.impact_level
                return (
                  <tr key={item.id}>
                    <td>
                      {itemLevel && (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${IMPACT_COLORS[itemLevel]}`}>
                          L{itemLevel}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link href={`/radar/${item.id}`} className="text-[13px] font-medium text-slate-800 hover:text-blue-600 line-clamp-2">
                        {item.title || 'Untitled'}
                      </Link>
                      {cls?.summary && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cls.summary}</p>
                      )}
                      {item.watchlistHits.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.watchlistHits.map((h: any, i: number) => (
                            <span key={i} className="rw-badge bg-indigo-50 text-indigo-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                              {h.watchlist_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="text-[12px] text-slate-500">{(item.sources as any)?.name}</td>
                    <td className="text-[12px] text-slate-500 whitespace-nowrap">
                      {new Date(item.detected_at).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {page > 1 && (
            <Link href={`/radar?page=${page - 1}${level ? `&level=${level}` : ''}${sourceFilter ? `&source=${sourceFilter}` : ''}${watchlistFilter ? `&watchlist=${watchlistFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="rw-btn-secondary">Prev</Link>
          )}
          <span className="px-3 py-1.5 text-[12px] text-slate-400">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/radar?page=${page + 1}${level ? `&level=${level}` : ''}${sourceFilter ? `&source=${sourceFilter}` : ''}${watchlistFilter ? `&watchlist=${watchlistFilter}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="rw-btn-secondary">Next</Link>
          )}
        </div>
      )}
    </div>
  )
}
