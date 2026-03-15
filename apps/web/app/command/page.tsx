import { getServerClient, IMPACT_LABELS, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

async function getStats() {
  const sb = getServerClient()

  const now = new Date()
  const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7)
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  const [high34Ids, reviewedIds] = await Promise.all([
    sb.from('classifications').select('item_id').in('impact_level', ['3','4']),
    sb.from('item_reviews').select('item_id').eq('workspace_id','00000000-0000-0000-0000-000000000001'),
  ])
  const h34 = high34Ids.data?.map((r:any) => r.item_id) || []
  const revd = reviewedIds.data?.map((r:any) => r.item_id) || []

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
    { count: lowConfidence },
    { data: confidenceData },
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
      .limit(40),
    h34.length
      ? sb.from('items').select('id', { count: 'exact', head: true })
          .eq('state', 'classified').gte('detected_at', weekAgo.toISOString()).in('id', h34)
      : Promise.resolve({ count: 0 }),
    h34.length
      ? sb.from('items').select('id', { count: 'exact', head: true })
          .eq('state', 'classified')
          .gte('detected_at', twoWeeksAgo.toISOString())
          .lt('detected_at', weekAgo.toISOString())
          .in('id', h34)
      : Promise.resolve({ count: 0 }),
    h34.length
      ? sb.from('items').select('id', { count: 'exact', head: true })
          .eq('state', 'classified')
          .not('id', 'in', `(${revd.join(',') || 'null'})`)
          .in('id', h34)
      : Promise.resolve({ count: 0 }),
    sb.from('classifications').select('*', { count: 'exact', head: true }).lt('confidence_score', 65),
    sb.from('classifications').select('confidence_score').not('confidence_score', 'is', null).limit(1000),
  ])

  const { data: levelBreakdown } = await sb
    .from('classifications')
    .select('impact_level')

  const levels: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const row of levelBreakdown || []) {
    levels[row.impact_level] = (levels[row.impact_level] || 0) + 1
  }

  const scores = (confidenceData || []).map((r: any) => r.confidence_score).filter(Boolean)
  const avgConfidence = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null

  const thisW  = thisWeekHigh ?? 0
  const lastW  = lastWeekHigh ?? 0
  const velocityPct = lastW === 0 ? 0 : Math.round(((thisW - lastW) / lastW) * 100)
  const velocityTrend: 'up' | 'down' | 'flat' = velocityPct > 10 ? 'up' : velocityPct < -10 ? 'down' : 'flat'

  return { total, classified, failed, level4, sources, recent, levels,
           thisWeekHigh: thisW, lastWeekHigh: lastW, velocityPct, velocityTrend,
           pendingReview: pendingReview ?? 0,
           lowConfidence: lowConfidence ?? 0,
           avgConfidence }
}

