'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IMPACT_LABELS } from '@/lib/supabase'
import { useState, useTransition } from 'react'

interface Source { id: string; name: string }
interface Props {
  sources: Source[]
  currentLevel?: string
  currentSource?: string
  currentQ?: string
  basePath?: string
}

export default function FilterBar({ sources, currentLevel, currentSource, currentQ, basePath = '/items' }: Props) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ || '')
  const [, startTransition] = useTransition()

  function buildParams(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const vals = { level: currentLevel, source: currentSource, q: q || undefined, ...overrides }
    Object.entries(vals).forEach(([k, v]) => { if (v) p.set(k, v) })
    return p.toString()
  }

  function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`${basePath}?${buildParams({ source: e.target.value || undefined, page: undefined })}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => {
      router.push(`${basePath}?${buildParams({ page: undefined })}`)
    })
  }

  function exportUrl() {
    const p = new URLSearchParams()
    if (currentLevel) p.set('level', currentLevel)
    if (currentSource) p.set('source', currentSource)
    if (q) p.set('q', q)
    return `/api/export?${p.toString()}`
  }

  return (
    <div className="space-y-2">
      {/* Search row */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search items…"
          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 text-slate-700 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button type="submit"
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors">
          Search
        </button>
        <a href={exportUrl()}
          className="px-4 py-2 bg-white border border-gray-300 text-slate-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
          ↓ Export CSV
        </a>
      </form>

      {/* Filters row */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Level:</span>
        {['', '4', '3', '2', '1'].map(l => (
          <Link
            key={l}
            href={`${basePath}?${buildParams({ level: l || undefined, page: undefined })}`}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              currentLevel === l || (!currentLevel && !l)
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-gray-300 hover:border-slate-400'
            }`}>
            {l ? `L${l} — ${IMPACT_LABELS[l]}` : 'All'}
          </Link>
        ))}
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Source:</span>
        <select
          className="text-xs border border-gray-300 rounded-lg px-2 py-1 text-slate-600 bg-white"
          defaultValue={currentSource || ''}
          onChange={handleSourceChange}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
