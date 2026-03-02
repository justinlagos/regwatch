import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'

export const revalidate = 60

async function getData() {
  const sb = getServerClient()
  const WS = '00000000-0000-0000-0000-000000000001'
  const quarterStart = new Date(); quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1); quarterStart.setHours(0,0,0,0)

  const [
    { data: controls },
    { data: mappings },
    { data: highItems },
    { data: clauseItems },
  ] = await Promise.all([
    sb.from('internal_controls').select('*').eq('workspace_id', WS).order('ref'),
    sb.from('control_mappings').select('*, internal_controls(name, ref), items(id, title, classifications(impact_level))').eq('workspace_id', WS),
    sb.from('items').select('id, title, classifications(impact_level, iso_clauses, nist_controls)').eq('state', 'classified').in('id',
      (await sb.from('classifications').select('item_id').in('impact_level', ['3','4'])).data?.map((r:any)=>r.item_id)||[]
    ).limit(500),
    sb.from('classifications').select('iso_clauses, nist_controls, impact_level').in('impact_level', ['3','4']).limit(500),
  ])

  // Compliance score: % of L3+L4 items with at least one 'remediated' mapping
  const remediatedItemIds = new Set(
    (mappings||[]).filter(m=>m.status==='remediated').map((m:any)=>m.item_id)
  )
  const totalHigh = (highItems||[]).length
  const remediatedCount = (highItems||[]).filter(i=>remediatedItemIds.has(i.id)).length
  const score = totalHigh > 0 ? Math.round((remediatedCount / totalHigh) * 100) : 0

  // Controls with mapping counts
  const controlStats = (controls||[]).map(c => {
    const cms = (mappings||[]).filter((m:any)=>m.control_id===c.id)
    return {
      ...c,
      total: cms.length,
      remediated: cms.filter(m=>m.status==='remediated').length,
      in_progress: cms.filter(m=>m.status==='in_progress').length,
      mapped: cms.filter(m=>m.status==='mapped').length,
    }
  })

  // ISO clause gap analysis: clauses with most unaddressed high-impact items
  const clauseCounts: Record<string, number> = {}
  const clauseAddressed: Record<string, number> = {};
  (clauseItems||[]).forEach((c:any) => {
    (c.iso_clauses||[]).forEach((clause:string) => {
      clauseCounts[clause] = (clauseCounts[clause]||0) + 1
    })
  });
  (mappings||[]).filter(m=>m.status==='remediated').forEach((m:any)=>{
    const cls = (highItems||[]).find((i:any)=>i.id===m.item_id)
    const clauses = cls?.classifications?.[0]?.iso_clauses||[]
    clauses.forEach((clause:string)=>{ clauseAddressed[clause]=(clauseAddressed[clause]||0)+1 })
  })
  const clauseGaps = Object.entries(clauseCounts)
    .map(([clause, total]) => ({ clause, total, addressed: clauseAddressed[clause]||0, gap: total-(clauseAddressed[clause]||0) }))
    .sort((a,b)=>b.gap-a.gap)
    .slice(0,10)

  return { score, totalHigh, remediatedCount, controlStats, clauseGaps, controls: controls||[], mappings: mappings||[] }
}

export default async function CompliancePage() {
  const { score, totalHigh, remediatedCount, controlStats, clauseGaps } = await getData()

  const scoreColor = score >= 75 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600'
  const barColor  = score >= 75 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Compliance Posture</h1>
        <p className="text-slate-500 text-sm mt-1">Track remediation of high-impact items against your internal controls</p>
      </div>

      {/* Score + breakdown */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Compliance Score</p>
          <p className={`text-6xl font-black ${scoreColor}`}>{score}%</p>
          <div className="w-full mt-4">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${score}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">{remediatedCount} of {totalHigh} L3+L4 items remediated</p>
        </div>

        <div className="sm:col-span-2 grid grid-cols-3 gap-3">
          {[
            { label: 'Remediated', value: controlStats.reduce((a,c)=>a+c.remediated,0), color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'In Progress', value: controlStats.reduce((a,c)=>a+c.in_progress,0), color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Mapped', value: controlStats.reduce((a,c)=>a+c.mapped,0), color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-gray-100 p-4 ${s.bg} text-center`}>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}

          {/* ISO clause gaps */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Top ISO Clause Gaps</p>
            <div className="space-y-2">
              {clauseGaps.slice(0,5).map(({ clause, total, addressed, gap }) => (
                <div key={clause} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 w-16 shrink-0">{clause}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(addressed/total)*100}%` }} />
                  </div>
                  <span className="text-xs text-red-500 font-semibold w-16 text-right shrink-0">{gap} unaddressed</span>
                </div>
              ))}
              {clauseGaps.length === 0 && <p className="text-xs text-slate-400">No clause data yet.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Controls table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Internal Controls</h2>
          <Link href="/settings" className="text-xs text-blue-600 hover:underline">Manage controls →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 text-left">Control</th>
              <th className="px-6 py-3 text-left w-24">Mapped</th>
              <th className="px-6 py-3 text-left w-28">In Progress</th>
              <th className="px-6 py-3 text-left w-28">Remediated</th>
              <th className="px-6 py-3 text-left w-32">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {controlStats.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{c.ref}</span>
                    <span className="font-medium text-slate-700">{c.name}</span>
                  </div>
                  {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                </td>
                <td className="px-6 py-4 text-blue-600 font-semibold">{c.mapped}</td>
                <td className="px-6 py-4 text-amber-600 font-semibold">{c.in_progress}</td>
                <td className="px-6 py-4 text-emerald-600 font-semibold">{c.remediated}</td>
                <td className="px-6 py-4">
                  {c.total > 0 ? (
                    <div className="h-2 w-24 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((c.remediated/c.total)*100)}%` }} />
                    </div>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
