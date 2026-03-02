import { getServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const sb = getServerClient()
  const { searchParams } = new URL(req.url)
  const level = searchParams.get('level')
  const source = searchParams.get('source')
  const q = searchParams.get('q')

  let query = sb
    .from('items')
    .select('id, title, canonical_url, detected_at, sources(name), classifications(impact_level, summary, confidence_score, iso_clauses, nist_controls)')
    .eq('state', 'classified')
    .order('detected_at', { ascending: false })
    .limit(5000)

  if (source) query = query.eq('source_id', source)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: items } = await query

  const filtered = level
    ? (items || []).filter((i: any) => i.classifications?.[0]?.impact_level === level)
    : items || []

  const rows = [
    ['ID', 'Title', 'Impact Level', 'Summary', 'Confidence %', 'ISO Clauses', 'NIST Controls', 'Source', 'Detected', 'URL'],
    ...filtered.map((i: any) => {
      const c = i.classifications?.[0]
      return [
        i.id,
        `"${(i.title || '').replace(/"/g, '""')}"`,
        c?.impact_level ? `L${c.impact_level}` : '',
        `"${(c?.summary || '').replace(/"/g, '""')}"`,
        c?.confidence_score ?? '',
        `"${(c?.iso_clauses || []).join(', ')}"`,
        `"${(c?.nist_controls || []).join(', ')}"`,
        (i.sources as any)?.name || '',
        new Date(i.detected_at).toISOString().split('T')[0],
        i.canonical_url || '',
      ].join(',')
    }),
  ].join('\n')

  return new NextResponse(rows, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="regwatch-export-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
