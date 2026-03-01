'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReviewActionsProps {
  itemId: string
  currentReview?: { status: string; notes: string; reviewed_by: string; reviewed_at: string } | null
}

const STATUS_CONFIG = {
  reviewed:  { label: 'Mark Reviewed',  icon: '✓', color: 'bg-green-600 hover:bg-green-700 text-white',  badge: 'bg-green-100 text-green-800' },
  escalated: { label: 'Escalate',       icon: '↑', color: 'bg-orange-500 hover:bg-orange-600 text-white', badge: 'bg-orange-100 text-orange-800' },
  dismissed: { label: 'Dismiss',        icon: '×', color: 'bg-gray-500 hover:bg-gray-600 text-white',     badge: 'bg-gray-100 text-gray-600' },
}

export default function ReviewActions({ itemId, currentReview }: ReviewActionsProps) {
  const router = useRouter()
  const [status, setStatus]       = useState(currentReview?.status || '')
  const [notes, setNotes]         = useState(currentReview?.notes || '')
  const [reviewer, setReviewer]   = useState(currentReview?.reviewed_by || '')
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [pendingStatus, setPendingStatus] = useState('')
  const [error, setError]         = useState('')

  async function submit(selectedStatus: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          status: selectedStatus,
          notes,
          reviewed_by: reviewer,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save review')
      setStatus(selectedStatus)
      setShowForm(false)
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function clearReview() {
    setLoading(true)
    setError('')
    try {
      await fetch(`/api/review?item_id=${itemId}`, { method: 'DELETE' })
      setStatus('')
      setNotes('')
      setReviewer('')
      router.refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  function openForm(s: string) {
    setPendingStatus(s)
    setShowForm(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Review Queue</h2>
        {status && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.badge}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            <button onClick={clearReview} disabled={loading}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Clear
            </button>
          </div>
        )}
      </div>

      {status ? (
        <div className="space-y-2">
          <div className={`rounded-lg p-3 ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.badge}`}>
            <p className="text-sm font-medium">
              {status === 'reviewed' && '✓ Marked as reviewed'}
              {status === 'escalated' && '↑ Escalated for urgent action'}
              {status === 'dismissed' && '× Dismissed — no action required'}
            </p>
            {currentReview?.reviewed_by && (
              <p className="text-xs mt-1 opacity-70">by {currentReview.reviewed_by}</p>
            )}
            {currentReview?.reviewed_at && (
              <p className="text-xs opacity-70">
                {new Date(currentReview.reviewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          {notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
              <p className="text-sm text-gray-700">{notes}</p>
            </div>
          )}
          <button onClick={() => openForm(status)}
            className="text-xs text-blue-600 hover:underline">
            Edit review
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-4">This item hasn't been reviewed yet.</p>
      )}

      {!status && !showForm && (
        <div className="flex flex-wrap gap-2 mt-2">
          {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => openForm(key)} disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${cfg.color}`}>
              <span>{cfg.icon}</span> {cfg.label}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Your name / email</label>
            <input
              type="text"
              placeholder="e.g. justin@company.com"
              value={reviewer}
              onChange={e => setReviewer(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Add context, action taken, or follow-up details..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => submit(pendingStatus)} disabled={loading}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${STATUS_CONFIG[pendingStatus as keyof typeof STATUS_CONFIG]?.color} disabled:opacity-50`}>
              {loading ? 'Saving…' : `Confirm — ${pendingStatus.charAt(0).toUpperCase() + pendingStatus.slice(1)}`}
            </button>
            <button onClick={() => setShowForm(false)} disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
