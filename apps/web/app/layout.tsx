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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const triageCount = await getTriageCount()

  const navItems = [
    { href: '/command', label: 'Command' },
    { href: '/radar', label: 'Radar' },
    { href: '/triage', label: 'Triage', badge: triageCount > 0 ? triageCount : null },
    { href: '/cases', label: 'Cases' },
    { href: '/controls', label: 'Controls' },
    { href: '/reports', label: 'Reports' },
    { href: '/evidence', label: 'Evidence' },
  ]

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {/* Top nav */}
        <nav className="bg-slate-900 text-white px-4 sm:px-6 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-6">
              <Link href="/command" className="font-bold text-lg sm:text-xl tracking-tight shrink-0">
                <span className="text-blue-400">Reg</span>Watch
              </Link>
              <div className="flex gap-3 sm:gap-5 text-sm text-slate-300">
                {navItems.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {item.label}
                    {item.badge && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/settings" className="hidden sm:block text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Settings
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
