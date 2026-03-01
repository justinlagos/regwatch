import { getServerClient, IMPACT_LABELS, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

async function getStats() {
  const sb = getServerClient()

  const [
    { count: total },
    { count: classified },
    { count: failed },
    { count: level4 },
    { data: sources },
    { data: recent },
  ] = await Promise.all([
    sb.from('items').select('*', { count: 'exact', head: true }),
    sb.from('items').select('*', { count: 'exact', head: true }).eq('state', 'classified'),
    sb.from('items').select('*', { count: 'exact', head: true }).eq('state', 'classification_failed'),
    sb.from('classifications').select('*', { count: 'exact', head: true }).eq('impact_level', '4'),
    sb.from('sources').select('name, state, last_fetched_at, kind, source_type').order('name'),
    sb.from('items')
      .select('id, title, detected_at, canonical_url, sources(name), classifications(impact_level, summary)')
      .eq('state', 'classified')
      .order('detected_at', { ascending: false })
      .limit(10),
  ])

  const { data: levelBreakdown } = await sb
    .from('classifications')
    .select('impact_level')

  const levels: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const row of levelBreakdown || []) {
    levels[row.impact_level] = (levels[row.impact_level] || 0) + 1
  }

  return { total, classified, failed, level4, sources, recent, levels }
}

export default async function Dashboard() {
  const { total, classified, failed, level4, sources, recent, levels } = await getStats()

  const statCards = [
    { label: 'Total Items', value: total ?? 0, color: 'text-slate-800' },
    { label: 'Classified', value: classified ?? 0, color: 'text-green-700' },
    { label: 'High Impact (L4)', value: level4 ?? 0, color: 'text-red-600' },
    { label: 'Failed', value: failed ?? 0, color: 'text-orange-600' },
  ]

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Regulatory intelligence overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <p className="text-xs sm:text-sm text-gray-500">{card.label}</p>
            <p className={`text-2xl sm:text-3xl font-bold mt-1 ${card.color}`}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Impact breakdown — 2 cols on mobile, 4 on desktop */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-3 sm:mb-4">Impact Level Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {['4', '3', '2', '1'].map(level => (
            <Link key={level} href={`/items?level=${level}`} className="block group">
              <div className={`rounded-lg p-3 sm:p-4 text-center border-2 hover:shadow-md transition-shadow ${IMPACT_COLORS[level]} border-transparent`}>
                <p className="text-xl sm:text-2xl font-bold">{levels[level] ?? 0}</p>
                <p className="text-xs font-medium mt-1">L{level} — {IMPACT_LABELS[level]}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent items */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent Items</h2>
            <Link href="/items" className="text-sm text-blue-600 hover:underline">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(recent || []).map((item: any) => {
              const cls = item.classifications?.[0]
              return (
                <Link key={item.id} href={`/items/${item.id}`}
                  className="flex items-start gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors group">
                  {cls?.impact_level && (
                    <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${IMPACT_COLORS[cls.impact_level]}`}>
                      L{cls.impact_level}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-blue-600">{item.title || 'Untitled'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(item.sources as any)?.name} · {new Date(item.detected_at).toLocaleDateString()}
                    </p>
                    {cls?.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{cls.summary}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Sources */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-slate-800">Sources</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(sources || []).map((src: any) => (
              <div key={src.name} className="px-4 sm:px-6 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">{src.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    src.state === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>{src.state}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {src.source_type} · {src.last_fetched_at
                    ? `Last fetched ${new Date(src.last_fetched_at).toLocaleDateString()}`
                    : 'Not yet fetched'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
