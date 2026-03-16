'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Drawer, StatsCard } from '@/app/components/ui'

/* ── Types ────────────────────────────────────────────────── */

interface EvidenceRecord {
  id: string
  action_type: string
  entity_type: string
  entity_id: string
  actor: string
  metadata: any
  created_at: string
}

interface DetailData {
  record: EvidenceRecord
  linkedEntity: any
}

/* ── Constants ────────────────────────────────────────────── */

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  signal_triaged:      { label: 'Signal Triaged',      color: 'bg-emerald-500' },
  control_linked:      { label: 'Control Linked',      color: 'bg-blue-500' },
  case_created:        { label: 'Case Created',        color: 'bg-blue-600' },
  case_status_changed: { label: 'Status Changed',      color: 'bg-amber-500' },
  case_closed:         { label: 'Case Closed',         color: 'bg-gray-500' },
  case_note_added:     { label: 'Note Added',          color: 'bg-slate-400' },
  draft_created:       { label: 'Draft Created',       color: 'bg-indigo-400' },
  draft_sent:          { label: 'Draft Sent',          color: 'bg-indigo-600' },
  report_generated:    { label: 'Report Generated',    color: 'bg-purple-500' },
  report_exported:     { label: 'Report Exported',     color: 'bg-purple-600' },
}

const ENTITY_LINKS: Record<string, string> = {
  case: '/cases',
  signal: '/radar',
  item: '/radar',
  drafted_action: '',
  report: '/reports',
}

/* ── Detail Content ──────────────────────────────────────── */

