import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatsCard, StatusBadge, PriorityBadge, EmptyState } from '@/app/components/ui'

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
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Cases</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track work after triage — manage, assign, and close.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Open" value={open.length} color="text-blue-700" bg="bg-blue-50 border-blue-100" />
        <StatsCard label="Critical" value={critical.length}
          color={critical.length > 0 ? 'text-red-700' : 'text-slate-800'}
          bg={critical.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'} />
        <StatsCard label="Overdue" value={overdue.length}
          color={overdue.length > 0 ? 'text-orange-700' : 'text-slate-800'}
          bg={overdue.length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-200'} />
        <StatsCard label="Closed" value={closed.length} />
      </div>

      {all.length === 0 ? (
        <EmptyState
          message="No cases yet. Cases are created from the Triage workspace when a signal requires follow-up."
          action={{ label: 'Go to Triage', href: '/triage' }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-slate-500 font-medium uppercase tracking-wider">
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {all.map(c => {
                const isOverdue = c.due_date && new Date(c.due_date) < new Date() && c.status !== 'closed'
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/cases/${c.id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">
                      {c.items ? (
                        <Link href={`/radar/${c.items.id}`} className="hover:text-blue-600 transition-colors">
                          {c.items.title || 'Untitled'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {c.owner_name || <span className="text-slate-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.due_date ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
                          {isOverdue ? '! ' : ''}
                          {new Date(c.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
