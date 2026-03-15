import { EmptyState } from '@/app/components/ui'

export default function EvidencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1>Evidence</h1>
        <p className="text-slate-500 text-sm mt-1">Audit-ready ledger of all compliance decisions and actions</p>
      </div>

      <EmptyState message="Evidence ledger will automatically record every triage decision, case action, and report export. Coming in Phase 11." />
    </div>
  )
}
