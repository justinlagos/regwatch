/**
 * EmptyState — placeholder for pages/sections with no data.
 */

import Link from 'next/link'

interface Props {
  message: string
  action?: { label: string; href: string }
}

export default function EmptyState({ message, action }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
      <p className="text-slate-400 text-sm">{message}</p>
      {action && (
        <Link href={action.href} className="inline-block mt-3 text-sm text-blue-600 hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  )
}
