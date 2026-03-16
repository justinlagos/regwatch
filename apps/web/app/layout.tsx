import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'
import { getServerClient } from '@/lib/supabase'

export const metadata: Metadata = {
  title: 'RegWatch',
  description: 'Compliance Operations Console',
}

async function getTriageCount() {
  try {
    const sb = getServerClient()
    const { data: reviewed } = await sb
      .from('item_reviews')
      .select('item_id')
      .eq('workspace_id', '00000000-0000-0000-0000-000000000001')

    const reviewedIds = (reviewed || []).map((r: any) => r.item_id)

    const { data: highImpactIds } = await sb
      .from('classifications')
      .select('item_id')
      .in('impact_level', ['3', '4'])

    const allHighIds = (highImpactIds || []).map((r: any) => r.item_id)
    const pending = allHighIds.filter((id: string) => !reviewedIds.includes(id))
    return pending.length
  } catch {
    return 0
  }
}

/* ── SVG Icons (inline, 18×18) ──────────────────────────── */
const Icon = ({ d }: { d: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const IconCommand = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)
const IconRadar = () => <Icon d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
const IconTriage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
)
const IconCases = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
  </svg>
)
const IconControls = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
const IconReports = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)
const IconEvidence = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
)
const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

/* ── Nav config ──────────────────────────────────────────── */
const NAV_MAIN = [
  { href: '/command',  label: 'Command',  icon: <IconCommand /> },
  { href: '/radar',    label: 'Radar',    icon: <IconRadar /> },
  { href: '/triage',   label: 'Triage',   icon: <IconTriage />, hasBadge: true },
  { href: '/cases',    label: 'Cases',    icon: <IconCases /> },
  { href: '/controls', label: 'Controls', icon: <IconControls /> },
]

const NAV_GOV = [
  { href: '/reports',  label: 'Reports',  icon: <IconReports /> },
  { href: '/evidence', label: 'Evidence', icon: <IconEvidence /> },
  { href: '/settings', label: 'Settings', icon: <IconSettings /> },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const triageCount = await getTriageCount()

  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--surface-ground)]">
        {/* ── Mobile top bar ────────────────────────── */}
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0f172a] text-white h-14 flex items-center px-4 gap-3">
          <Link href="/command" className="font-bold text-base tracking-tight">
            <span className="text-blue-400">Reg</span>Watch
          </Link>
          <div className="flex-1" />
          <nav className="flex gap-3 overflow-x-auto text-xs font-medium text-slate-300">
            {[...NAV_MAIN, ...NAV_GOV].map(item => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-white transition-colors">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* ── Desktop sidebar ───────────────────────── */}
        <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-[var(--sidebar-width)] bg-[var(--sidebar-bg)] flex-col z-40">
          {/* Logo */}
          <div className="h-14 flex items-center px-5">
            <Link href="/command" className="font-bold text-[15px] tracking-tight text-white">
              <span className="text-blue-400">Reg</span>Watch
            </Link>
            <span className="ml-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">v2</span>
          </div>

          {/* Main nav */}
          <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
            <p className="px-2 pt-2 pb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Operations</p>
            {NAV_MAIN.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] transition-colors group">
                <span className="opacity-60 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                {item.label}
                {'hasBadge' in item && triageCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {triageCount > 99 ? '99+' : triageCount}
                  </span>
                )}
              </Link>
            ))}

            <p className="px-2 pt-5 pb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Governance</p>
            {NAV_GOV.map(item => (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] transition-colors group">
                <span className="opacity-60 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Operator badge */}
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-[11px] font-bold">
                OP
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-300 leading-tight">Operator</p>
                <p className="text-[10px] text-slate-500 leading-tight">Single workspace</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Content area ──────────────────────────── */}
        <main className="md:ml-[var(--sidebar-width)] pt-14 md:pt-0 min-h-screen">
          <div className="rw-page">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
