'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, List, CalendarDays, MessageCircle, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Hem', Icon: House },
  { href: '/transactions', label: 'Transaktioner', Icon: List },
  { href: '/calendar', label: 'Kalender', Icon: CalendarDays },
  { href: '/chat', label: 'Fråga', Icon: MessageCircle },
  { href: '/settings', label: 'Inställningar', Icon: Settings },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#080808]/95 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              />
              <span
                className={`text-[10px] transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-zinc-600'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
