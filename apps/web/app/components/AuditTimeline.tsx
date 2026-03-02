'use client'

import { useState, useEffect } from 'react'

interface AuditEntry {
  id: string
  action: string
  actor: string
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  notes: string
  created_at: string
}

const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  classified:       { label: 'AI Classified',       icon: '🤖', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  reviewed:         { label: 'Marked Reviewed',     icon: '✓',  color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  escalated:        { label: 'Escalated',           icon: '↑',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  dismissed:        { label: 'Dismissed',           icon: '×',  color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200' },
  overridden:       { label: 'Classification Overridden', icon: '⚠', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  override_removed: { label: 'Override Removed',   icon: '↩',  color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
  backfilled:       { label: 'Backfilled',          icon: '⚙',  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function EntryDetail({ entry }: { entry: AuditEntry }) {
  const cfg = ACTION_CONFIG[entry.action] || { label: entry.action, icon: '○', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' }

  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm shrink-0 ${cfg.bg}`}>
          {cfg.icon}
        </div>
        <div className="w-px flex-1 bg-gray-100 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500 font-medium">{entry.actor}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-400">{formatDate(entry.created_at)}</span>
        </div>

        {/* Notes */}
        {entry.notes && (
          <p className="text-xs text-gray-600 italic mt-0.5">"{entry.notes}"</p>
        )}

        {/* Value change */}
        {entry.action === 'overridden' && entry.old_value && entry.new_value && (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
              L{entry.old_value.impact_level}
            </span>
            <span className="text-xs text-gray-400">→</span>
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono font-semibold">
              L{entry.new_value.impact_level}
            </span>
          </div>
        )}

        {/* Confidence score on classified */}
        {entry.action === 'classified' && entry.new_value?.confidence_score && (
          <p className="text-xs text-blue-600 mt-0.5">
            Confidence: {entry.new_value.confidence_score}%
          </p>
        )}
      </div>
    </div>
  )
}

export default function AuditTimeline({ itemId }: { itemId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/audit?item_id=${itemId}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [itemId])

  const visible = expanded ? entries : entries.slice(0, 3)
  const hasMore = entries.length > 3

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Audit Trail</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {loading ? '…' : `${entries.length} event${entries.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No audit events yet</p>
        ) : (
          <div>
            {visible.map((entry, i) => (
              <div key={entry.id} style={{ opacity: 1 }}>
                {/* Hide the trailing line on last item */}
                <div className={i === visible.length - 1 ? '[&>div>div:nth-child(1)>div:nth-child(2)]:hidden' : ''}>
                  <EntryDetail entry={entry} />
                </div>
              </div>
            ))}
            {hasMore && (
              <button onClick={() => setExpanded(!expanded)}
                className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1 text-center hover:underline">
                {expanded ? '↑ Show less' : `↓ Show ${entries.length - 3} more events`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
