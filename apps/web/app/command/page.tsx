import { getServerClient, IMPACT_LABELS, IMPACT_COLORS } from '@/lib/supabase'
import Link from 'next/link'
import { SectionHeader, StatsCard } from '@/app/components/ui'

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
  up:   { label: 'Rising',  icon: '↑', color: 'text-red-600',   ring: 'ring-red-200',   bg: 'bg-red-50' },
  down: { label: 'Easing',  icon: '↓', color: 'text-emerald-600', ring: 'ring-emerald-200', bg: 'bg-emerald-50' },
  flat: { label: 'Steady',  icon: '→', color: 'text-slate-600', ring: 'ring-slate-200', bg: 'bg-slate-50' },
}

interface Props { searchParams: { level?: string } }

export default async function CommandPage({ searchParams }: Props) {
  const { total, classified, failed, level4, sources, recent, levels,
          thisWeekHigh, lastWeekHigh, velocityPct, velocityTrend,
          pendingReview, lowConfidence, avgConfidence } = await getStats()

  const activeLevel = searchParams.level
  const vel = VELOCITY_CONFIG[velocityTrend]

  const confColor = avgConfidence == null ? 'text-slate-400'
    : avgConfidence >= 85 ? 'text-emerald-600'
    : avgConfidence >= 65 ? 'text-amber-600'
    : 'text-red-600'

  return (
    <div className="space-y-5">
      <SectionHeader title="Command" subtitle="Operational overview — what needs attention now" />

      {/* ── Stat cards ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard label="Total Signals" value={total ?? 0} />
        <StatsCard label="Classified" value={classified ?? 0} color="text-emerald-700" />
        <StatsCard label="High Impact (L4)" value={level4 ?? 0} color="text-red-600" />
        <StatsCard label="Failed" value={failed ?? 0} color="text-orange-600" />
      </div>

      {/* ── Velocity + Triage row ─────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Velocity */}
        <div className={`rw-card p-4 ring-1 ${vel.ring} ${vel.bg}`}>
          <p className="rw-stat-label">Signal Velocity</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-2xl font-extrabold ${vel.color}`}>{vel.icon} {Math.abs(velocityPct)}%</span>
            <span className={`text-xs font-semibold ${vel.color}`}>{vel.label}</span>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
            <span>L3 + L4, 7-day rolling</span>
            <span className="font-medium">{thisWeekHigh} this wk · {lastWeekHigh} last wk</span>
          </div>
        </div>

        {/* Triage CTA */}
        <Link href="/triage" className="block group">
          <div className={`rw-card p-4 h-full ring-1 transition-shadow hover:shadow-md ${
            pendingReview > 0 ? 'bg-red-50 ring-red-200' : 'bg-emerald-50 ring-emerald-200'
          }`}>
            <p className="rw-stat-label">Triage Queue</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl font-extrabold ${pendingReview > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pendingReview}
              </span>
              <span className={`text-xs font-semibold ${pendingReview > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {pendingReview > 0 ? 'signals need triage' : 'all clear'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              {pendingReview > 0 ? 'L3 + L4 signals awaiting your decision' : 'All high-impact signals triaged'}
            </p>
            <p className="text-[11px] text-blue-600 font-medium mt-1 group-hover:underline">Open triage →</p>
          </div>
        </Link>
      </div>

      {/* ── AI Confidence row ──────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rw-card p-4">
          <p className="rw-stat-label">Avg AI Confidence</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className={`text-2xl font-extrabold ${confColor}`}>
              {avgConfidence != null ? `${avgConfidence}%` : '—'}
            </span>
            <span className="text-[11px] text-slate-400">
              {avgConfidence == null ? 'no data'
                : avgConfidence >= 85 ? 'high reliability'
                : avgConfidence >= 65 ? 'moderate'
                : 'needs review'}
            </span>
          </div>
          {avgConfidence != null && (
            <div className="mt-3">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    avgConfidence >= 85 ? 'bg-emerald-500' : avgConfidence >= 65 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${avgConfidence}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <Link href="/triage?filter=low-confidence" className="block group">
          <div className={`rw-card p-4 h-full ring-1 transition-shadow hover:shadow-md ${
            lowConfidence > 0 ? 'bg-amber-50 ring-amber-200' : 'ring-[var(--border-subtle)]'
          }`}>
            <p className="rw-stat-label">Low Confidence Signals</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className={`text-2xl font-extrabold ${lowConfidence > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {lowConfidence}
              </span>
              <span className={`text-xs font-semibold ${lowConfidence > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {lowConfidence === 1 ? 'signal' : 'signals'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              {lowConfidence > 0 ? 'Below 65% confidence — human review recommended' : 'All above confidence threshold'}
            </p>
            {lowConfidence > 0 && (
              <p className="text-[11px] text-blue-600 font-medium mt-1 group-hover:underline">Review →</p>
            )}
          </div>
        </Link>
      </div>

      {/* ── Impact breakdown ───────────────────── */}
      <div className="rw-card">
        <div className="rw-card-header">
          <h2>Impact Distribution</h2>
        </div>
        <div className="grid grid-cols-4 gap-2 p-4">
          {['4', '3', '2', '1'].map(level => (
            <Link key={level} href={`/radar?level=${level}`} className="block group">
              <div className={`rounded-lg p-3 text-center hover:shadow-sm transition-shadow ${IMPACT_COLORS[level]}`}>
                <p className="text-xl font-bold">{levels[level] ?? 0}</p>
                <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide">L{level} · {IMPACT_LABELS[level]}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent + Sources ───────────────────── */}
      <div className="grid lg:grid-cols-3 gap-3">
        {/* Recent signals */}
        <div className="lg:col-span-2 rw-card">
          <div className="rw-card-header">
            <h2>Recent Signals</h2>
            <div className="flex items-center gap-1.5">
              {['', '4', '3', '2', '1'].map(l => (
                <Link key={l} href={l ? `/command?level=${l}` : '/command'}
                  className={`rw-tab ${activeLevel === l || (!activeLevel && !l) ? 'rw-tab-active' : ''}`}>
                  {l ? `L${l}` : 'All'}
                </Link>
              ))}
              <Link href={activeLevel ? `/radar?level=${activeLevel}` : '/radar'} className="ml-1 text-[11px] text-blue-600 hover:underline">View all →</Link>
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {(recent || [])
              .filter((item: any) => !activeLevel || item.classifications?.[0]?.impact_level === activeLevel)
              .slice(0, 10)
              .map((item: any) => {
                const cls = item.classifications?.[0]
                return (
                  <Link key={item.id} href={`/radar/${item.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors group">
                    {cls?.impact_level && (
                      <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${IMPACT_COLORS[cls.impact_level]}`}>
                        L{cls.impact_level}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-slate-800 truncate group-hover:text-blue-600">{item.title || 'Untitled'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {(item.sources as any)?.name} · {new Date(item.detected_at).toLocaleDateString()}
                      </p>
                      {cls?.summary && <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{cls.summary}</p>}
                    </div>
                  </Link>
                )
              })}
            {activeLevel && (recent || []).filter((item: any) => item.classifications?.[0]?.impact_level === activeLevel).length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-slate-400">No recent L{activeLevel} signals</div>
            )}
          </div>
        </div>

        {/* Sources */}
        <div className="rw-card">
          <div className="rw-card-header">
            <h2>Sources</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {(sources || []).map((src: any) => (
              <div key={src.name} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-700">{src.name}</p>
                  <span className={`rw-badge ${
                    src.state === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'
                  }`}>{src.state}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {src.source_type} · {src.last_fetched_at
                    ? `${new Date(src.last_fetched_at).toLocaleDateString()}`
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