function DetailContent({ data }: { data: DetailData }) {
  const { record, linkedEntity } = data
  const cfg = ACTION_LABELS[record.action_type] || { label: record.action_type, color: 'bg-slate-400' }

  return (
    <div className="space-y-5">
      <div>
        <p className="rw-label">Checkpoint</p>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.color}`} />
          <span className="text-[13px] font-medium text-slate-700">{cfg.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="rw-label">Timestamp</p>
          <p className="text-[12px] text-slate-700">
            {new Date(record.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            {' '}
            {new Date(record.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
        <div>
          <p className="rw-label">Actor</p>
          <p className="text-[12px] text-slate-700">{record.actor}</p>
        </div>
      </div>

      <div>
        <p className="rw-label">Entity</p>
        <p className="text-[12px] text-slate-600">
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{record.entity_type}</span>
          <span className="text-slate-400 ml-1.5 font-mono text-[10px]">{record.entity_id.slice(0, 8)}…</span>
        </p>
      </div>

      {linkedEntity && (
        <div>
          <p className="rw-label">Linked Record</p>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            {linkedEntity.title && <p className="text-[12px] font-medium text-slate-700">{linkedEntity.title}</p>}
            {linkedEntity.status && <p className="text-[11px] text-slate-500">Status: {linkedEntity.status}</p>}
            {linkedEntity.priority && <p className="text-[11px] text-slate-500">Priority: {linkedEntity.priority}</p>}
            {linkedEntity.subject && <p className="text-[12px] text-slate-600">{linkedEntity.subject}</p>}
            {linkedEntity.period_start && (
              <p className="text-[11px] text-slate-500">Period: {linkedEntity.period_start} — {linkedEntity.period_end}</p>
            )}
            {linkedEntity.sources?.name && <p className="text-[11px] text-slate-500">Source: {linkedEntity.sources.name}</p>}
            {linkedEntity.items?.title && <p className="text-[11px] text-slate-500">Signal: {linkedEntity.items.title}</p>}
            {linkedEntity.cases?.title && <p className="text-[11px] text-slate-500">Case: {linkedEntity.cases.title}</p>}
            {(record.entity_type === 'case' || record.entity_type === 'signal' || record.entity_type === 'item') && (
              <Link href={`${ENTITY_LINKS[record.entity_type]}/${record.entity_id}`}
                className="text-[11px] text-blue-600 hover:underline inline-block mt-1">
                View full record →
              </Link>
            )}
          </div>
        </div>
      )}

      {record.metadata && Object.keys(record.metadata).length > 0 && (
        <div>
          <p className="rw-label">Metadata</p>
          <div className="bg-slate-50 rounded-lg p-3 space-y-1">
            {Object.entries(record.metadata).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 text-[12px]">
                <span className="text-slate-400 font-mono shrink-0">{key}:</span>
                <span className="text-slate-700 break-all">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="rw-label">Record ID</p>
        <p className="text-[10px] text-slate-500 font-mono break-all">{record.id}</p>
      </div>
    </div>
  )
}

/* ── Main Page ────────────────────────────────────────────── */

export default function EvidencePage() {
  const [records, setRecords] = useState<EvidenceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [actionTypes, setActionTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [filterType, setFilterType] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(page))
    if (filterType) params.set('action_type', filterType)
    if (filterEntity) params.set('entity_type', filterEntity)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)

    try {
      const res = await fetch(`/api/evidence?${params}`)
      const data = await res.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
      setActionTypes(data.actionTypes || [])
    } finally {
      setLoading(false)
    }
  }, [page, filterType, filterEntity, filterFrom, filterTo])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  async function openDetail(id: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/evidence?id=${id}`)
      const data = await res.json()
      setDetailData(data)
    } finally {
      setDetailLoading(false)
    }
  }

  function exportCSV() {
    const headers = ['Timestamp', 'Checkpoint', 'Entity Type', 'Entity ID', 'Actor', 'Metadata']
    const rows = records.map(r => [
      new Date(r.created_at).toISOString(),
      r.action_type,
      r.entity_type,
      r.entity_id,
      r.actor,
      JSON.stringify(r.metadata || {}),
    ])
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidence-ledger-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    fetch('/api/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'evidence_export', format: 'csv' }),
    }).catch(() => {})
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="rw-page-title">Evidence Ledger</h1>
          <p className="rw-page-subtitle">Audit-ready record of all compliance decisions and actions.</p>
        </div>
        <button onClick={exportCSV} disabled={records.length === 0} className="rw-btn-secondary disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Total Records" value={total} />
        <StatsCard label="Checkpoint Types" value={actionTypes.length} />
        <StatsCard label="This Page" value={records.length} />
        <StatsCard label="Page" value={`${page + 1} / ${Math.max(totalPages, 1)}`} />
      </div>

      {/* Filters */}
      <div className="rw-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="rw-label">Checkpoint</label>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0) }} className="rw-input w-auto min-w-[160px]">
              <option value="">All types</option>
              {actionTypes.map(t => (
                <option key={t} value={t}>{ACTION_LABELS[t]?.label || t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rw-label">Entity</label>
            <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0) }} className="rw-input w-auto">
              <option value="">All entities</option>
              <option value="case">Case</option>
              <option value="signal">Signal</option>
              <option value="item">Item</option>
              <option value="drafted_action">Drafted Action</option>
              <option value="report">Report</option>
            </select>
          </div>
          <div>
            <label className="rw-label">From</label>
            <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(0) }} className="rw-input w-auto" />
          </div>
          <div>
            <label className="rw-label">To</label>
            <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(0) }} className="rw-input w-auto" />
          </div>
          {(filterType || filterEntity || filterFrom || filterTo) && (
            <button onClick={() => { setFilterType(''); setFilterEntity(''); setFilterFrom(''); setFilterTo(''); setPage(0) }}
              className="rw-btn-ghost text-slate-400 hover:text-red-500">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rw-card p-12 text-center"><p className="text-slate-400 text-[13px]">Loading…</p></div>
      ) : records.length === 0 ? (
        <div className="rw-card p-12 text-center">
          <p className="text-slate-500 text-[13px] font-medium">No evidence records found.</p>
          <p className="text-[11px] text-slate-400 mt-1">Evidence is automatically logged during triage, case management, and reporting.</p>
        </div>
      ) : (
        <div className="rw-card overflow-hidden">
          <table className="rw-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Checkpoint</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Details</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const cfg = ACTION_LABELS[r.action_type] || { label: r.action_type, color: 'bg-slate-400' }
                const meta = r.metadata || {}
                let detail = ''
                if (meta.title) detail = meta.title
                else if (meta.old_status && meta.new_status) detail = `${meta.old_status} → ${meta.new_status}`
                else if (meta.template) detail = meta.template.replace(/_/g, ' ')
                else if (meta.action_type) detail = meta.action_type.replace(/_/g, ' ')

                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      <span className="text-slate-400 ml-1">
                        {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                        <span className="font-medium text-slate-700">{cfg.label}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                        {r.entity_type}
                      </span>
                    </td>
                    <td className="text-slate-500">{r.actor}</td>
                    <td className="text-slate-500 max-w-[200px] truncate">{detail || '—'}</td>
                    <td>
                      <button onClick={() => openDetail(r.id)} disabled={detailLoading}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rw-btn-secondary disabled:opacity-30">
            Previous
          </button>
          <span className="text-[12px] text-slate-400">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rw-btn-secondary disabled:opacity-30">
            Next
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      <Drawer open={!!detailData} onClose={() => setDetailData(null)} title="Evidence Detail">
        {detailData && <DetailContent data={detailData} />}
      </Drawer>
    </div>
  )
}
