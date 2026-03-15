import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatusBadge, StatsCard } from '@/app/components/ui'

export const revalidate = 60

const TYPE_LABELS: Record<string, string> = {
  policy: 'Policy',
  procedure: 'Procedure',
  control_process: 'Control Process',
  reporting_obligation: 'Reporting',
}

async function getData() {
  const sb = getServerClient()
  const WS = '00000000-0000-0000-0000-000000000001'

  const { data: controls } = await sb
    .from('internal_controls')
    .select('*')
    .eq('workspace_id', WS)
    .order('ref')

  // Compute status from next_review_at
  const now = new Date()
  const enriched = (controls || []).map(c => {
    let computed_status = c.status || 'active'
    if (c.next_review_at && computed_status !== 'archived') {
      const next = new Date(c.next_review_at)
      const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) computed_status = 'overdue'
      else if (diffDays <= 30) computed_status = 'due_soon'
      else computed_status = 'active'
    }
    return { ...c, status: computed_status }
  })

  const counts = {
    total: enriched.length,
    active: enriched.filter(c => c.status === 'active').length,
    due_soon: enriched.filter(c => c.status === 'due_soon').length,
    overdue: enriched.filter(c => c.status === 'overdue').length,
  }

  return { controls: enriched, counts }
}

export default async function ControlsPage() {
  const { controls, counts } = await getData()

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Controls Register</h1>
          <p className="text-slate-500 text-sm mt-1">Internal policies, procedures, and control processes</p>
        </div>
        <Link href="/settings?tab=controls" className="text-xs text-blue-600 hover:underline">Manage</Link>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Total Controls" value={counts.total} color="text-slate-800" bg="bg-slate-50" />
        <StatsCard label="Active" value={counts.active} color="text-emerald-700" bg="bg-emerald-50" />
        <StatsCard label="Due Soon" value={counts.due_soon} color="text-amber-700" bg="bg-amber-50" />
        <StatsCard label="Overdue" value={counts.overdue} color="text-red-700" bg="bg-red-50" />
      </div>

      {/* Register table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 text-left">Ref</th>
                <th className="px-6 py-3 text-left">Control</th>
                <th className="px-6 py-3 text-left w-28">Type</th>
                <th className="px-6 py-3 text-left w-36">Owner</th>
                <th className="px-6 py-3 text-left w-28">Review Cycle</th>
                <th className="px-6 py-3 text-left w-28">Next Review</th>
                <th className="px-6 py-3 text-left w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {controls.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No controls registered yet</td></tr>
              )}
              {controls.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-400">{c.ref || '—'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/controls/${c.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                      {c.name}
                    </Link>
                    {c.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>}
                    {c.departments && c.departments.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {c.departments.map((d: string) => (
                          <span key={d} className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded">{d}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">{TYPE_LABELS[c.type] || c.type}</td>
                  <td className="px-6 py-4 text-xs text-slate-600">{c.owner_name || '—'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500">{c.review_cycle || '—'}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {c.next_review_at ? new Date(c.next_review_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
