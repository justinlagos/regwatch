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
  id: string; title: string; detected_at: string; source_name: string
  impact_level: string; confidence_score: number; summary: string
  recommended_action: string; review_status: string | null
  review_notes: string | null; reviewed_by: string | null; reviewed_at: string | null
  has_override: boolean; control_matches: ControlMatch[]
}

/* ── Constants ────────────────────────────────────────────── */

const IMPACT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '4': { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-100' },
  '3': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  '2': { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-100' },
  '1': { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-100' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  reviewed:  { label: 'Reviewed',  cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' },
  escalated: { label: 'Escalated', cls: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/10' },
  dismissed: { label: 'Dismissed', cls: 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-500/10' },
}

const FILTERS = [
  { key: 'pending', label: 'Pending' }, { key: 'escalated', label: 'Escalated' },
  { key: 'reviewed', label: 'Reviewed' }, { key: 'dismissed', label: 'Dismissed' }, { key: 'all', label: 'All' },
] as const

type FilterKey = typeof FILTERS[number]['key']

/* ── Small helpers ────────────────────────────────────────── */

function ConfidencePip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-400' : 'bg-red-400'
  const text  = score >= 85 ? 'text-emerald-700' : score >= 65 ? 'text-amber-700' : 'text-red-700'
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${text}`}><span className={`w-1.5 h-1.5 rounded-full ${color}`} />{score}%</span>
}

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'direct' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10' : 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/10'
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{tier}</span>
}

/* ── CreateCase Modal ─────────────────────────────────────── */

function CreateCaseModal({ item, onClose, onCreated }: { item: QueueItem; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(`Case: ${item.title}`)
  const [description, setDescription] = useState(item.summary || '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    try {
      const res = await fetch('/api/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: item.id, title, description, priority, owner_name: ownerName || null, owner_email: ownerEmail || null, due_date: dueDate || null }) })
      if (res.ok) onCreated()
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(8,12,30,0.4)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[16px] font-bold" style={{ color: '#0f1121' }}>Create Case</h3>
          <button onClick={onClose} className="rw-btn-ghost p-1 rounded-lg text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="rw-label">Title</label><input value={title} onChange={e => setTitle(e.target.value)} required className="rw-input" /></div>
          <div><label className="rw-label">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="rw-input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="rw-label">Priority</label><select value={priority} onChange={e => setPriority(e.target.value as any)} className="rw-input"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div><label className="rw-label">Due Date</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="rw-input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="rw-label">Owner Name</label><input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Optional" className="rw-input" /></div>
            <div><label className="rw-label">Owner Email</label><input type="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="Optional" className="rw-input" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rw-btn-ghost px-4 py-2">Cancel</button>
            <button type="submit" disabled={submitting || !title.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50">{submitting ? 'Creating…' : 'Create Case'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── ImpactEditor ─────────────────────────────────────────── */

function ImpactEditor({ item, onSave }: { item: QueueItem; onSave: (itemId: string, overrideLevel: string, notes: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(item.impact_level)
  const [notes, setNotes] = useState(item.review_notes || '')
  const [saving, setSaving] = useState(false)

  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] font-medium hover:text-indigo-600 transition-colors" style={{ color: '#8b90a5' }}>Edit impact</button>

  async function save() { setSaving(true); try { await onSave(item.id, level, notes); setOpen(false) } finally { setSaving(false) } }

  return (
    <div className="mt-2 p-3.5 rounded-xl border space-y-2" style={{ background: '#f8f9fc', borderColor: '#eef0f4' }}>
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-semibold w-14" style={{ color: '#8b90a5' }}>Impact</label>
        <div className="flex gap-1">
          {['1','2','3','4'].map(l => { const s = IMPACT_COLORS[l]; return (
            <button key={l} onClick={() => setLevel(l)} className={`w-7 h-7 rounded-lg text-[11px] font-bold border transition-colors ${level === l ? `${s.bg} ${s.text} ${s.border}` : 'bg-white border-[#e5e7ee] hover:border-[#d1d5e0]'}`} style={level !== l ? { color: '#8b90a5' } : {}}>{l}</button>
          )})}
        </div>
      </div>
      <div><label className="text-[11px] font-semibold" style={{ color: '#8b90a5' }}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes…" className="rw-input mt-1 text-[12px]" /></div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rw-btn-primary text-[11px]">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={() => setOpen(false)} className="rw-btn-ghost text-[11px]">Cancel</button>
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
  const [statuses, setStatuses] = useState<Record<string, string>>(Object.fromEntries(items.filter(i => i.review_status).map(i => [i.id, i.review_status!])))

  async function triageDecision(itemId: string, status: 'reviewed' | 'escalated' | 'dismissed', notes = '') {
    setLoadingId(itemId)
    try { await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, status, notes, reviewed_by: 'operator' }) }); setStatuses(p => ({ ...p, [itemId]: status })); router.refresh() } finally { setLoadingId(null) }
  }

  async function undoDecision(itemId: string) {
    setLoadingId(itemId)
    try { await fetch(`/api/review?item_id=${itemId}`, { method: 'DELETE' }); setStatuses(p => { const n = { ...p }; delete n[itemId]; return n }); router.refresh() } finally { setLoadingId(null) }
  }

  async function saveImpactOverride(itemId: string, overrideLevel: string, notes: string) {
    await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, status: 'reviewed', notes, reviewed_by: 'operator' }) })
    await fetch('/api/classify-override', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, override_level: overrideLevel }) }).catch(() => {})
    setStatuses(p => ({ ...p, [itemId]: 'reviewed' })); router.refresh()
  }

  const filtered = items.filter(item => { const s = statuses[item.id] || null; if (filter === 'all') return true; if (filter === 'pending') return !s; return s === filter })
  const pendingCount = items.filter(i => !statuses[i.id]).length

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
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
              filter === f.key ? 'bg-[#1a1d2e] text-white' : 'bg-white border text-[#3a3f56] hover:bg-[#f8f9fc]'
            }`} style={filter !== f.key ? { borderColor: '#e5e7ee' } : {}}>
            {f.label}
            {f.key === 'pending' && pendingCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none font-bold">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Queue */}
      {filtered.length === 0 ? (
        <div className="rw-card p-14 text-center">
          <p className="text-[13px] font-medium" style={{ color: '#6b7194' }}>{filter === 'pending' ? 'All caught up — no pending signals.' : `No ${filter} signals.`}</p>
        </div>
      ) : (
        <div className="rw-card overflow-hidden divide-y" style={{ borderColor: '#eef0f4' }}>
          {filtered.map(item => {
            const currentStatus = statuses[item.id]; const isLoading = loadingId === item.id
            const isExpanded = expandedId === item.id; const isLowConf = item.confidence_score < 65
            const directMatches = item.control_matches.filter(m => m.match_tier === 'direct')
            const contextMatches = item.control_matches.filter(m => m.match_tier === 'context')
            const ic = IMPACT_COLORS[item.impact_level] || IMPACT_COLORS['1']

            return (
              <div key={item.id} tabIndex={0} onKeyDown={e => handleKeyDown(e, item)}
                className={`focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isLowConf && !currentStatus ? 'bg-amber-50/30' : ''}`}>
                <div className="px-5 py-3.5 flex items-start gap-3.5">
                  <div className="pt-0.5 shrink-0">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold border ${ic.bg} ${ic.text} ${ic.border}`}>
                      {item.has_override ? '!' : ''}L{item.impact_level}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/radar/${item.id}`} className="text-[13px] font-semibold hover:text-indigo-600 transition-colors truncate" style={{ color: '#1a1d2e' }}>{item.title}</Link>
                      <ConfidencePip score={item.confidence_score} />
                      {currentStatus && <span className={`rw-badge ${STATUS_CONFIG[currentStatus]?.cls || ''}`}>{STATUS_CONFIG[currentStatus]?.label}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: '#8b90a5' }}>
                      <span>{item.source_name}</span><span>·</span>
                      <span>{new Date(item.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      {directMatches.length > 0 && <><span>·</span><span className="text-emerald-600 font-semibold">{directMatches.length} direct</span></>}
                      {contextMatches.length > 0 && <><span>·</span><span className="text-amber-600 font-semibold">{contextMatches.length} context</span></>}
                    </div>
                    {item.summary && !isExpanded && <p className="text-[11px] mt-1 line-clamp-1" style={{ color: '#6b7194' }}>{item.summary}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {!currentStatus ? (
                      <>
                        <button onClick={() => triageDecision(item.id, 'reviewed')} disabled={isLoading} title="Review (Enter)" className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50">Review</button>
                        <button onClick={() => triageDecision(item.id, 'escalated')} disabled={isLoading} title="Escalate (E)" className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50">Escalate</button>
                        <button onClick={() => triageDecision(item.id, 'dismissed')} disabled={isLoading} title="Dismiss (Esc)" className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50" style={{ background: '#eef0f4', color: '#6b7194' }}>Dismiss</button>
                      </>
                    ) : (
                      <button onClick={() => undoDecision(item.id)} disabled={isLoading} className="text-[11px] font-medium hover:text-red-500 transition-colors" style={{ color: '#8b90a5' }}>Undo</button>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="ml-1 text-[11px] transition-colors hover:text-indigo-600" style={{ color: '#8b90a5' }}>{isExpanded ? '▲' : '▼'}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4 space-y-3">
                    {item.summary && (
                      <div className="rounded-xl p-3.5 border" style={{ background: '#f8f9fc', borderColor: '#eef0f4' }}>
                        <p className="text-[12px]" style={{ color: '#3a3f56' }}>{item.summary}</p>
                        {item.recommended_action && (
                          <div className="mt-2 flex items-start gap-1.5">
                            <span className="text-[11px] text-indigo-500 shrink-0 font-semibold">Suggested:</span>
                            <p className="text-[11px] text-indigo-700 font-medium">{item.recommended_action}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {item.control_matches.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#3a3f56' }}>Matched Controls</p>
                        <div className="space-y-1">
                          {item.control_matches.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <TierBadge tier={m.match_tier} />
                              <Link href={`/controls/${m.internal_controls?.id}`} className="font-medium hover:text-indigo-600 truncate" style={{ color: '#1a1d2e' }}>
                                {m.internal_controls?.ref && <span className="font-mono mr-1" style={{ color: '#8b90a5' }}>{m.internal_controls.ref}</span>}
                                {m.internal_controls?.name || 'Unknown control'}
                              </Link>
                              {m.matched_keyword && <span className="ml-auto shrink-0" style={{ color: '#8b90a5' }}>"{m.matched_keyword}"</span>}
                              <span className="font-mono shrink-0" style={{ color: '#8b90a5' }}>{m.confidence_score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <ImpactEditor item={item} onSave={saveImpactOverride} />
                      {!currentStatus || currentStatus === 'escalated' ? <button onClick={() => setCaseItem(item)} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold transition-colors">+ Create Case</button> : null}
                      <Link href={`/radar/${item.id}`} className="ml-auto text-[10px] font-medium hover:text-indigo-600" style={{ color: '#8b90a5' }}>Full detail →</Link>
                    </div>
                    {currentStatus && item.reviewed_at && (
                      <p className="text-[10px]" style={{ color: '#8b90a5' }}>{STATUS_CONFIG[currentStatus]?.label} by {item.reviewed_by || 'operator'} on {new Date(item.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-center" style={{ color: '#8b90a5' }}>
        Keyboard: <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: '#eef0f4' }}>Enter</kbd> Review
        · <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: '#eef0f4' }}>E</kbd> Escalate
        · <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: '#eef0f4' }}>Esc</kbd> Dismiss
      </p>

      {caseItem && <CreateCaseModal item={caseItem} onClose={() => setCaseItem(null)} onCreated={() => { setCaseItem(null); router.refresh() }} />}
    </div>
  )
}
