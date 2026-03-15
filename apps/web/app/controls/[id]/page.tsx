import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatusBadge, EmptyState } from '@/app/components/ui'
import ControlDetailClient from './ControlDetailClient'

export const revalidate = 60

const TYPE_LABELS: Record<string, string> = {
  policy: 'Policy',
  procedure: 'Procedure',
  control_process: 'Control Process',
  reporting_obligation: 'Reporting Obligation',
}

interface Props { params: { id: string } }

async function getData(id: string) {
  const sb = getServerClient()
  const WS = '00000000-0000-0000-0000-000000000001'

  const { data: control, error } = await sb
    .from('internal_controls')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', WS)
    .single()

  if (error || !control) return null

  const [
    { data: keywords },
    { data: regulations },
    { data: matches },
  ] = await Promise.all([
    sb.from('control_keywords').select('*').eq('control_id', id).order('created_at'),
    sb.from('control_regulations').select('*').eq('control_id', id).order('created_at'),
    sb.from('signal_matches').select('id, item_id, match_tier, confidence_score, matched_keyword, explanation, items(id, title, detected_at)').eq('control_id', id).order('confidence_score', { ascending: false }).limit(20),
  ])

  // Compute status
  let computed_status = control.status || 'active'
  if (control.next_review_at && computed_status !== 'archived') {
    const now = new Date()
    const next = new Date(control.next_review_at)
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) computed_status = 'overdue'
    else if (diffDays <= 30) computed_status = 'due_soon'
    else computed_status = 'active'
  }

  return {
    ...control,
    status: computed_status,
    keywords: keywords || [],
    regulations: regulations || [],
    signal_matches: matches || [],
  }
}

export default async function ControlDetailPage({ params }: Props) {
  const control = await getData(params.id)

  if (!control) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Link href="/controls" className="text-sm text-blue-600 hover:underline">Back to Controls</Link>
        <EmptyState message="Control not found." />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <Link href="/controls" className="hover:text-blue-600">Controls</Link>
        <span>›</span>
        <span className="text-gray-600">{control.ref || control.name}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              {control.ref && <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{control.ref}</span>}
              <h1 className="text-xl font-bold text-slate-900">{control.name}</h1>
            </div>
            {control.description && <p className="text-sm text-slate-500 mt-2">{control.description}</p>}
          </div>
          <StatusBadge status={control.status} size="md" />
        </div>

        <div className="grid sm:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Type</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{TYPE_LABELS[control.type] || control.type}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Owner</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{control.owner_name || '—'}</p>
            {control.owner_email && <p className="text-xs text-slate-400">{control.owner_email}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Review Cycle</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">{control.review_cycle || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Next Review</p>
            <p className="text-sm font-medium text-slate-700 mt-0.5">
              {control.next_review_at ? new Date(control.next_review_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        {control.departments && control.departments.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1.5">Departments</p>
            <div className="flex gap-1.5">
              {control.departments.map((d: string) => (
                <span key={d} className="bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1 rounded-full">{d}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client component for interactive keywords + regulations */}
      <ControlDetailClient
        controlId={control.id}
        initialKeywords={control.keywords}
        initialRegulations={control.regulations}
      />

      {/* Linked Signals (from signal_matches) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-slate-800">Linked Signals</h2>
          <p className="text-xs text-slate-400 mt-0.5">Signals matched to this control via keyword matching</p>
        </div>
        {control.signal_matches.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">No signal matches yet. Run matching to populate.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-2 text-left">Signal</th>
                <th className="px-6 py-2 text-left w-24">Tier</th>
                <th className="px-6 py-2 text-left w-20">Score</th>
                <th className="px-6 py-2 text-left w-32">Keyword</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {control.signal_matches.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link href={`/radar/${m.item_id}`} className="text-slate-800 hover:text-blue-600 font-medium line-clamp-1">
                      {(m.items as any)?.title || 'Untitled signal'}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      m.match_tier === 'direct' ? 'bg-emerald-50 text-emerald-700' :
                      m.match_tier === 'context' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-50 text-gray-500'
                    }`}>{m.match_tier}</span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-600 font-mono">{m.confidence_score}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{m.matched_keyword || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
