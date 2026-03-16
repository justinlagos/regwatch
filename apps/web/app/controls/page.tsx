import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatusBadge, StatsCard, SectionHeader } from '@/app/components/ui'

export const revalidate = 60

const TYPE_LABELS: Record<string, string> = {
  policy: 'Policy', procedure: 'Procedure', control_process: 'Control Process', reporting_obligation: 'Reporting',
}

async function getData() {
  const sb = getServerClient()
  const WS = '00000000-0000-0000-0000-000000000001'
  const { data: controls } = await sb.from('internal_controls').select('*').eq('workspace_id', WS).order('ref')

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

  return {
    controls: enriched,
    counts: {
      total: enriched.length,
      active: enriched.filter(c => c.status === 'active').length,
      due_soon: enriched.filter(c => c.status === 'due_soon').length,
      overdue: enriched.filter(c => c.status === 'overdue').length,
    },
  }
}

export default async function ControlsPage() {
  const { controls, counts } = await getData()

  return (
    <div className="space-y-6">
      <SectionHeader title="Controls Register" subtitle="Internal policies, procedures, and control processes" action={{ label: 'Manage', href: '/settings?tab=controls' }} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatsCard label="Total Controls" value={counts.total} bg="bg-indigo-50" color="text-indigo-700" />
        <StatsCard label="Active" value={counts.active} color="text-emerald-700" bg="bg-emerald-50" />
        <StatsCard label="Due Soon" value={counts.due_soon} color="text-amber-700" bg="bg-orange-50" />
        <StatsCard label="Overdue" value={counts.overdue} color="text-red-700" bg="bg-red-50" />
      </div>

      <div className="rw-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rw-table">
            <thead><tr><th>Ref</th><th>Control</th><th className="w-28">Type</th><th className="w-32">Owner</th><th className="w-28">Review Cycle</th><th className="w-28">Next Review</th><th className="w-24">Status</th></tr></thead>
            <tbody>
              {controls.length === 0 && <tr><td colSpan={7} className="text-center py-14 text-[13px]" style={{ color: '#8b90a5' }}>No controls registered yet</td></tr>}
              {controls.map(c => (
                <tr key={c.id}>
                  <td><span className="text-[11px] font-mono" style={{ color: '#8b90a5' }}>{c.ref || '—'}</span></td>
                  <td>
                    <Link href={`/controls/${c.id}`} className="text-[13px] font-semibold hover:text-indigo-600 transition-colors" style={{ color: '#1a1d2e' }}>{c.name}</Link>
                    {c.description && <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: '#8b90a5' }}>{c.description}</p>}
                    {c.departments && c.departments.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {c.departments.map((d: string) => <span key={d} className="rw-badge bg-slate-50 ring-1 ring-inset ring-slate-500/10" style={{ color: '#6b7194' }}>{d}</span>)}
                      </div>
                    )}
                  </td>
                  <td className="text-[12px]" style={{ color: '#6b7194' }}>{TYPE_LABELS[c.type] || c.type}</td>
                  <td className="text-[12px]" style={{ color: '#3a3f56' }}>{c.owner_name || '—'}</td>
                  <td className="text-[12px]" style={{ color: '#6b7194' }}>{c.review_cycle || '—'}</td>
                  <td className="text-[12px] whitespace-nowrap" style={{ color: '#6b7194' }}>{c.next_review_at ? new Date(c.next_review_at).toLocaleDateString() : '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
