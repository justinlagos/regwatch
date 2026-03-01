import { getServerClient, IMPACT_LABELS, IMPACT_COLORS, IMPACT_BORDER } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: { id: string } }

export default async function ItemDetail({ params }: Props) {
  const sb = getServerClient()

  const { data: item } = await sb
    .from('items')
    .select(`
      *,
      sources(name, url, source_type, jurisdiction, kind),
      classifications(*)
    `)
    .eq('id', params.id)
    .single()

  if (!item) notFound()

  const cls = (item.classifications as any[])?.[0]
  const src = item.sources as any
  const level = cls?.impact_level

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400">
        <Link href="/items" className="hover:text-blue-600">Items</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-600 truncate">{item.title || 'Item Detail'}</span>
      </div>

      {/* Title card */}
      <div className={`bg-white rounded-xl border-l-4 ${level ? IMPACT_BORDER[level] : 'border-gray-200'} border border-gray-200 p-6 shadow-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">{item.title || 'Untitled'}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
              {src?.name && <span className="font-medium text-slate-600">{src.name}</span>}
              {src?.jurisdiction && <span>· {src.jurisdiction}</span>}
              {item.detected_at && <span>· {new Date(item.detected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
            </div>
            {item.canonical_url && (
              <a href={item.canonical_url} target="_blank" rel="noopener noreferrer"
                className="inline-block mt-2 text-xs text-blue-500 hover:underline truncate max-w-full">
                {item.canonical_url} ↗
              </a>
            )}
          </div>
          {level && (
            <div className={`shrink-0 text-center px-4 py-3 rounded-xl ${IMPACT_COLORS[level]}`}>
              <p className="text-2xl font-black">L{level}</p>
              <p className="text-xs font-semibold">{IMPACT_LABELS[level]}</p>
            </div>
          )}
        </div>
      </div>

      {cls ? (
        <>
          {/* Impact rationale */}
          {cls.impact_rationale && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Impact Rationale</h2>
              <p className="text-slate-700">{cls.impact_rationale}</p>
            </div>
          )}

          {/* Summary */}
          {cls.summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</h2>
              <p className="text-slate-700 leading-relaxed">{cls.summary}</p>
            </div>
          )}

          {/* Key points + Recommended action */}
          <div className="grid md:grid-cols-2 gap-4">
            {cls.key_points?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Points</h2>
                <ul className="space-y-2">
                  {cls.key_points.map((pt: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cls.recommended_action && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recommended Action</h2>
                <p className="text-sm text-slate-700 leading-relaxed">{cls.recommended_action}</p>
              </div>
            )}
          </div>

          {/* Frameworks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Framework Mappings</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {cls.iso_domains?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">ISO Domains</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.iso_domains.map((d: string) => (
                      <span key={d} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">{d}</span>
                    ))}
                  </div>
                </div>
              )}
              {cls.iso_tags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">ISO Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.iso_tags.map((t: string) => (
                      <span key={t} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {cls.nist_csf_functions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">NIST CSF Functions</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.nist_csf_functions.map((f: string) => (
                      <span key={f} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {cls.nist_800_53_families?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">NIST 800-53 Families</p>
                  <div className="flex flex-wrap gap-2">
                    {cls.nist_800_53_families.map((f: string) => (
                      <span key={f} className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded-md text-xs font-medium">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 shadow-sm">
          No classification available for this item.
        </div>
      )}
    </div>
  )
}
