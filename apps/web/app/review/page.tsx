import { getServerClient } from '@/lib/supabase'
import ReviewQueue from './ReviewQueue'

export const revalidate = 30

async function getQueueItems() {
  const sb = getServerClient()

  const { data: highImpactIds } = await sb
    .from('classifications')
    .select('item_id')
    .in('impact_level', ['3', '4'])

  const ids = (highImpactIds || []).map((r: any) => r.item_id)
  if (!ids.length) return []

  const { data: items } = await sb
    .from('items')
    .select(`
      id, title, detected_at, canonical_url,
      sources(name),
      classifications(impact_level, confidence_score, summary, recommended_action, override_level),
      item_reviews(status, notes, reviewed_by, reviewed_at)
    `)
    .eq('state', 'classified')
    .in('id', ids)
    .order('detected_at', { ascending: false })
    .limit(200)

  return (items || []).map((item: any) => {
    const cls = item.classifications?.[0]
    const rev = item.item_reviews?.[0]
    return {
      id:               item.id,
      title:            item.title || 'Untitled',
      detected_at:      item.detected_at,
      source_name:      item.sources?.name || 'Unknown',
      impact_level:     cls?.override_level || cls?.impact_level || '1',
      confidence_score: cls?.confidence_score ?? 75,
      summary:          cls?.summary || '',
      recommended_action: cls?.recommended_action || '',
      review_status:    rev?.status || null,
      review_notes:     rev?.notes || null,
      reviewed_by:      rev?.reviewed_by || null,
      reviewed_at:      rev?.reviewed_at || null,
      has_override:     Boolean(cls?.override_level),
    }
  })
}

export default async function ReviewPage() {
  const items = await getQueueItems()

  const pending       = items.filter(i => !i.review_status).length
  const reviewed      = items.filter(i => i.review_status === 'reviewed').length
  const escalated     = items.filter(i => i.review_status === 'escalated').length
  const dismissed     = items.filter(i => i.review_status === 'dismissed').length
  const lowConfidence = items.filter(i => !i.review_status && i.confidence_score < 65).length

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Action L3 + L4 items — review, escalate, dismiss, or override classification</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Pending',        value: pending,       color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
          { label: '⚠ Low Confidence', value: lowConfidence, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Escalated',      value: escalated,     color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Reviewed',       value: reviewed,      color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
          { label: 'Dismissed',      value: dismissed,     color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500 leading-tight">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <ReviewQueue items={items} />
    </div>
  )
}
