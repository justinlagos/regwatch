import { getServerClient } from '@/lib/supabase'
import { StatsCard, SectionHeader } from '@/app/components/ui'
import TriageQueue from './TriageQueue'

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

  const { data: allMatches } = await sb
    .from('signal_matches')
    .select('item_id, match_tier, confidence_score, matched_keyword, internal_controls(id, name, ref)')
    .in('item_id', ids)
    .in('match_tier', ['direct', 'context'])
    .order('confidence_score', { ascending: false })

  const matchesByItem: Record<string, any[]> = {}
  for (const m of (allMatches || [])) {
    if (!matchesByItem[m.item_id]) matchesByItem[m.item_id] = []
    matchesByItem[m.item_id].push(m)
  }

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
      control_matches:  matchesByItem[item.id] || [],
    }
  })
}

export default async function TriagePage() {
  const items = await getQueueItems()

  const pending       = items.filter(i => !i.review_status).length
  const reviewed      = items.filter(i => i.review_status === 'reviewed').length
  const escalated     = items.filter(i => i.review_status === 'escalated').length
  const dismissed     = items.filter(i => i.review_status === 'dismissed').length

  return (
    <div className="space-y-5">
      <SectionHeader title="Triage" subtitle="Decide what matters — review, escalate, or dismiss high-impact signals" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatsCard label="Pending" value={pending} color="text-red-700" bg="bg-red-50" />
        <StatsCard label="Escalated" value={escalated} color="text-orange-700" bg="bg-orange-50" />
        <StatsCard label="Reviewed" value={reviewed} color="text-emerald-700" bg="bg-emerald-50" />
        <StatsCard label="Dismissed" value={dismissed} color="text-slate-500" bg="bg-slate-50" />
      </div>

      <TriageQueue items={items} />
    </div>
  )
}
