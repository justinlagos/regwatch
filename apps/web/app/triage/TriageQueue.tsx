'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/* ── Types ────────────────────────────────────────────────── */

interface ControlMatch {
  item_id: string
  match_tier: 'direct' | 'context'
  confidence_score: number
  matched_keyword: string | null
  internal_controls: { id: string; name: string; ref: string | null } | null
}

interface QueueItem {
  id: string
  title: string
  detected_at: string
  source_name: string
  impact_level: string
  confidence_score: number
  summary: string
  recommended_action: string
  review_status: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  has_override: boolean
  control_matches: ControlMatch[]
}

/* ── Constants ────────────────────────────────────────────── */

const IMPACT_COLORS: Record<string, string> = {
  '4': 'bg-red-100 text-red-800',
  '3': 'bg-orange-100 text-orange-800',
  '2': 'bg-yellow-100 text-yellow-800',
  '1': 'bg-slate-100 text-slate-600',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  reviewed:  { label: 'Reviewed',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  escalated: { label: 'Escalated', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const FILTERS = [
  { key: 'pending',   label: 'Pending'   },
  { key: 'escalated', label: 'Escalated' },
  { key: 'reviewed',  label: 'Reviewed'  },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all',       label: 'All'       },
] as const

type FilterKey = typeof FILTERS[number]['key']

/* ── Small helpers ────────────────────────────────────────── */

function ConfidencePip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-400' : 'bg-red-400'
  const text  = score >= 85 ? 'text-emerald-700' : score >= 65 ? 'text-amber-700' : 'text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {score}%
    </span>
  )
}

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'direct'
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-700'
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>{tier}</span>
}

/* ── CreateCase Modal ─────────────────────────────────────── */

function CreateCaseModal({
  item,
  onClose,
  onCreated,
}: {
  item: QueueItem
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState(`Case: ${item.title}`)
  const [description, setDescription] = useState(item.summary || '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: item.id,
          title,
          description,
          priority,
          owner_name: ownerName || null,
          owner_email: ownerEmail || null,
          due_date: dueDate || null,
        }),
      })
      if (res.ok) onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Create Case</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as any)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Owner Name</label>
              <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Owner Email</label>
              <input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="Optional"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !title.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── ImpactEditor (inline severity/confidence/notes) ──────── */

