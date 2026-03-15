'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/* ── Types ────────────────────────────────────────────────── */

interface CaseData {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  owner_name: string | null
  owner_email: string | null
  due_date: string | null
}

interface Stakeholder {
  id: string
  name: string
  email: string | null
  role: string | null
  created_at: string
}

interface Note {
  id: string
  author: string
  content: string
  created_at: string
}

interface EvidenceRecord {
  id: string
  action_type: string
  actor: string
  metadata: any
  created_at: string
}

interface StakeholderSuggestion {
  name: string
  email: string | null
  role: string | null
}

/* ── Timeline Event Row ───────────────────────────────────── */

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  case_created:        { label: 'Case created',        color: 'bg-blue-500' },
  case_status_changed: { label: 'Status changed',      color: 'bg-amber-500' },
  case_closed:         { label: 'Case closed',         color: 'bg-gray-500' },
  case_note_added:     { label: 'Note added',          color: 'bg-slate-400' },
  signal_triaged:      { label: 'Signal triaged',      color: 'bg-emerald-500' },
  draft_created:       { label: 'Draft created',       color: 'bg-indigo-400' },
  draft_sent:          { label: 'Draft sent',          color: 'bg-indigo-600' },
}

function TimelineRow({ ev }: { ev: EvidenceRecord }) {
  const cfg = ACTION_LABELS[ev.action_type] || { label: ev.action_type, color: 'bg-slate-400' }
  const meta = ev.metadata || {}

  let detail = ''
  if (ev.action_type === 'case_status_changed') {
    detail = `${meta.old_status || '?'} → ${meta.new_status || '?'}`
  } else if (ev.action_type === 'case_created') {
    detail = meta.title || ''
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="pt-1.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700">{cfg.label}</p>
        {detail && <p className="text-xs text-slate-500 truncate">{detail}</p>}
      </div>
      <span className="text-[10px] text-slate-400 shrink-0">
        {new Date(ev.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        {' '}
        {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}

/* ── Stakeholder Panel ────────────────────────────────────── */

function StakeholderPanel({
  caseId,
  stakeholders: initial,
  suggestions,
  onRefresh,
}: {
  caseId: string
  stakeholders: Stakeholder[]
  suggestions: StakeholderSuggestion[]
  onRefresh: () => void
}) {
  const [stakeholders, setStakeholders] = useState(initial)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [adding, setAdding] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = suggestions.filter(s =>
    name.length >= 2 && s.name.toLowerCase().includes(name.toLowerCase()) &&
    !stakeholders.some(existing => existing.email === s.email && existing.name === s.name)
  )

  async function addStakeholder(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/cases/stakeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, name: name.trim(), email: email.trim() || null, role: role.trim() || null }),
      })
      if (res.ok) {
        const data = await res.json()
        setStakeholders(prev => [...prev, data])
        setName(''); setEmail(''); setRole('')
        onRefresh()
      }
    } finally { setAdding(false) }
  }

  async function removeStakeholder(id: string) {
    await fetch(`/api/cases/stakeholders?id=${id}`, { method: 'DELETE' })
    setStakeholders(prev => prev.filter(s => s.id !== id))
    onRefresh()
  }

  function applySuggestion(s: StakeholderSuggestion) {
    setName(s.name)
    setEmail(s.email || '')
    setRole(s.role || '')
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Stakeholders</h3>

      {stakeholders.length > 0 ? (
        <div className="space-y-1.5">
          {stakeholders.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {[s.role, s.email].filter(Boolean).join(' · ') || 'No details'}
                  </p>
                </div>
              </div>
              <button onClick={() => removeStakeholder(s.id)} className="text-slate-400 hover:text-red-500 text-xs transition-colors shrink-0 ml-2">
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No stakeholders added yet.</p>
      )}

      <form onSubmit={addStakeholder} className="space-y-2 pt-1">
        <div className="relative">
          <input value={name} onChange={e => { setName(e.target.value); setShowSuggestions(true) }}
            placeholder="Name" required
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-auto">
              {filtered.slice(0, 5).map((s, i) => (
                <button key={i} type="button" onClick={() => applySuggestion(s)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors">
                  <span className="font-medium">{s.name}</span>
                  {s.email && <span className="text-slate-400 ml-1">({s.email})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" type="email"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role (optional)"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        </div>
        <button type="submit" disabled={adding || !name.trim()}
          className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
          {adding ? 'Adding…' : '+ Add Stakeholder'}
        </button>
      </form>
    </div>
  )
}

/* ── Case Notes Panel ─────────────────────────────────────── */

function CaseNotesPanel({ caseId, notes: initial, onRefresh }: { caseId: string; notes: Note[]; onRefresh: () => void }) {
  const [notes, setNotes] = useState(initial)
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/cases/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, content: content.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setNotes(prev => [data, ...prev])
        setContent('')
        onRefresh()
      }
    } finally { setAdding(false) }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Notes</h3>

      <form onSubmit={addNote} className="flex gap-2">
        <input value={content} onChange={e => setContent(e.target.value)} placeholder="Add a note…"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
        <button type="submit" disabled={adding || !content.trim()}
          className="px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 shrink-0">
          {adding ? '…' : 'Add'}
        </button>
      </form>

      {notes.length > 0 ? (
        <div className="space-y-2">
          {notes.map(n => (
            <div key={n.id} className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-700">{n.content}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {n.author} · {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                {' '}
                {new Date(n.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">No notes yet.</p>
      )}
    </div>
  )
}

/* ── Closure Panel ────────────────────────────────────────── */

function ClosurePanel({ caseId, currentStatus, onRefresh }: { caseId: string; currentStatus: string; onRefresh: () => void }) {
  const [outcome, setOutcome] = useState('')
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)

  async function closeCase() {
    if (!outcome.trim()) return
    setClosing(true)
    try {
      await fetch('/api/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseId, status: 'closed', _old_status: currentStatus }),
      })
      // Add closure note
      await fetch('/api/cases/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, content: `Closure outcome: ${outcome}`, author: 'operator' }),
      })
      setOutcome('')
      onRefresh()
    } finally { setClosing(false) }
  }

  async function reopenCase() {
    setReopening(true)
    try {
      await fetch('/api/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseId, status: 'in_review', _old_status: 'closed', closed_at: null }),
      })
      onRefresh()
    } finally { setReopening(false) }
  }

  if (currentStatus === 'closed') {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">This case is closed.</p>
          <button onClick={reopenCase} disabled={reopening}
            className="px-3 py-1.5 text-xs font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50">
            {reopening ? 'Reopening…' : 'Reopen Case'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">Close Case</h3>
      <textarea value={outcome} onChange={e => setOutcome(e.target.value)} rows={2}
        placeholder="Describe the outcome or resolution…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
      <button onClick={closeCase} disabled={closing || !outcome.trim()}
        className="px-4 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50">
        {closing ? 'Closing…' : 'Close Case'}
      </button>
    </div>
  )
}

/* ── Status Update Bar ────────────────────────────────────── */

const STATUSES = ['drafted', 'assigned', 'waiting_for_input', 'in_review', 'closed'] as const

function StatusUpdateBar({ caseId, currentStatus, onRefresh }: { caseId: string; currentStatus: string; onRefresh: () => void }) {
  const [updating, setUpdating] = useState(false)

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      await fetch('/api/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseId, status: newStatus, _old_status: currentStatus }),
      })
      onRefresh()
    } finally { setUpdating(false) }
  }

  const available = STATUSES.filter(s => s !== currentStatus && s !== 'closed')

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500">Move to:</span>
      {available.map(s => (
        <button key={s} onClick={() => updateStatus(s)} disabled={updating}
          className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50 capitalize">
          {s.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  )
}

/* ── Template Generators ──────────────────────────────────── */

function generateHodEmail(caseTitle: string, caseDescription: string, signalTitle: string | null): { subject: string; body: string } {
  return {
    subject: `Action Required: ${caseTitle}`,
    body: `Dear [HOD Name],

I am writing to inform you of a regulatory development that may require action from your department.

What changed:
${signalTitle || caseTitle}

Why it matters:
${caseDescription || 'This has been identified as requiring attention during our compliance monitoring process.'}

Who is affected:
[Department / Team — please update]

Recommended deadline:
[Please confirm by DD/MM/YYYY]

Please review the above and confirm your department's response plan. I am available to discuss further if needed.

Kind regards,
[Your name]
Compliance & Information Security`,
  }
}

function generateInternalSummary(caseTitle: string, caseDescription: string, signalTitle: string | null): { subject: string; body: string } {
  return {
    subject: `Internal Summary: ${caseTitle}`,
    body: `ISSUE:
${signalTitle || caseTitle}

IMPLICATION:
${caseDescription || 'Requires assessment of impact on current controls and procedures.'}

ACTION REQUIRED:
[Describe the specific action needed — update policy, revise procedure, notify stakeholders, etc.]`,
  }
}

function generateEscalationNote(caseTitle: string, caseDescription: string): { subject: string; body: string } {
  return {
    subject: `Escalation: ${caseTitle}`,
    body: `ESCALATION NOTICE

Case: ${caseTitle}

Reason for escalation:
${caseDescription || '[Describe why this requires senior attention]'}

Risk level: [High / Critical]

Recommended action:
[Describe the recommended course of action]

Timeline: [Urgent / Within 5 working days / By next review cycle]

Escalated by: Compliance & Information Security`,
  }
}

/* ── Drafted Actions Panel ────────────────────────────────── */

interface DraftedAction {
  id: string
  case_id: string
  action_type: string
  recipient_name: string | null
  recipient_email: string | null
  subject: string | null
  body: string | null
  status: string
  sent_at: string | null
  created_at: string
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  hod_email:         { label: 'HOD Email',          icon: '✉' },
  internal_summary:  { label: 'Internal Summary',   icon: '📋' },
  escalation_note:   { label: 'Escalation Note',    icon: '⚡' },
  report_note:       { label: 'Report Note',        icon: '📄' },
}

const DRAFT_STATUS_STYLES: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600',
  ready:    'bg-blue-100 text-blue-700',
  sent:     'bg-emerald-100 text-emerald-700',
  archived: 'bg-gray-100 text-gray-400',
}

function DraftedActionsPanel({
  caseId,
  actions: initial,
  caseTitle,
  caseDescription,
  signalTitle,
  onRefresh,
}: {
  caseId: string
  actions: DraftedAction[]
  caseTitle: string
  caseDescription: string
  signalTitle: string | null
  onRefresh: () => void
}) {
  const [actions, setActions] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editRecipient, setEditRecipient] = useState('')
  const [editRecipientEmail, setEditRecipientEmail] = useState('')
  const [saving, setSaving] = useState(false)

  async function createDraft(type: string) {
    setCreating(true)
    let template: { subject: string; body: string }
    if (type === 'hod_email') template = generateHodEmail(caseTitle, caseDescription, signalTitle)
    else if (type === 'internal_summary') template = generateInternalSummary(caseTitle, caseDescription, signalTitle)
    else template = generateEscalationNote(caseTitle, caseDescription)

    try {
      const res = await fetch('/api/drafted-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          action_type: type,
          subject: template.subject,
          body: template.body,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setActions(prev => [data, ...prev])
        // Immediately open for editing
        setEditingId(data.id)
        setEditSubject(data.subject || '')
        setEditBody(data.body || '')
        setEditRecipient(data.recipient_name || '')
        setEditRecipientEmail(data.recipient_email || '')
        onRefresh()
      }
    } finally { setCreating(false) }
  }

  function startEdit(action: DraftedAction) {
    setEditingId(action.id)
    setEditSubject(action.subject || '')
    setEditBody(action.body || '')
    setEditRecipient(action.recipient_name || '')
    setEditRecipientEmail(action.recipient_email || '')
  }

  async function saveEdit() {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch('/api/drafted-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          subject: editSubject,
          body: editBody,
          recipient_name: editRecipient || null,
          recipient_email: editRecipientEmail || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setActions(prev => prev.map(a => a.id === editingId ? data : a))
        setEditingId(null)
        onRefresh()
      }
    } finally { setSaving(false) }
  }

  async function updateStatus(id: string, newStatus: string) {
    const res = await fetch('/api/drafted-actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
    if (res.ok) {
      const data = await res.json()
      setActions(prev => prev.map(a => a.id === id ? data : a))
      onRefresh()
    }
  }

  async function deleteDraft(id: string) {
    await fetch(`/api/drafted-actions?id=${id}`, { method: 'DELETE' })
    setActions(prev => prev.filter(a => a.id !== id))
    if (editingId === id) setEditingId(null)
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Drafted Actions</h3>
      </div>

      {/* Quick-create buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ACTION_TYPE_LABELS).filter(([k]) => k !== 'report_note').map(([type, cfg]) => (
          <button key={type} onClick={() => createDraft(type)} disabled={creating}
            className="px-2.5 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-50">
            {cfg.icon} Draft {cfg.label}
          </button>
        ))}
      </div>

      {/* Action list */}
      {actions.length === 0 ? (
        <p className="text-xs text-slate-400">No drafted actions yet. Use the buttons above to draft stakeholder communications.</p>
      ) : (
        <div className="space-y-3">
          {actions.map(action => {
            const typeCfg = ACTION_TYPE_LABELS[action.action_type] || { label: action.action_type, icon: '📄' }
            const isEditing = editingId === action.id

            return (
              <div key={action.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{typeCfg.icon}</span>
                    <span className="text-xs font-medium text-slate-700 truncate">{typeCfg.label}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DRAFT_STATUS_STYLES[action.status] || ''}`}>
                      {action.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {action.status === 'draft' && (
                      <>
                        <button onClick={() => isEditing ? saveEdit() : startEdit(action)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
                          {isEditing ? (saving ? 'Saving…' : 'Save') : 'Edit'}
                        </button>
                        <button onClick={() => updateStatus(action.id, 'ready')}
                          className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium">
                          Mark Ready
                        </button>
                      </>
                    )}
                    {action.status === 'ready' && (
                      <>
                        <button onClick={() => startEdit(action)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium">
                          Edit
                        </button>
                        <button onClick={() => updateStatus(action.id, 'sent')}
                          className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium">
                          Mark Sent
                        </button>
                      </>
                    )}
                    {action.status === 'sent' && action.sent_at && (
                      <span className="text-[10px] text-slate-400">
                        Sent {new Date(action.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {action.status !== 'sent' && (
                      <button onClick={() => deleteDraft(action.id)}
                        className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                {isEditing ? (
                  <div className="p-3 space-y-2">
                    {action.action_type === 'hod_email' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editRecipient} onChange={e => setEditRecipient(e.target.value)}
                          placeholder="Recipient name"
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                        <input value={editRecipientEmail} onChange={e => setEditRecipientEmail(e.target.value)}
                          placeholder="Recipient email" type="email"
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                      </div>
                    )}
                    <input value={editSubject} onChange={e => setEditSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={10}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500/30" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving}
                        className="px-2.5 py-1 bg-slate-800 text-white text-xs rounded font-medium hover:bg-slate-700 disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3">
                    {action.recipient_name && (
                      <p className="text-[10px] text-slate-400 mb-1">
                        To: {action.recipient_name} {action.recipient_email && `<${action.recipient_email}>`}
                      </p>
                    )}
                    {action.subject && (
                      <p className="text-xs font-medium text-slate-700 mb-1">{action.subject}</p>
                    )}
                    {action.body && (
                      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-auto">{action.body}</pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main Client Component ────────────────────────────────── */

export default function CaseDetailClient({
  caseId,
  caseData,
  stakeholders,
  notes,
  evidence,
  stakeholderSuggestions,
  draftedActions,
  signalTitle,
  caseTitle,
  caseDescription,
}: {
  caseId: string
  caseData: CaseData
  stakeholders: Stakeholder[]
  notes: Note[]
  evidence: EvidenceRecord[]
  stakeholderSuggestions: StakeholderSuggestion[]
  draftedActions: DraftedAction[]
  signalTitle: string | null
  caseTitle: string
  caseDescription: string
}) {
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div className="space-y-6">
      {/* Status update bar */}
      {caseData.status !== 'closed' && (
        <StatusUpdateBar caseId={caseId} currentStatus={caseData.status} onRefresh={refresh} />
      )}

      {/* Two-column layout: main + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Drafted Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <DraftedActionsPanel
              caseId={caseId}
              actions={draftedActions}
              caseTitle={caseTitle}
              caseDescription={caseDescription}
              signalTitle={signalTitle}
              onRefresh={refresh}
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <CaseNotesPanel caseId={caseId} notes={notes} onRefresh={refresh} />
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Timeline</h3>
            {evidence.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {evidence.map(ev => <TimelineRow key={ev.id} ev={ev} />)}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No timeline events yet.</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stakeholders */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <StakeholderPanel
              caseId={caseId}
              stakeholders={stakeholders}
              suggestions={stakeholderSuggestions}
              onRefresh={refresh}
            />
          </div>

          {/* Closure */}
          <ClosurePanel caseId={caseId} currentStatus={caseData.status} onRefresh={refresh} />
        </div>
      </div>
    </div>
  )
}
