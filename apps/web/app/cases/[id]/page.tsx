import Link from 'next/link'
import { notFound } from 'next/navigation'

interface Props { params: { id: string } }

export default function CaseDetail({ params }: Props) {
  // Placeholder until Phase 8
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <Link href="/cases" className="hover:text-blue-600">Cases</Link>
        <span>›</span>
        <span className="text-gray-600">Case Detail</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <p className="text-slate-400 text-sm">Case detail view — coming in Phase 8.</p>
      </div>
    </div>
  )
}
