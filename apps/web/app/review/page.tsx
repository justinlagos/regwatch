import { getServerClient } from '@/lib/supabase'
import ReviewQueue from './ReviewQueue'

export const revalidate = 30

async function getQueueItems() {
  const sb = getServerClient()

  // Fetch all L3+L4 items with their classification and any existing review
  const { data: items } = await sb
    .from('items')
    .select(`
      id, title, detected_at, canonical_url,
      sources(name),
      classifications(impact_level, summary, recommended_action),
      item_reviews(status, notes, reviewed_by, reviewed_at)
    `)
    .eq('state', 'classified')
    .in('id',
      // subquery via RPC-like: fetch IDs of L3+L4 items
      (await sb.from('classifications')
        .select('item_id')
        .in('impact_level', ['3', '4'])
      ).data?.map((r: any) => r.item_id) || []
    )
    .order('detected_at', { ascending: false })
    .limit(200)

  return (items || []).map((item: any) => {
    const cls     = item.classifications?.[0]
    const rev     = item.item_reviews?.[0]
    const src     = item.sources
    return {
      id:               item.id,
      title:            item.title || 'Untitled',
      detected_at:      item.detected_at,
      canonical_url:    item.canonical_url,
      source_name:      src?.name || 'Unknown',
      impact_level:     cls?.impact_level || '1',
      summary:          cls?.summary || '',
      recommended_action: cls?.recommended_action || '',
      review_status:    rev?.status || null,
      review_notes:     rev?.notes || null,
      reviewed_by:      rev?.reviewed_by || null,
      reviewed_at:      rev?.reviewed_at || null,
    }
  })
}

export default async function ReviewPage() {
  const items = await getQueueItems()

  const pending   = items.filter(i => !i.review_status).length
  const reviewed  = items.filter(i => i.review_status === 'reviewed').length
  const escalated = items.filter(i => i.review_status === 'escalated').length
  const dismissed = items.filter(i => i.review_status === 'dismissed').length

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-slate-500 text-sm mt-1">Action L3 + L4 items — mark reviewed, escalate, or dismiss</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', value: pending,   color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
          { label: 'Escalated',      value: escalated,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Reviewed',       value: reviewed,   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
          { label: 'Dismissed',      value: dismissed,  color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <ReviewQueue items={items} />
    </div>
  )
}
