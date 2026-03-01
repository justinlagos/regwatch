import { getServerClient, IMPACT_LABELS, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

async function getStats() {
  const sb = getServerClient()

  const now = new Date()
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [
    { count: total },
    { count: classified },
    { count: failed },
    { count: level4 },
    { data: sources },
    { data: recent },
    { count: thisWeekHigh },
    { count: lastWeekHigh },
    { count: pendingReview },
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
    // Velocity: L3+L4 this week
    sb.from('items')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'classified')
      .gte('detected_at', weekAgo.toISOString())
      .in('id', (await sb.from('classifications').select('item_id').in('impact_level', ['3','4'])).data?.map((r:any) => r.item_id) || []),
    // Velocity: L3+L4 last week
    sb.from('items')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'classified')
      .gte('detected_at', twoWeeksAgo.toISOString())
      .lt('detected_at', weekAgo.toISOString())
      .in('id', (await sb.from('classifications').select('item_id').in('impact_level', ['3','4'])).data?.map((r:any) => r.item_id) || []),
    // Pending review: L3+L4 not yet reviewed
    sb.from('items')
      .select('id', { count: 'exact', head: true })
      .eq('state', 'classified')
      .not('id', 'in', `(${(await sb.from('item_reviews').select('item_id').eq('workspace_id','00000000-0000-0000-0000-000000000001')).data?.map((r:any) => r.item_id).join(',') || 'null'})`)
      .in('id', (await sb.from('classifications').select('item_id').in('impact_level', ['3','4'])).data?.map((r:any) => r.item_id) || []),
  ])

  const { data: levelBreakdown } = await sb
    .from('classifications')
    .select('impact_level')

  const levels: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const row of levelBreakdown || []) {
    levels[row.impact_level] = (levels[row.impact_level] || 0) + 1
  }

  // Velocity score: % change in high-impact items week over week
  const thisW  = thisWeekHigh ?? 0
  const lastW  = lastWeekHigh ?? 0
  const velocityPct = lastW === 0 ? 0 : Math.round(((thisW - lastW) / lastW) * 100)
  const velocityTrend: 'up' | 'down' | 'flat' = velocityPct > 10 ? 'up' : velocityPct < -10 ? 'down' : 'flat'

  return { total, classified, failed, level4, sources, recent, levels,
           thisWeekHigh: thisW, lastWeekHigh: lastW, velocityPct, velocityTrend,
           pendingReview: pendingReview ?? 0 }
}

const VELOCITY_CONFIG = {
  up:   { label: 'Rising',  icon: '↑', color: 'text-red-600',   bg: 'bg-red-50 border-red-100',   tip: 'High-impact signals increasing week-over-week' },
  down: { label: 'Easing',  icon: '↓', color: 'text-green-600', bg: 'bg-green-50 border-green-100', tip: 'High-impact signals decreasing week-over-week' },
  flat: { label: 'Steady',  icon: '→', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', tip: 'Threat landscape stable week-over-week' },
}

export default async function Dashboard() {
  const { total, classified, failed, level4, sources, recent, levels,
          thisWeekHigh, lastWeekHigh, velocityPct, velocityTrend,
          pendingReview } = await getStats()

  const vel = VELOCITY_CONFIG[velocityTrend]

  const statCards = [
    { label: 'Total Items',      value: total ?? 0,      color: 'text-slate-800' },
    { label: 'Classified',       value: classified ?? 0,  color: 'text-green-700' },
    { label: 'High Impact (L4)', value: level4 ?? 0,      color: 'text-red-600' },
    { label: 'Failed',           value: failed ?? 0,      color: 'text-orange-600' },
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

      {/* Velocity + Review row */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Velocity Score */}
        <div className={`rounded-xl border p-5 shadow-sm ${vel.bg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Regulatory Velocity</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-black ${vel.color}`}>
                  {vel.icon} {Math.abs(velocityPct)}%
                </span>
                <span className={`text-sm font-semibold ${vel.color}`}>{vel.label}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{vel.tip}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">This week</p>
              <p className="text-lg font-bold text-slate-700">{thisWeekHigh}</p>
              <p className="text-xs text-gray-400 mt-1">Last week</p>
              <p className="text-sm font-semibold text-slate-500">{lastWeekHigh}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">L3 + L4 signals, 7-day rolling window</p>
        </div>

        {/* Review Queue CTA */}
        <Link href="/review" className="block group">
          <div className={`rounded-xl border p-5 shadow-sm h-full transition-shadow hover:shadow-md ${
            pendingReview > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'
          }`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Review Queue</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-black ${pendingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {pendingReview}
              </span>
              <span className={`text-sm font-semibold ${pendingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {pendingReview > 0 ? 'items need action' : 'all clear'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {pendingReview > 0
                ? 'L3 + L4 items awaiting your review'
                : 'All high-impact items have been reviewed'}
            </p>
            <p className="text-xs text-blue-600 mt-3 group-hover:underline">Open review queue →</p>
          </div>
        </Link>
      </div>

      {/* Impact breakdown */}
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
