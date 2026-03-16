'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IMPACT_LABELS } from '@/lib/supabase'
import { useState, useTransition } from 'react'

interface Source { id: string; name: string }
interface WatchlistOption { id: string; name: string }
interface Props {
  sources: Source[]
  watchlists?: WatchlistOption[]
  currentLevel?: string
  currentSource?: string
  currentQ?: string
  currentWatchlist?: string
  basePath?: string
}

export default function FilterBar({ sources, watchlists, currentLevel, currentSource, currentQ, currentWatchlist, basePath = '/items' }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ || '')
  const [, startTransition] = useTransition()

  function buildParams(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const vals = { level: currentLevel, source: currentSource, watchlist: currentWatchlist, q: q || undefined, ...overrides }
    Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }

  function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`${basePath}?${buildParams({ source: e.target.value || undefined, page: undefined })}`)
  }

  function handleWatchlistChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`${basePath}?${buildParams({ watchlist: e.target.value || undefined, page: undefined })}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => { router.push(`${basePath}?${buildParams({ page: undefined })}`) })
  }

  function exportUrl() {
    const p = new URLSearchParams()
    if (currentLevel) p.set('level', currentLevel)
    if (currentSource) p.set('source', currentSource)
    if (q) p.set('q', q)
    return `/api/export?${p.toString()}`
  }

  return (
    <div className="space-y-3">
      {/* Search row */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search signals…" className="rw-input flex-1" />
        <button type="submit" className="rw-btn-primary">Search</button>
        <a href={exportUrl()} className="rw-btn-secondary whitespace-nowrap">Export CSV</a>
      </form>

      {/* Filters row */}
      <div className="rw-card p-3.5 flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8b90a5', letterSpacing: '0.08em' }}>Level:</span>
        {['', '4', '3', '2', '1'].map(l => (
          <Link key={l} href={`${basePath}?${buildParams({ level: l || undefined, page: undefined })}`}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
              currentLevel === l || (!currentLevel && !l)
                ? 'bg-[#1a1d2e] text-white border-[#1a1d2e]'
                : 'bg-white border-[#e5e7ee] hover:border-[#d1d5e0]'
            }`} style={currentLevel === l || (!currentLevel && !l) ? {} : { color: '#3a3f56' }}>
            {l ? `L${l} — ${IMPACT_LABELS[l]}` : 'All'}
          </Link>
        ))}

        <div className="w-px h-5 mx-1" style={{ background: '#e5e7ee' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8b90a5', letterSpacing: '0.08em' }}>Source:</span>
        <select className="rw-input w-auto min-w-[140px] py-1.5 text-[12px]" defaultValue={currentSource || ''} onChange={handleSourceChange}>
          <option value="">All sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {watchlists && watchlists.length > 0 && (
          <>
            <div className="w-px h-5 mx-1" style={{ background: '#e5e7ee' }} />
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#8b90a5', letterSpacing: '0.08em' }}>Watchlist:</span>
            <select className="rw-input w-auto min-w-[120px] py-1.5 text-[12px]" defaultValue={currentWatchlist || ''} onChange={handleWatchlistChange}>
              <option value="">All</option>
              {watchlists.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </>
        )}
      </div>
    </div>
  )
}
