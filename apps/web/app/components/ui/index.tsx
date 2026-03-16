import Link from 'next/link'

/* ── Status Badge ────────────────────────────────────────── */

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',      cls: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  closed:      { label: 'Closed',    cls: 'bg-slate-50 text-slate-500 ring-slate-500/10' },
  active:      { label: 'Active',    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
  due_soon:    { label: 'Due Soon',  cls: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  overdue:     { label: 'Overdue',   cls: 'bg-red-50 text-red-700 ring-red-600/10' },
  archived:    { label: 'Archived',  cls: 'bg-gray-50 text-gray-500 ring-gray-500/10' },
  draft:       { label: 'Draft',     cls: 'bg-slate-50 text-slate-600 ring-slate-500/10' },
  sent:        { label: 'Sent',      cls: 'bg-blue-50 text-blue-700 ring-blue-600/10' },
  approved:    { label: 'Approved',  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' },
}

export function StatusBadge({ status, size }: { status: string; size?: string }) {
  const cfg = STATUS_MAP[status] || { label: status, cls: 'bg-gray-50 text-gray-600 ring-gray-500/10' }
  return (
    <span className={`rw-badge ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ── Priority Badge ──────────────────────────────────────── */

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-50 text-red-700 ring-red-600/10' },
  high:     { label: 'High',     cls: 'bg-orange-50 text-orange-700 ring-orange-600/10' },
  medium:   { label: 'Medium',   cls: 'bg-amber-50 text-amber-700 ring-amber-600/10' },
  low:      { label: 'Low',      cls: 'bg-slate-50 text-slate-600 ring-slate-500/10' },
}

export function PriorityBadge({ priority, size }: { priority: string; size?: string }) {
  const cfg = PRIORITY_MAP[priority] || { label: priority, cls: 'bg-gray-50 text-gray-600 ring-gray-500/10' }
  return (
    <span className={`rw-badge ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ── Stats Card ──────────────────────────────────────────── */

export function StatsCard({ label, value, color, bg }: {
  label: string
  value: number | string
  color?: string
  bg?: string
}) {
  return (
    <div className={`rw-stat ${bg || ''}`}>
      <p className="rw-stat-label">{label}</p>
      <p className={`rw-stat-value ${color || 'text-slate-800'}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  )
}

/* ── Section Header ──────────────────────────────────────── */

export function SectionHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="rw-page-title">{title}</h1>
        {subtitle && <p className="rw-page-subtitle">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="rw-btn-secondary shrink-0">
          {action.label}
        </Link>
      )}
    </div>
  )
}

/* ── Empty State ─────────────────────────────────────────── */

export function EmptyState({ message, action }: {
  message: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="rw-card flex flex-col items-center justify-center py-16 px-6 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-slate-300 mb-3">
        <circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" />
      </svg>
      <p className="text-[13px] text-slate-400 max-w-md">{message}</p>
      {action && (
        <Link href={action.href} className="rw-btn-primary mt-4">{action.label}</Link>
      )}
    </div>
  )
}

/* ── Drawer (slide-in panel) ─────────────────────────────── */

export function Drawer({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="rw-btn-ghost text-slate-400 hover:text-slate-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </>
  )
}
