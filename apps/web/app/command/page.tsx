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
    { count: total }, { count: classified }, { count: failed }, { count: level4 },
    { data: sources }, { data: recent },
    { count: thisWeekHigh }, { count: lastWeekHigh }, { count: pendingReview },
    { count: lowConfidence }, { data: confidenceData },
  ] = await Promise.all([
    sb.from('items').select('*', { count: 'exact', head: true }),
    sb.from('items').select('*', { count: 'exact', head: true }).eq('state', 'classified'),
    sb.from('items').select('*', { count: 'exact', head: true }).eq('state', 'classification_failed'),
    sb.from('classifications').select('*', { count: 'exact', head: true }).eq('impact_level', '4'),
    sb.from('sources').select('name, state, last_fetched_at, kind, source_type').order('name'),
    sb.from('items')
      .select('id, title, detected_at, canonical_url, sources(name), classifications(impact_level, summary)')
      .eq('state', 'classified').order('detected_at', { ascending: false }).limit(40),
    h34.length ? sb.from('items').select('id', { count: 'exact', head: true }).eq('state', 'classified').gte('detected_at', weekAgo.toISOString()).in('id', h34) : Promise.resolve({ count: 0 }),
    h34.length ? sb.from('items').select('id', { count: 'exact', head: true }).eq('state', 'classified').gte('detected_at', twoWeeksAgo.toISOString()).lt('detected_at', weekAgo.toISOString()).in('id', h34) : Promise.resolve({ count: 0 }),
    h34.length ? sb.from('items').select('id', { count: 'exact', head: true }).eq('state', 'classified').not('id', 'in', `(${revd.join(',') || 'null'})`).in('id', h34) : Promise.resolve({ count: 0 }),
    sb.from('classifications').select('*', { count: 'exact', head: true }).lt('confidence_score', 65),
    sb.from('classifications').select('confidence_score').not('confidence_score', 'is', null).limit(1000),
  ])

  const { data: levelBreakdown } = await sb.from('classifications').select('impact_level')
  const levels: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
  for (const row of levelBreakdown || []) levels[row.impact_level] = (levels[row.impact_level] || 0) + 1

  const scores = (confidenceData || []).map((r: any) => r.confidence_score).filter(Boolean)
  const avgConfidence = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null
  const thisW = thisWeekHigh ?? 0, lastW = lastWeekHigh ?? 0
  const velocityPct = lastW === 0 ? 0 : Math.round(((thisW - lastW) / lastW) * 100)
  const velocityTrend: 'up' | 'down' | 'flat' = velocityPct > 10 ? 'up' : velocityPct < -10 ? 'down' : 'flat'

  return { total, classified, failed, level4, sources, recent, levels, thisWeekHigh: thisW, lastWeekHigh: lastW, velocityPct, velocityTrend, pendingReview: pendingReview ?? 0, lowConfidence: lowConfidence ?? 0, avgConfidence }
}

const VEL = {
  up:   { label: 'Rising',  icon: '↑', color: 'text-red-600',     bg: 'rw-stat-red' },
  down: { label: 'Easing',  icon: '↓', color: 'text-emerald-600', bg: 'rw-stat-green' },
  flat: { label: 'Steady',  icon: '→', color: 'text-slate-600',   bg: 'rw-stat-slate' },
}

