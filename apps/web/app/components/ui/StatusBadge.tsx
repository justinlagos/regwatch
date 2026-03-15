/**
 * StatusBadge — health/status indicator for sources, controls, cases.
 * Supports: active, healthy, degraded, down, disabled, new, overdue, due_soon, archived.
 */

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  healthy:    { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  classified: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  open:       { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  assigned:   { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  new:        { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  drafted:    { bg: 'bg-slate-50',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  degraded:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  due_soon:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  waiting_for_input: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  in_review:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  overdue:    { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  down:       { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  closed:     { bg: 'bg-gray-50',    text: 'text-gray-500',    dot: 'bg-gray-400' },
  disabled:   { bg: 'bg-gray-50',    text: 'text-gray-400',    dot: 'bg-gray-300' },
  archived:   { bg: 'bg-gray-50',    text: 'text-gray-400',    dot: 'bg-gray-300' },
  dismissed:  { bg: 'bg-gray-50',    text: 'text-gray-400',    dot: 'bg-gray-300' },
}

const DEFAULT_STYLE = { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400' }

interface Props {
  status: string
  label?: string
  size?: 'sm' | 'md'
}

export default function StatusBadge({ status, label, size = 'sm' }: Props) {
  const s = STATUS_STYLES[status] || DEFAULT_STYLE
  const displayLabel = label || status.replace(/_/g, ' ')

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${s.bg} ${s.text} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {displayLabel}
    </span>
  )
}
