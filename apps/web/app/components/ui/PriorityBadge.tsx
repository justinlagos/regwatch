/**
 * PriorityBadge — low/medium/high/critical priority indicator.
 * Used on Cases and Triage.
 */

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200' },
  high:     { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
  medium:   { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  low:      { bg: 'bg-slate-50',   text: 'text-slate-600',  border: 'border-slate-200' },
}

const DEFAULT = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' }

interface Props {
  priority: string
  size?: 'sm' | 'md'
}

export default function PriorityBadge({ priority, size = 'sm' }: Props) {
  const s = PRIORITY_STYLES[priority] || DEFAULT

  return (
    <span className={`inline-flex items-center rounded-full font-semibold border ${s.bg} ${s.text} ${s.border} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
    }`}>
      {priority}
    </span>
  )
}
