'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, TrendingUp, Home, CreditCard, AlertTriangle, Wallet } from 'lucide-react'
import type { CalendarDay } from '@/app/api/calendar/route'

interface CalendarResponse {
  days: CalendarDay[]
  avgDailySpend: number
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const DAY_NAMES = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön']

function fmt(n: number) {
  return Math.abs(Math.round(n)).toLocaleString('sv-SE')
}

function EventPill({ type, label, amount }: { type: string; label: string; amount: number }) {
  if (type === 'payday') return (
    <div className="flex items-center gap-1 bg-emerald-500/15 text-emerald-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate">
      <TrendingUp className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">+{fmt(amount)}</span>
    </div>
  )
  if (type === 'rent') return (
    <div className="flex items-center gap-1 bg-blue-500/15 text-blue-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate">
      <Home className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">-{fmt(amount)}</span>
    </div>
  )
  return (
    <div title={label} className="flex items-center gap-1 bg-purple-500/15 text-purple-400 text-[9px] font-semibold px-1.5 py-0.5 rounded-full truncate">
      <CreditCard className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{label.slice(0, 9)}</span>
    </div>
  )
}

export default function CalendarPage() {
  const [data, setData] = useState<CalendarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then(d => { setData(d as CalendarResponse); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find first critical day
  const firstCritical = data?.days.find(d => d.isCritical && !d.isPast)

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <CalendarDays className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-bold tracking-widest text-white uppercase">Kassaflöde</h1>
        <span className="text-xs text-zinc-600 ml-auto">nästa 30 dagar</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 pb-24 sm:pb-5 space-y-4">
        {/* Alert if balance will go critical */}
        {firstCritical && (
          <div className="bg-red-950/40 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Saldot kan bli tight</p>
              <p className="text-xs text-red-400/70 mt-0.5">
                Saldot beräknas gå under 5 000 kr den{' '}
                {new Date(firstCritical.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] text-zinc-600 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500/50" /><span>Lön</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500/50" /><span>Hyra</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500/50" /><span>Prenumeration</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500/50" /><span>Kritiskt saldo</span></div>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="aspect-square bg-[#0f0f0f] border border-white/[0.06] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-6 text-sm text-red-400 text-center">
            Kunde inte ladda kalenderdata — kontrollera anslutningen.
          </div>
        ) : !data ? null : (
          <>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[10px] text-zinc-700 font-semibold py-1">{d}</div>
              ))}
            </div>

            {/* Offset first day */}
            {(() => {
              const firstDate = new Date(data.days[0].date)
              const firstWeekday = firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1
              const cells: React.ReactNode[] = []

              // Empty offset cells
              for (let i = 0; i < firstWeekday; i++) {
                cells.push(<div key={`empty-${i}`} />)
              }

              // Day cells
              data.days.forEach(day => {
                const d = new Date(day.date)
                const dayNum = d.getDate()
                const monthLabel = dayNum === 1 ? MONTH_NAMES[d.getMonth()] : null

                cells.push(
                  <div
                    key={day.date}
                    className={`relative rounded-xl p-1.5 min-h-[72px] border transition-colors ${
                      day.isToday
                        ? 'bg-white/[0.05] border-white/[0.15]'
                        : day.isCritical
                          ? 'bg-red-950/20 border-red-500/20'
                          : day.isPayday
                            ? 'bg-emerald-950/20 border-emerald-500/20'
                            : day.isPast
                              ? 'bg-transparent border-white/[0.03] opacity-40'
                              : 'bg-[#0f0f0f] border-white/[0.06] hover:border-white/[0.1]'
                    }`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-bold ${
                        day.isToday ? 'text-white' :
                        day.isCritical ? 'text-red-400' :
                        day.isPayday ? 'text-emerald-400' :
                        'text-zinc-400'
                      }`}>
                        {dayNum}
                      </span>
                      {monthLabel && (
                        <span className="text-[8px] text-zinc-600 font-medium">{monthLabel}</span>
                      )}
                    </div>

                    {/* Events */}
                    <div className="space-y-0.5">
                      {day.events.slice(0, 2).map((ev, i) => (
                        <EventPill key={i} type={ev.type} label={ev.label} amount={ev.amount} />
                      ))}
                    </div>

                    {/* Projected balance */}
                    {!day.isPast && (
                      <div className={`absolute bottom-1 right-1.5 text-[8px] font-semibold ${
                        day.isCritical ? 'text-red-400' :
                        day.projectedBalance > 15000 ? 'text-emerald-600' :
                        'text-zinc-600'
                      }`}>
                        {fmt(day.projectedBalance)}
                      </div>
                    )}
                  </div>
                )
              })

              return <div className="grid grid-cols-7 gap-1">{cells}</div>
            })()}

            {/* Bottom stats */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Dagligt snitt</p>
                <p className="text-sm font-bold text-zinc-200">{fmt(data.avgDailySpend)} kr/dag</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Saldo om 30 dagar</p>
                {(() => {
                  const lastDay = data.days[data.days.length - 1]
                  const balance = lastDay?.projectedBalance ?? 0
                  return (
                    <p className={`text-sm font-bold ${balance < 5000 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {fmt(balance)} kr
                    </p>
                  )
                })()}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
