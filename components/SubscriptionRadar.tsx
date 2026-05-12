'use client'

import { RefreshCw, AlertCircle, Zap } from 'lucide-react'

interface Subscription {
  merchant: string
  amount: number
  lastCharged: string
  monthsDetected: number
  isKnown: boolean
}

interface SubscriptionRadarProps {
  subscriptions: Subscription[]
  loading?: boolean
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function chargedToday(dateStr: string): boolean {
  return daysSince(dateStr) === 0
}

export default function SubscriptionRadar({ subscriptions, loading }: SubscriptionRadarProps) {
  const monthlyTotal = subscriptions.reduce((sum, s) => sum + s.amount, 0)

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-[#161616] rounded w-28 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-[#161616] rounded-xl mb-2" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Prenumerationer
        </h3>
      </div>

      {subscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <RefreshCw className="w-7 h-7 text-zinc-700" />
          <p className="text-zinc-500 text-sm text-center">
            Inga återkommande avgifter hittade ännu.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-4">
            {subscriptions.map((sub) => {
              const stale = daysSince(sub.lastCharged) > 45
              const isToday = chargedToday(sub.lastCharged)
              return (
                <li
                  key={sub.merchant}
                  className={`flex items-center justify-between border rounded-xl px-3 py-2.5 ${
                    isToday
                      ? 'bg-amber-950/20 border-amber-500/20'
                      : 'bg-[#161616] border-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate">{sub.merchant}</span>
                    {isToday && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> idag
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-semibold text-zinc-100">
                      {sub.amount.toLocaleString('sv-SE')} kr
                    </p>
                    {stale ? (
                      <p className="text-xs text-amber-400 flex items-center gap-1 justify-end mt-0.5">
                        <AlertCircle className="w-3 h-3" />
                        Värt det?
                      </p>
                    ) : isToday ? (
                      <p className="text-xs text-amber-400/70">{sub.monthsDetected} månader i rad</p>
                    ) : (
                      <p className="text-xs text-zinc-600">{daysSince(sub.lastCharged)}d sedan</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Totalt / månad</span>
            <span className="text-sm font-semibold text-zinc-200">
              {Math.round(monthlyTotal).toLocaleString('sv-SE')} kr
            </span>
          </div>
        </>
      )}
    </div>
  )
}
