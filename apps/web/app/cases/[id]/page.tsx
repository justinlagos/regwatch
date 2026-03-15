import { getServerClient } from '@/lib/supabase'
import Link from 'next/link'
import { StatusBadge, PriorityBadge } from '@/app/components/ui'
import CaseDetailClient from './CaseDetailClient'

const WS = '00000000-0000-0000-0000-000000000001'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params
  const sb = getServerClient()

  const { data: caseRow, error } = await sb
    .from('cases')
    .select('*, items(id, title), internal_controls(id, name, ref), case_stakeholders(*), case_notes(*)')
    .eq('id', id)
    .eq('workspace_id', WS)
    .single()

  if (error || !caseRow) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-slate-500">Case not found.</p>
        <Link href="/cases" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Back to cases</Link>
      </main>
    )
  }

  // Load evidence timeline for this case
  const { data: evidence } = await sb
    .from('evidence_records')
    .select('*')
    .eq('entity_type', 'case')
    .eq('entity_id', id)
    .order('created_at', { ascending: true })

  // Fetch past stakeholders for autocomplete
  const { data: pastStakeholders } = await sb
    .from('case_stakeholders')
    .select('name, email, role')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Deduplicate stakeholder suggestions from all cases
  const { data: allStakeholders } = await sb
    .from('case_stakeholders')
    .select('name, email, role')
    .order('created_at', { ascending: false })
    .limit(100)

  const uniqueStakeholders = Array.from(
    new Map((allStakeholders || []).map(s => [s.email || s.name, s])).values()
  )

  // Load drafted actions for this case
  const { data: draftedActions } = await sb
    .from('drafted_actions')
    .select('*')
    .eq('case_id', id)
    .order('created_at', { ascending: false })

  // Also load evidence for drafted_action entity types
  const { data: actionEvidence } = await sb
    .from('evidence_records')
    .select('*')
    .eq('entity_type', 'drafted_action')
    .order('created_at', { ascending: true })

  const allEvidence = [...(evidence || []), ...(actionEvidence || [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  // Load signal details for template generation
  const signalData = caseRow.items ? {
    title: caseRow.items.title || 'Untitled signal',
    id: caseRow.items.id,
  } : null

  const isOverdue = caseRow.due_date && new Date(caseRow.due_date) < new Date() && caseRow.status !== 'closed'

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-400 flex items-center gap-1">
        <Link href="/cases" className="hover:text-blue-600 transition-colors">Cases</Link>
        <span>›</span>
        <span className="text-slate-600 truncate max-w-[300px]">{caseRow.title}</span>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{caseRow.title}</h1>
            {caseRow.description && (
              <p className="text-sm text-slate-500 mt-1">{caseRow.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={caseRow.priority} size="md" />
            <StatusBadge status={caseRow.status} size="md" />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 pt-2 border-t border-gray-100">
          {caseRow.items && (
            <div>
              <span className="text-slate-400">Signal: </span>
              <Link href={`/radar/${caseRow.items.id}`} className="text-blue-600 hover:underline">
                {caseRow.items.title || 'Untitled'}
              </Link>
            </div>
          )}
          {caseRow.internal_controls && (
            <div>
              <span className="text-slate-400">Control: </span>
              <Link href={`/controls/${caseRow.internal_controls.id}`} className="text-blue-600 hover:underline">
                {caseRow.internal_controls.ref && <span className="font-mono mr-1">{caseRow.internal_controls.ref}</span>}
                {caseRow.internal_controls.name}
              </Link>
            </div>
          )}
          <div>
            <span className="text-slate-400">Owner: </span>
            <span className="text-slate-600">{caseRow.owner_name || 'Unassigned'}</span>
            {caseRow.owner_email && <span className="text-slate-400 ml-1">({caseRow.owner_email})</span>}
          </div>
          <div>
            <span className="text-slate-400">Due: </span>
            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
              {caseRow.due_date
                ? new Date(caseRow.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Not set'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Created: </span>
            <span className="text-slate-600">
              {new Date(caseRow.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {caseRow.closed_at && (
            <div>
              <span className="text-slate-400">Closed: </span>
              <span className="text-slate-600">
                {new Date(caseRow.closed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive sections */}
      <CaseDetailClient
        caseId={id}
        caseData={caseRow}
        stakeholders={caseRow.case_stakeholders || []}
        notes={(caseRow.case_notes || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
        evidence={allEvidence}
        stakeholderSuggestions={uniqueStakeholders}
        draftedActions={draftedActions || []}
        signalTitle={signalData?.title || null}
        caseTitle={caseRow.title}
        caseDescription={caseRow.description || ''}
      />
    </main>
  )
}
