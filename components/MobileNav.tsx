'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, List, CalendarDays, MessageCircle, Sparkles, Trophy } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/',             label: 'Hem',       Icon: House },
  { href: '/transactions', label: 'Historik',  Icon: List },
  { href: '/goals',        label: 'Mål',       Icon: Trophy },
  { href: '/calendar',     label: 'Kalender',  Icon: CalendarDays },
  { href: '/chat',         label: 'Fråga',     Icon: MessageCircle },
  { href: '/report',       label: 'Rapport',   Icon: Sparkles },
]

export default function MobileNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/register' || pathname === '/onboarding') return null

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      {/* ── Desktop top nav ── */}
      <nav aria-label="Huvudnavigation" className="hidden sm:flex fixed top-0 left-0 right-0 z-40 bg-[#080808]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 w-full flex items-center gap-1 h-12">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {active && <div className="w-1 h-1 rounded-full bg-emerald-400 ml-0.5" />}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* ── Mobile bottom nav ── */}
      <nav
        aria-label="Mobilnavigation"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#080808]/95 backdrop-blur-xl border-t border-white/[0.06]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              >
                <Icon className={`w-5 h-5 transition-colors ${active ? 'text-emerald-400' : 'text-zinc-600'}`} />
                <span className={`text-[9px] transition-colors ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>
                  {label}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-emerald-400" />}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
