'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
}

const STATUS_CONFIG = {
  reviewed:  { label: 'Reviewed',  color: 'bg-green-100 text-green-800 border-green-200' },
  escalated: { label: 'Escalated', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const IMPACT_COLORS: Record<string, string> = {
  '4': 'bg-red-100 text-red-800',
  '3': 'bg-orange-100 text-orange-800',
  '2': 'bg-yellow-100 text-yellow-800',
  '1': 'bg-slate-100 text-slate-600',
}

function ConfidencePip({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-400' : 'bg-red-400'
  const textColor = score >= 85 ? 'text-emerald-700' : score >= 65 ? 'text-amber-700' : 'text-red-700'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${color}`} />
      {score}%
    </span>
  )
}

export default function ReviewQueue({ items, signalBasePath = '/items' }: { items: QueueItem[]; signalBasePath?: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<'all' | 'pending' | 'low-confidence' | 'reviewed' | 'escalated' | 'dismissed'>('pending')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(items.filter(i => i.review_status).map(i => [i.id, i.review_status!]))
  )

  async function quickReview(itemId: string, status: string) {
    setLoadingId(itemId)
    try {
      await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status }),
      })
      setStatuses(prev => ({ ...prev, [itemId]: status }))
      router.refresh()
    } finally {
      setLoadingId(null)
    }
  }

  const pendingCount      = items.filter(i => !statuses[i.id]).length
  const lowConfCount      = items.filter(i => !statuses[i.id] && i.confidence_score < 65).length

  const filtered = items.filter(item => {
    const s = statuses[item.id] || null
    if (filter === 'all') return true
    if (filter === 'pending') return !s
    if (filter === 'low-confidence') return !s && item.confidence_score < 65
    return s === filter
  })

  const FILTERS = [
    { key: 'pending',        label: 'Pending',        count: pendingCount, countColor: 'bg-red-500' },
    { key: 'low-confidence', label: '⚠ Low Confidence', count: lowConfCount, countColor: 'bg-amber-500' },
    { key: 'escalated',      label: 'Escalated',      count: null, countColor: '' },
    { key: 'reviewed',       label: 'Reviewed',       count: null, countColor: '' },
    { key: 'dismissed',      label: 'Dismissed',      count: null, countColor: '' },
    { key: 'all',            label: 'All',            count: null, countColor: '' },
  ] as const

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-slate-800 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'
            }`}>
            {f.label}
            {f.count != null && f.count > 0 && (
              <span className={`${f.countColor} text-white text-xs rounded-full px-1.5 py-0.5 leading-none`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <p className="text-3xl mb-2">{filter === 'pending' || filter === 'low-confidence' ? '✓' : '○'}</p>
          <p className="text-slate-500 font-medium">
            {filter === 'pending' ? 'All caught up!'
             : filter === 'low-confidence' ? 'No low-confidence items pending'
             : `No ${filter} items`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const currentStatus = statuses[item.id]
            const isLoading = loadingId === item.id
            const isLowConf = item.confidence_score < 65

            return (
              <div key={item.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                isLowConf && !currentStatus ? 'border-amber-200' : 'border-gray-200'
              }`}>
                {isLowConf && !currentStatus && (
                  <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5">
                    <p className="text-xs text-amber-700 font-medium">⚠ Low confidence — human review required</p>
                  </div>
                )}

                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${IMPACT_COLORS[item.impact_level]}`}>
                          {item.has_override ? '⚠' : ''} L{item.impact_level}
                        </span>
                        <ConfidencePip score={item.confidence_score} />
                        <span className="text-xs text-slate-400">{item.source_name}</span>
                        <span className="text-xs text-slate-400">· {new Date(item.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        {currentStatus && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG]?.color}`}>
                            {STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG]?.label}
                          </span>
                        )}
                      </div>
                      <Link href={`${signalBasePath}/${item.id}`}
                        className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors leading-tight block">
                        {item.title || 'Untitled'}
                      </Link>
                      {item.summary && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.summary}</p>}
                      {item.recommended_action && !currentStatus && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <span className="text-xs text-blue-500 shrink-0 mt-0.5">→</span>
                          <p className="text-xs text-blue-700 font-medium">{item.recommended_action}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                    {!currentStatus ? (
                      <>
                        <button onClick={() => quickReview(item.id, 'reviewed')} disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          {isLoading ? '…' : '✓'} Review
                        </button>
                        <button onClick={() => quickReview(item.id, 'escalated')} disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          {isLoading ? '…' : '↑'} Escalate
                        </button>
                        <button onClick={() => quickReview(item.id, 'dismissed')} disabled={isLoading}
                          className="flex items-center gap-1 px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          {isLoading ? '…' : '×'} Dismiss
                        </button>
                        <Link href={`${signalBasePath}/${item.id}`} className="ml-auto text-xs text-slate-400 hover:text-blue-600">
                          Full detail →
                        </Link>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 w-full text-xs text-slate-400">
                        {item.reviewed_by && <span>by {item.reviewed_by}</span>}
                        {item.reviewed_at && <span>· {new Date(item.reviewed_at).toLocaleDateString('en-GB')}</span>}
                        <Link href={`${signalBasePath}/${item.id}`} className="ml-auto hover:text-blue-600">Full detail →</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
