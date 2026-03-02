import { getServerClient, IMPACT_LABELS, IMPACT_COLORS, IMPACT_BORDER } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReviewActions  from './ReviewActions'
import OverridePanel  from '@/app/components/OverridePanel'
import ConfidenceBadge from '@/app/components/ConfidenceBadge'
import AIDisclaimer   from '@/app/components/AIDisclaimer'
import AuditTimeline  from '@/app/components/AuditTimeline'
import ControlMapper  from '@/app/components/ControlMapper'
import ItemComments   from '@/app/components/ItemComments'

interface Props { params: { id: string } }

export default async function ItemDetail({ params }: Props) {
  const sb = getServerClient()

  const { data: item } = await sb
    .from('items')
    .select(`*, sources(name, url, source_type, jurisdiction, kind), classifications(*)`)
    .eq('id', params.id)
    .single()

  if (!item) notFound()

  const cls  = (item.classifications as any[])?.[0]
  const src  = item.sources as any
  const level = cls?.override_level || cls?.impact_level
  const aiLevel = cls?.impact_level
  const hasOverride = Boolean(cls?.override_level)
  const confidenceScore: number = cls?.confidence_score ?? 75

  const { data: review } = await sb
    .from('item_reviews')
    .select('status, notes, reviewed_by, reviewed_at')
    .eq('item_id', params.id)
    .eq('workspace_id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle()

  const isoClauses: { code: string; name: string }[]   = cls?.iso_clauses   || []
  const nistControls: { code: string; name: string }[] = cls?.nist_controls || []

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <Link href="/items" className="hover:text-blue-600">Items</Link>
        <span>›</span>
        <span className="text-gray-600 truncate max-w-sm">{item.title || 'Item Detail'}</span>
      </div>

      {/* Title card */}
      <div className={`bg-white rounded-xl border-l-4 ${level ? IMPACT_BORDER[level] : 'border-gray-200'} border border-gray-200 p-6 shadow-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {hasOverride && (
                <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                  ⚠ Override
                </span>
              )}
              <ConfidenceBadge score={confidenceScore} size="sm" />
            </div>
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
              {hasOverride && <p className="text-xs opacity-60 mt-0.5">override</p>}
            </div>
          )}
        </div>
      </div>

      {/* AI Disclaimer */}
      {cls && (
        <AIDisclaimer confidenceScore={confidenceScore} hasOverride={hasOverride} />
      )}

      {cls ? (
        <>
          {/* Confidence + Override + Review — the compliance action row */}
          <div className="grid md:grid-cols-2 gap-4">
            <OverridePanel
              itemId={params.id}
              aiLevel={aiLevel}
              overrideLevel={cls.override_level}
              overrideReason={cls.override_reason}
              overriddenBy={cls.overridden_by}
              overriddenAt={cls.overridden_at}
            />
            <ReviewActions itemId={params.id} currentReview={review} />
          </div>

          {/* Confidence meter */}
          <ConfidenceBadge score={confidenceScore} size="lg" showBar />

          {/* ISO 27001 + NIST clause mapping */}
          {(isoClauses.length > 0 || nistControls.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Control Mapping</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {isoClauses.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                      ISO 27001:2022 Clauses
                    </p>
                    <div className="space-y-1.5">
                      {isoClauses.map((c) => (
                        <div key={c.code} className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded shrink-0">{c.code}</span>
                          <span className="text-xs text-slate-600">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {nistControls.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      NIST CSF 2.0 Controls
                    </p>
                    <div className="space-y-1.5">
                      {nistControls.map((c) => (
                        <div key={c.code} className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded shrink-0">{c.code}</span>
                          <span className="text-xs text-slate-600">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Audit Trail */}
          <AuditTimeline itemId={params.id} />

          {/* Full framework mappings */}
          {(cls.iso_domains?.length > 0 || cls.iso_tags?.length > 0 || cls.nist_csf_functions?.length > 0 || cls.nist_800_53_families?.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Full Framework Mappings</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {cls.iso_domains?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">ISO Domains</p>
                    <div className="flex flex-wrap gap-2">
                      {cls.iso_domains.map((d: string) => <span key={d} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">{d}</span>)}
                    </div>
                  </div>
                )}
                {cls.iso_tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">ISO Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {cls.iso_tags.map((t: string) => <span key={t} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">{t}</span>)}
                    </div>
                  </div>
                )}
                {cls.nist_csf_functions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">NIST CSF Functions</p>
                    <div className="flex flex-wrap gap-2">
                      {cls.nist_csf_functions.map((f: string) => <span key={f} className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">{f}</span>)}
                    </div>
                  </div>
                )}
                {cls.nist_800_53_families?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">NIST 800-53 Families</p>
                    <div className="flex flex-wrap gap-2">
                      {cls.nist_800_53_families.map((f: string) => <span key={f} className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded-md text-xs font-medium">{f}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 shadow-sm">
          No classification available for this item.
        </div>
      )}

      {/* Control Mapper + Comments */}
      <div className="grid md:grid-cols-2 gap-4">
        <ControlMapper itemId={params.id} />
        <ItemComments itemId={params.id} />
      </div>
    </div>
  )
}
