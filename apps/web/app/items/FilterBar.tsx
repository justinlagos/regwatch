'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IMPACT_LABELS } from '@/lib/supabase'

interface Source {
  id: string
  name: string
}

interface Props {
  sources: Source[]
  currentLevel?: string
  currentSource?: string
}

export default function FilterBar({ sources, currentLevel, currentSource }: Props) {
  const router = useRouter()

  function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const source = e.target.value
    const params = new URLSearchParams()
    if (currentLevel) params.set('level', currentLevel)
    if (source) params.set('source', source)
    router.push(`/items?${params.toString()}`)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-3 items-center">
      <span className="text-sm font-medium text-slate-600">Impact:</span>
      {['', '4', '3', '2', '1'].map(l => (
        <Link
          key={l}
          href={l ? `/items?level=${l}${currentSource ? `&source=${currentSource}` : ''}` : `/items${currentSource ? `?source=${currentSource}` : ''}`}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            currentLevel === l || (!currentLevel && !l)
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-600 border-gray-300 hover:border-slate-400'
          }`}>
          {l ? `L${l} — ${IMPACT_LABELS[l]}` : 'All'}
        </Link>
      ))}
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <span className="text-sm font-medium text-slate-600">Source:</span>
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
  )
}
