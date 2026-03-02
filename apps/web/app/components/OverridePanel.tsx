'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const IMPACT_LABELS: Record<string, string> = {
  '1': 'L1 — Informational',
  '2': 'L2 — Low',
  '3': 'L3 — Medium',
  '4': 'L4 — High / Action Required',
}

const IMPACT_COLORS: Record<string, string> = {
  '1': 'text-slate-600 bg-slate-50 border-slate-200',
  '2': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  '3': 'text-orange-700 bg-orange-50 border-orange-200',
  '4': 'text-red-700 bg-red-50 border-red-200',
}

interface Props {
  itemId: string
  aiLevel: string
  overrideLevel?: string | null
  overrideReason?: string | null
  overriddenBy?: string | null
  overriddenAt?: string | null
}

export default function OverridePanel({ itemId, aiLevel, overrideLevel, overrideReason, overriddenBy, overriddenAt }: Props) {
  const router = useRouter()
  const [showForm, setShowForm]     = useState(false)
  const [level, setLevel]           = useState(overrideLevel || aiLevel)
  const [reason, setReason]         = useState('')
  const [reviewer, setReviewer]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const hasOverride = Boolean(overrideLevel)

  const effectiveLevel = overrideLevel || aiLevel

  async function submitOverride() {
    if (!reviewer.trim()) { setError('Please enter your name or email'); return }
    if (level === aiLevel && !hasOverride) { setError('Select a different level to override'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, override_level: level, override_reason: reason, overridden_by: reviewer }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function clearOverride() {
    setLoading(true)
    try {
      await fetch(`/api/override?item_id=${itemId}&actor=${reviewer || 'system'}`, { method: 'DELETE' })
      setShowForm(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Impact Classification</h2>
        {hasOverride && (
          <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            ⚠ Human Override Active
          </span>
        )}
      </div>

      <div className="p-6 space-y-4">
        {/* AI vs Effective level display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-400 font-medium mb-1">AI Classification</p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${IMPACT_COLORS[aiLevel]}`}>
              {IMPACT_LABELS[aiLevel]}
            </div>
          </div>
          <div className={`rounded-lg border p-3 ${hasOverride ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-xs font-medium mb-1 text-gray-400">
              {hasOverride ? 'Overridden Level' : 'Effective Level'}
            </p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${IMPACT_COLORS[effectiveLevel]}`}>
              {IMPACT_LABELS[effectiveLevel]}
            </div>
          </div>
        </div>

        {/* Override details if active */}
        {hasOverride && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-800">Override recorded</p>
            {overriddenBy && <p className="text-xs text-amber-700">by {overriddenBy}</p>}
            {overriddenAt && (
              <p className="text-xs text-amber-600">
                {new Date(overriddenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {overrideReason && (
              <p className="text-xs text-amber-700 italic mt-1">"{overrideReason}"</p>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={() => setShowForm(true)} disabled={loading}
                className="text-xs text-amber-700 hover:text-amber-900 font-medium underline">
                Edit override
              </button>
              <span className="text-amber-300">·</span>
              <button onClick={clearOverride} disabled={loading}
                className="text-xs text-amber-700 hover:text-red-600 font-medium underline">
                Remove override
              </button>
            </div>
          </div>
        )}

        {/* Override button */}
        {!showForm && !hasOverride && (
          <button onClick={() => setShowForm(true)}
            className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium">
            + Override AI classification
          </button>
        )}

        {/* Override form */}
        {showForm && (
          <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-800">Override requires documented justification for audit trail</p>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">New impact level</label>
              <div className="grid grid-cols-2 gap-2">
                {(['4','3','2','1'] as const).map(l => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
                      level === l
                        ? `${IMPACT_COLORS[l]} border-current`
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {IMPACT_LABELS[l]}
                    {l === aiLevel && <span className="ml-1 opacity-60">(AI)</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Justification <span className="text-gray-400">(logged for audit)</span>
              </label>
              <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Explain why this classification should be overridden..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Your name / email</label>
              <input type="text" value={reviewer} onChange={e => setReviewer(e.target.value)}
                placeholder="e.g. justin@company.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={submitOverride} disabled={loading}
                className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
                {loading ? 'Saving…' : 'Confirm Override'}
              </button>
              <button onClick={() => { setShowForm(false); setError('') }} disabled={loading}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
