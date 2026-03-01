import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'RegWatch',
  description: 'Regulatory Intelligence Monitoring',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {/* Top nav */}
        <nav className="bg-slate-900 text-white px-4 sm:px-6 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 sm:gap-8">
              <Link href="/" className="font-bold text-lg sm:text-xl tracking-tight shrink-0">
                <span className="text-blue-400">Reg</span>Watch
              </Link>
              <div className="flex gap-3 sm:gap-6 text-sm text-slate-300">
                <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
                <Link href="/items" className="hover:text-white transition-colors">Items</Link>
                <Link href="/items?level=4" className="hover:text-white transition-colors whitespace-nowrap">
                  High Impact
                </Link>
              </div>
            </div>
            <span className="hidden sm:block text-xs text-slate-400">Regulatory Intelligence Platform</span>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