const VELOCITY_CONFIG = {
  up:   { label: 'Rising',  icon: '↑', color: 'text-red-600',   bg: 'bg-red-50 border-red-100',   tip: 'High-impact signals increasing week-over-week' },
  down: { label: 'Easing',  icon: '↓', color: 'text-green-600', bg: 'bg-green-50 border-green-100', tip: 'High-impact signals decreasing week-over-week' },
  flat: { label: 'Steady',  icon: '→', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', tip: 'Signal landscape stable week-over-week' },
}

interface Props { searchParams: { level?: string } }

export default async function CommandPage({ searchParams }: Props) {
  const { total, classified, failed, level4, sources, recent, levels,
          thisWeekHigh, lastWeekHigh, velocityPct, velocityTrend,
          pendingReview, lowConfidence, avgConfidence } = await getStats()

  const activeLevel = searchParams.level

  const vel = VELOCITY_CONFIG[velocityTrend]

  const statCards = [
    { label: 'Total Signals',     value: total ?? 0,      color: 'text-slate-800' },
    { label: 'Classified',        value: classified ?? 0,  color: 'text-green-700' },
    { label: 'High Impact (L4)',  value: level4 ?? 0,      color: 'text-red-600' },
    { label: 'Failed',            value: failed ?? 0,      color: 'text-orange-600' },
  ]

  const confColor = avgConfidence == null ? 'text-slate-400'
    : avgConfidence >= 85 ? 'text-emerald-600'
    : avgConfidence >= 65 ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Command</h1>
        <p className="text-slate-500 text-sm mt-1">Operational overview — what needs attention now</p>
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

      {/* Velocity + Triage Queue row */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Velocity Score */}
        <div className={`rounded-xl border p-5 shadow-sm ${vel.bg}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Signal Velocity</p>
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

        {/* Triage Queue CTA */}
        <Link href="/triage" className="block group">
          <div className={`rounded-xl border p-5 shadow-sm h-full transition-shadow hover:shadow-md ${
            pendingReview > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'
          }`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Triage Queue</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-black ${pendingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {pendingReview}
              </span>
              <span className={`text-sm font-semibold ${pendingReview > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {pendingReview > 0 ? 'signals need triage' : 'all clear'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {pendingReview > 0
                ? 'L3 + L4 signals awaiting your decision'
                : 'All high-impact signals have been triaged'}
            </p>
            <p className="text-xs text-blue-600 mt-3 group-hover:underline">Open triage →</p>
          </div>
        </Link>
      </div>

      {/* AI Confidence + Low Confidence Alert row */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg AI Confidence</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-3xl font-black ${confColor}`}>
              {avgConfidence != null ? `${avgConfidence}%` : '—'}
            </span>
            <span className="text-sm text-gray-400">
              {avgConfidence == null ? 'no data'
                : avgConfidence >= 85 ? 'high reliability'
                : avgConfidence >= 65 ? 'moderate reliability'
                : 'needs review'}
            </span>
          </div>
          {avgConfidence != null && (
            <div className="mt-3">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    avgConfidence >= 85 ? 'bg-emerald-500' : avgConfidence >= 65 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${avgConfidence}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Across all classified signals</p>
            </div>
          )}
        </div>

        <Link href="/triage?filter=low-confidence" className="block group">
          <div className={`rounded-xl border p-5 shadow-sm h-full transition-shadow hover:shadow-md ${
            lowConfidence > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Low Confidence Signals</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-black ${lowConfidence > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {lowConfidence}
              </span>
              <span className={`text-sm font-semibold ${lowConfidence > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {lowConfidence === 1 ? 'signal' : 'signals'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {lowConfidence > 0
                ? 'Classifications below 65% confidence — human review recommended'
                : 'All classifications meet the confidence threshold'}
            </p>
            {lowConfidence > 0 && (
              <p className="text-xs text-blue-600 mt-3 group-hover:underline">Review low-confidence signals →</p>
            )}
          </div>
        </Link>
      </div>

      {/* Impact breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <h2 className="font-semibold text-slate-800 mb-3 sm:mb-4">Impact Level Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {['4', '3', '2', '1'].map(level => (
            <Link key={level} href={`/radar?level=${level}`} className="block group">
              <div className={`rounded-lg p-3 sm:p-4 text-center border-2 hover:shadow-md transition-shadow ${IMPACT_COLORS[level]} border-transparent`}>
                <p className="text-xl sm:text-2xl font-bold">{levels[level] ?? 0}</p>
                <p className="text-xs font-medium mt-1">L{level} — {IMPACT_LABELS[level]}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent signals */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-slate-800 shrink-0">Recent Signals</h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['', '4', '3', '2', '1'].map(l => (
                <Link
                  key={l}
                  href={l ? `/command?level=${l}` : '/command'}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activeLevel === l || (!activeLevel && !l)
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-500 border-gray-200 hover:border-slate-400'
                  }`}>
                  {l ? `L${l}` : 'All'}
                </Link>
              ))}
            </div>
            <Link href={activeLevel ? `/radar?level=${activeLevel}` : '/radar'} className="text-sm text-blue-600 hover:underline shrink-0">View all →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {(recent || [])
              .filter((item: any) => !activeLevel || item.classifications?.[0]?.impact_level === activeLevel)
              .slice(0, 10)
              .map((item: any) => {
                const cls = item.classifications?.[0]
                return (
                  <Link key={item.id} href={`/radar/${item.id}`}
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
            {activeLevel && (recent || []).filter((item: any) => item.classifications?.[0]?.impact_level === activeLevel).length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-slate-400">No recent L{activeLevel} signals</div>
            )}
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