const LS: Record<string, { bg: string; text: string; border: string }> = {
  '4': { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100' },
  '3': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  '2': { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100' },
  '1': { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100' },
}

interface Props { searchParams: { level?: string } }

export default async function CommandPage({ searchParams }: Props) {
  const d = await getStats()
  const activeLevel = searchParams.level
  const vel = VEL[d.velocityTrend]
  const cc = d.avgConfidence == null ? 'text-[#8b90a5]' : d.avgConfidence >= 85 ? 'text-emerald-600' : d.avgConfidence >= 65 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-6">
      <SectionHeader title="Command" subtitle="Operational overview — what needs attention now" />

      {/* ── Stat cards ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Signals" value={d.total ?? 0} bg="bg-indigo-50" color="text-indigo-700" />
        <StatsCard label="Classified" value={d.classified ?? 0} color="text-emerald-700" bg="bg-emerald-50" />
        <StatsCard label="Critical (L4)" value={d.level4 ?? 0} color="text-red-600" bg="bg-red-50" />
        <StatsCard label="Failed" value={d.failed ?? 0} color="text-orange-600" bg="bg-orange-50" />
      </div>

      {/* ── Velocity + Triage ─────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`rw-stat ${vel.bg}`}>
          <p className="rw-stat-label">Signal Velocity</p>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className={`text-[32px] font-extrabold tracking-tight ${vel.color}`}>{vel.icon} {Math.abs(d.velocityPct)}%</span>
            <span className={`text-[12px] font-semibold ${vel.color}`}>{vel.label}</span>
          </div>
          <div className="flex items-center justify-between mt-4 text-[11px]" style={{ color: '#8b90a5' }}>
            <span>L3 + L4, 7-day rolling</span>
            <span className="font-medium">{d.thisWeekHigh} this wk · {d.lastWeekHigh} last wk</span>
          </div>
        </div>

        <Link href="/triage" className="block group">
          <div className={`rw-stat h-full transition-shadow hover:shadow-lg ${d.pendingReview > 0 ? 'rw-stat-red' : 'rw-stat-green'}`}>
            <p className="rw-stat-label">Triage Queue</p>
            <div className="flex items-baseline gap-2.5 mt-2">
              <span className={`text-[32px] font-extrabold tracking-tight ${d.pendingReview > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.pendingReview}</span>
              <span className={`text-[12px] font-semibold ${d.pendingReview > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{d.pendingReview > 0 ? 'need triage' : 'all clear'}</span>
            </div>
            <p className="text-[11px] mt-4" style={{ color: '#8b90a5' }}>{d.pendingReview > 0 ? 'L3 + L4 awaiting decision' : 'All high-impact signals triaged'}</p>
            <p className="text-[11px] text-indigo-600 font-semibold mt-1 group-hover:underline">Open triage →</p>
          </div>
        </Link>
      </div>

      {/* ── AI Confidence ──────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rw-stat">
          <p className="rw-stat-label">Avg AI Confidence</p>
          <div className="flex items-baseline gap-2.5 mt-2">
            <span className={`text-[32px] font-extrabold tracking-tight ${cc}`}>{d.avgConfidence != null ? `${d.avgConfidence}%` : '—'}</span>
            <span className="text-[12px] font-medium" style={{ color: '#8b90a5' }}>{d.avgConfidence == null ? 'no data' : d.avgConfidence >= 85 ? 'high reliability' : d.avgConfidence >= 65 ? 'moderate' : 'needs review'}</span>
          </div>
          {d.avgConfidence != null && (
            <div className="mt-4"><div className="h-2 rounded-full overflow-hidden" style={{ background: '#eef0f4' }}><div className={`h-full rounded-full transition-all ${d.avgConfidence >= 85 ? 'bg-emerald-500' : d.avgConfidence >= 65 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${d.avgConfidence}%` }} /></div></div>
          )}
        </div>
        <Link href="/triage?filter=low-confidence" className="block group">
          <div className={`rw-stat h-full transition-shadow hover:shadow-lg ${d.lowConfidence > 0 ? 'rw-stat-orange' : ''}`}>
            <p className="rw-stat-label">Low Confidence</p>
            <div className="flex items-baseline gap-2.5 mt-2">
              <span className={`text-[32px] font-extrabold tracking-tight ${d.lowConfidence > 0 ? 'text-amber-600' : 'text-[#8b90a5]'}`}>{d.lowConfidence}</span>
              <span className={`text-[12px] font-semibold ${d.lowConfidence > 0 ? 'text-amber-600' : 'text-[#8b90a5]'}`}>{d.lowConfidence === 1 ? 'signal' : 'signals'}</span>
            </div>
            <p className="text-[11px] mt-4" style={{ color: '#8b90a5' }}>{d.lowConfidence > 0 ? 'Below 65% — human review recommended' : 'All above threshold'}</p>
            {d.lowConfidence > 0 && <p className="text-[11px] text-indigo-600 font-semibold mt-1 group-hover:underline">Review →</p>}
          </div>
        </Link>
      </div>

      {/* ── Impact breakdown ───────────────────── */}
      <div className="rw-card">
        <div className="rw-card-header"><h2>Impact Distribution</h2></div>
        <div className="grid grid-cols-4 gap-3 p-5">
          {['4','3','2','1'].map(l => {
            const s = LS[l]
            return (
              <Link key={l} href={`/radar?level=${l}`} className="block group">
                <div className={`rounded-xl p-4 text-center border transition-all group-hover:shadow-md ${s.bg} ${s.border}`}>
                  <p className={`text-[26px] font-extrabold tracking-tight ${s.text}`}>{d.levels[l] ?? 0}</p>
                  <p className={`text-[10px] font-semibold mt-1 uppercase tracking-wider opacity-70 ${s.text}`}>L{l} · {IMPACT_LABELS[l]}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Recent + Sources ───────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rw-card">
          <div className="rw-card-header">
            <h2>Recent Signals</h2>
            <div className="flex items-center gap-1.5">
              {['','4','3','2','1'].map(l => (
                <Link key={l} href={l ? `/command?level=${l}` : '/command'} className={`rw-tab ${activeLevel === l || (!activeLevel && !l) ? 'rw-tab-active' : ''}`}>{l ? `L${l}` : 'All'}</Link>
              ))}
              <Link href={activeLevel ? `/radar?level=${activeLevel}` : '/radar'} className="ml-2 text-[11px] text-indigo-600 font-semibold hover:underline">View all →</Link>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: '#eef0f4' }}>
            {(d.recent || []).filter((i: any) => !activeLevel || i.classifications?.[0]?.impact_level === activeLevel).slice(0, 10).map((item: any) => {
              const cls = item.classifications?.[0]; const lev = cls?.impact_level; const s = lev ? LS[lev] : null
              return (
                <Link key={item.id} href={`/radar/${item.id}`} className="flex items-start gap-3.5 px-5 py-3.5 hover:bg-[#f8f9fc] transition-colors group">
                  {s && <span className={`mt-0.5 shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>L{lev}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate group-hover:text-indigo-600 transition-colors" style={{ color: '#1a1d2e' }}>{item.title || 'Untitled'}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#8b90a5' }}>{(item.sources as any)?.name} · {new Date(item.detected_at).toLocaleDateString()}</p>
                    {cls?.summary && <p className="text-[11px] mt-1 line-clamp-1" style={{ color: '#6b7194' }}>{cls.summary}</p>}
                  </div>
                </Link>
              )
            })}
            {activeLevel && (d.recent || []).filter((i: any) => i.classifications?.[0]?.impact_level === activeLevel).length === 0 && (
              <div className="px-5 py-12 text-center text-[13px]" style={{ color: '#8b90a5' }}>No recent L{activeLevel} signals</div>
            )}
          </div>
        </div>

        <div className="rw-card">
          <div className="rw-card-header"><h2>Sources</h2></div>
          <div className="divide-y" style={{ borderColor: '#eef0f4' }}>
            {(d.sources || []).map((src: any) => (
              <div key={src.name} className="px-5 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium" style={{ color: '#1a1d2e' }}>{src.name}</p>
                  <span className={`rw-badge ${src.state === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' : 'bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-500/10'}`}>{src.state}</span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: '#8b90a5' }}>{src.source_type} · {src.last_fetched_at ? new Date(src.last_fetched_at).toLocaleDateString() : 'Not yet fetched'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
