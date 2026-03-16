import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatsCard, StatusBadge, PriorityBadge, EmptyState, SectionHeader } from '@/app/components/ui'

const WS = '00000000-0000-0000-0000-000000000001'

export const dynamic = 'force-dynamic'

export default async function CasesPage() {
  const sb = getServerClient()

  const { data: cases } = await sb
    .from('cases')
    .select('*, items(id, title), internal_controls(id, name, ref)')
    .eq('workspace_id', WS)
    .order('created_at', { ascending: false })

  const all = cases || []

  const open = all.filter(c => c.status !== 'closed')
  const critical = all.filter(c => c.priority === 'critical' && c.status !== 'closed')
  const overdue = all.filter(c => c.due_date && new Date(c.due_date) < new Date() && c.status !== 'closed')
  const closed = all.filter(c => c.status === 'closed')

  return (
    <div className="space-y-5">
      <SectionHeader title="Cases" subtitle="Track work after triage — manage, assign, and close." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Open" value={open.length} color="text-blue-700" bg="bg-blue-50" />
        <StatsCard label="Critical" value={critical.length}
          color={critical.length > 0 ? 'text-red-700' : 'text-slate-800'}
          bg={critical.length > 0 ? 'bg-red-50' : ''} />
        <StatsCard label="Overdue" value={overdue.length}
          color={overdue.length > 0 ? 'text-orange-700' : 'text-slate-800'}
          bg={overdue.length > 0 ? 'bg-orange-50' : ''} />
        <StatsCard label="Closed" value={closed.length} />
      </div>

      {all.length === 0 ? (
        <EmptyState
          message="No cases yet. Cases are created from the Triage workspace when a signal requires follow-up."
          action={{ label: 'Go to Triage', href: '/triage' }}
        />
      ) : (
        <div className="rw-card overflow-hidden">
          <table className="rw-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Signal</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {all.map(c => {
                const isOverdue = c.due_date && new Date(c.due_date) < new Date() && c.status !== 'closed'
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/cases/${c.id}`} className="text-[13px] font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="text-[12px] text-slate-500 max-w-[180px] truncate">
                      {c.items ? (
                        <Link href={`/radar/${c.items.id}`} className="hover:text-blue-600 transition-colors">
                          {c.items.title || 'Untitled'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td><PriorityBadge priority={c.priority} /></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-[12px] text-slate-600">
                      {c.owner_name || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="text-[12px]">
                      {c.due_date ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
                          {isOverdue ? '! ' : ''}
                          {new Date(c.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="text-[12px] text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
