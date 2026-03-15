/**
 * SectionHeader — section title with optional action link on the right.
 * Used inside rw-card containers.
 */

import Link from 'next/link'

interface Props {
  title: string
  action?: { label: string; href: string }
  children?: React.ReactNode
}

export default function SectionHeader({ title, action, children }: Props) {
  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
      <h2 className="font-semibold text-slate-800 text-sm sm:text-base">{title}</h2>
      <div className="flex items-center gap-3">
        {children}
        {action && (
          <Link href={action.href} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  )
}
