'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Control { id: string; name: string; ref: string; framework: string }
interface Mapping { id: string; control_id: string; status: string; notes: string; internal_controls: Control }

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string }> = {
  mapped:      { label: 'Mapped',      color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',    next: 'in_progress' },
  in_progress: { label: 'In Progress', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',  next: 'remediated' },
  remediated:  { label: 'Remediated',  color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', next: 'mapped' },
}

export default function ControlMapper({ itemId }: { itemId: string }) {
  const router = useRouter()
  const [controls, setControls] = useState<Control[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedControl, setSelectedControl] = useState('')
  const [notes, setNotes] = useState('')
  const [mapper, setMapper] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch(`/api/controls?item_id=${itemId}`)
    const d = await res.json()
    setControls(d.controls || [])
    setMappings(d.mappings || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [itemId])

  const mappedIds = new Set(mappings.map(m => m.control_id))
  const available = controls.filter(c => !mappedIds.has(c.id))

  async function addMapping() {
    if (!selectedControl) return
    setSaving(true)
    await fetch('/api/controls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, control_id: selectedControl, notes, mapped_by: mapper }),
    })
    setAdding(false); setSelectedControl(''); setNotes(''); setMapper('')
    await load(); router.refresh(); setSaving(false)
  }

  async function updateStatus(mapping: Mapping) {
    await fetch('/api/controls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mapping.id, status: STATUS_CONFIG[mapping.status].next, notes: mapping.notes }),
    })
    await load(); router.refresh()
  }

  async function removeMapping(id: string) {
    await fetch(`/api/controls?id=${id}`, { method: 'DELETE' })
    await load(); router.refresh()
  }

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Internal Controls</h3>
          <p className="text-xs text-slate-400 mt-0.5">Map this item to your controls and track remediation</p>
        </div>
        {!adding && available.length > 0 && (
          <button onClick={() => setAdding(true)}
            className="text-xs px-3 py-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
            + Map Control
          </button>
        )}
      </div>

      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="space-y-2 mb-4">
          {mappings.map(m => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.mapped
            return (
              <div key={m.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${cfg.bg}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{m.internal_controls?.ref}</span>
                    <span className="text-sm font-medium text-slate-700">{m.internal_controls?.name}</span>
                  </div>
                  {m.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{m.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button onClick={() => updateStatus(m)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border ${cfg.color} ${cfg.bg} hover:opacity-80 transition-opacity`}>
                    {cfg.label} →
                  </button>
                  <button onClick={() => removeMapping(m.id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors">✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mappings.length === 0 && !adding && (
        <p className="text-sm text-slate-400 text-center py-4">No controls mapped yet.</p>
      )}

      {/* Add mapping form */}
      {adding && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
          <select value={selectedControl} onChange={e => setSelectedControl(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <option value="">Select a control…</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>{c.ref} — {c.name}</option>
            ))}
          </select>
          <input value={mapper} onChange={e => setMapper(e.target.value)} placeholder="Your name"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none" />
          <div className="flex gap-2">
            <button onClick={addMapping} disabled={!selectedControl || saving}
              className="flex-1 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-colors">
              {saving ? 'Saving…' : 'Map Control'}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-4 py-2 border border-gray-300 text-sm text-slate-600 rounded-lg hover:bg-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
