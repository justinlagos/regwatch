import Link from 'next/link'

export default function CasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cases</h1>
        <p className="text-slate-500 text-sm mt-1">Track actions triggered by triaged signals</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: 0, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Overdue', value: 0, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Awaiting Response', value: 0, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Closed This Month', value: 0, color: 'text-green-700', bg: 'bg-green-50 border-green-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <p className="text-slate-400 text-sm">No cases yet. Cases are created from the <Link href="/triage" className="text-blue-600 hover:underline">Triage</Link> workspace when a signal requires action.</p>
      </div>
    </div>
  )
}
