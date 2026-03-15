export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 text-sm mt-1">Generate monthly monitoring summaries and compliance reports</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Monthly Monitoring Summary', desc: 'Signals monitored, actions taken, policy reviews triggered' },
          { title: 'GTCO Metrics Support Pack', desc: 'Information security metrics for subsidiary reporting' },
          { title: 'Executive Snapshot', desc: 'Key changes, risks, open items for leadership' },
          { title: 'Audit Evidence Summary', desc: 'Complete evidence trail for audit and review' },
        ].map(t => (
          <div key={t.title} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-sm">{t.title}</h3>
            <p className="text-xs text-slate-400 mt-2">{t.desc}</p>
            <p className="text-xs text-slate-300 mt-4">Available in Phase 10</p>
          </div>
        ))}
      </div>
    </div>
  )
}