function ImpactEditor({
  item,
  onSave,
}: {
  item: QueueItem
  onSave: (itemId: string, overrideLevel: string, notes: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(item.impact_level)
  const [notes, setNotes] = useState(item.review_notes || '')
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] text-slate-400 hover:text-blue-600 transition-colors">
        Edit impact
      </button>
    )
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(item.id, level, notes)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500 w-16">Impact</label>
        <div className="flex gap-1">
          {['1', '2', '3', '4'].map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                level === l ? IMPACT_COLORS[l] : 'bg-white border border-gray-200 text-slate-400 hover:border-slate-300'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…"
          className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="px-2.5 py-1 bg-slate-800 text-white text-xs rounded font-medium hover:bg-slate-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  )
}

/* ── Main TriageQueue ─────────────────────────────────────── */

export default function TriageQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('pending')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [caseItem, setCaseItem] = useState<QueueItem | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(items.filter(i => i.review_status).map(i => [i.id, i.review_status!]))
  )

  /* ── Actions ── */

  async function triageDecision(itemId: string, status: 'reviewed' | 'escalated' | 'dismissed', notes = '') {
    setLoadingId(itemId)
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status, notes, reviewed_by: 'operator' }),
      })
      setStatuses(prev => ({ ...prev, [itemId]: status }))
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  async function undoDecision(itemId: string) {
    setLoadingId(itemId)
    try {
      await fetch(`/api/review?item_id=${itemId}`, { method: 'DELETE' })
      setStatuses(prev => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  async function saveImpactOverride(itemId: string, overrideLevel: string, notes: string) {
    await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, status: 'reviewed', notes, reviewed_by: 'operator' }),
    })
    // Also update the classification override
    await fetch('/api/classify-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, override_level: overrideLevel }),
    }).catch(() => {})
    setStatuses(prev => ({ ...prev, [itemId]: 'reviewed' }))
    router.refresh()
  }

  /* ── Filtering ── */

  const filtered = items.filter(item => {
    const s = statuses[item.id] || null
    if (filter === 'all') return true
    if (filter === 'pending') return !s
    return s === filter
  })

  const pendingCount = items.filter(i => !statuses[i.id]).length

  /* ── Keyboard ── */

  function handleKeyDown(e: React.KeyboardEvent, item: QueueItem) {
    if (statuses[item.id]) return
    if (e.key === 'Enter') { e.preventDefault(); triageDecision(item.id, 'reviewed') }
    if (e.key === 'Escape') { e.preventDefault(); triageDecision(item.id, 'dismissed') }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); triageDecision(item.id, 'escalated') }
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'
            }`}>
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">
            {filter === 'pending' ? 'All caught up — no pending signals.' : `No ${filter} signals.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
          {filtered.map(item => {
            const currentStatus = statuses[item.id]
            const isLoading = loadingId === item.id
            const isExpanded = expandedId === item.id
            const isLowConf = item.confidence_score < 65
            const directMatches = item.control_matches.filter(m => m.match_tier === 'direct')
            const contextMatches = item.control_matches.filter(m => m.match_tier === 'context')

            return (
              <div key={item.id}
                tabIndex={0}
                onKeyDown={e => handleKeyDown(e, item)}
                className={`focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                  isLowConf && !currentStatus ? 'bg-amber-50/30' : ''
                }`}>
                {/* Row */}
                <div className="px-4 sm:px-5 py-3 flex items-start gap-3">
                  {/* Left: impact badge */}
                  <div className="pt-0.5 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${IMPACT_COLORS[item.impact_level]}`}>
                      {item.has_override ? '!' : ''}L{item.impact_level}
                    </span>
                  </div>

                  {/* Center: main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/radar/${item.id}`}
                        className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors truncate">
                        {item.title || 'Untitled'}
                      </Link>
                      <ConfidencePip score={item.confidence_score} />
                      {currentStatus && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CONFIG[currentStatus]?.color || ''}`}>
                          {STATUS_CONFIG[currentStatus]?.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{item.source_name}</span>
                      <span>·</span>
                      <span>{new Date(item.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      {directMatches.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-600 font-medium">
                            {directMatches.length} direct match{directMatches.length > 1 ? 'es' : ''}
                          </span>
                        </>
                      )}
                      {contextMatches.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600 font-medium">
                            {contextMatches.length} context
                          </span>
                        </>
                      )}
                    </div>

                    {/* Summary preview */}
                    {item.summary && !isExpanded && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.summary}</p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {!currentStatus ? (
                      <>
                        <button onClick={() => triageDecision(item.id, 'reviewed')} disabled={isLoading}
                          title="Review (Enter)"
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50">
                          Review
                        </button>
                        <button onClick={() => triageDecision(item.id, 'escalated')} disabled={isLoading}
                          title="Escalate (E)"
                          className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors disabled:opacity-50">
                          Escalate
                        </button>
                        <button onClick={() => triageDecision(item.id, 'dismissed')} disabled={isLoading}
                          title="Dismiss (Esc)"
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium transition-colors disabled:opacity-50">
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button onClick={() => undoDecision(item.id)} disabled={isLoading}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                        Undo
                      </button>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="ml-1 text-slate-400 hover:text-slate-600 text-xs transition-colors">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Expanded panel: match context + details */}
                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 space-y-3">
                    {/* Summary + recommended action */}
                    {item.summary && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-600">{item.summary}</p>
                        {item.recommended_action && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <span className="text-xs text-blue-500 shrink-0">Suggested:</span>
                            <p className="text-xs text-blue-700 font-medium">{item.recommended_action}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Control matches */}
                    {item.control_matches.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1.5">Matched Controls</p>
                        <div className="space-y-1">
                          {item.control_matches.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <TierBadge tier={m.match_tier} />
                              <Link href={`/controls/${m.internal_controls?.id}`}
                                className="text-slate-700 hover:text-blue-600 font-medium truncate">
                                {m.internal_controls?.ref && (
                                  <span className="text-slate-400 font-mono mr-1">{m.internal_controls.ref}</span>
                                )}
                                {m.internal_controls?.name || 'Unknown control'}
                              </Link>
                              {m.matched_keyword && (
                                <span className="text-slate-400 ml-auto shrink-0">"{m.matched_keyword}"</span>
                              )}
                              <span className="text-slate-400 font-mono shrink-0">{m.confidence_score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Impact editor + Create Case */}
                    <div className="flex items-center gap-3 pt-1">
                      <ImpactEditor item={item} onSave={saveImpactOverride} />
                      {!currentStatus || currentStatus === 'escalated' ? (
                        <button onClick={() => setCaseItem(item)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium transition-colors">
                          + Create Case
                        </button>
                      ) : null}
                      <Link href={`/radar/${item.id}`} className="ml-auto text-[10px] text-slate-400 hover:text-blue-600">
                        Full detail →
                      </Link>
                    </div>

                    {/* Reviewed info */}
                    {currentStatus && item.reviewed_at && (
                      <p className="text-[10px] text-slate-400">
                        {STATUS_CONFIG[currentStatus]?.label} by {item.reviewed_by || 'operator'} on{' '}
                        {new Date(item.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Keyboard hint */}
      <p className="text-[10px] text-slate-400 text-center">
        Keyboard: <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Enter</kbd> Review
        · <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">E</kbd> Escalate
        · <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Esc</kbd> Dismiss
      </p>

      {/* Create Case Modal */}
      {caseItem && (
        <CreateCaseModal
          item={caseItem}
          onClose={() => setCaseItem(null)}
          onCreated={() => {
            setCaseItem(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
