import Link from 'next/link'

interface Props { params: { id: string } }

export default function ControlDetail({ params }: Props) {
  return (
    <div className="space-y-5 max-w-4xl">
      <div className="text-sm text-gray-400 flex items-center gap-1">
        <Link href="/controls" className="hover:text-blue-600">Controls</Link>
        <span>›</span>
        <span className="text-gray-600">Control Detail</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
        <p className="text-slate-400 text-sm">Control detail view with keyword mapping, regulation links, and linked signals — coming in Phase 5.</p>
      </div>
    </div>
  )
}
