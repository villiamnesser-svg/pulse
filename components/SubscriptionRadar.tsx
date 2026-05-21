'use client'

import { RefreshCw, AlertCircle, Zap, Calendar } from 'lucide-react'

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
  aliasMap?: Map<string, string>
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

const SUB_EMOJI: Record<string, string> = {
  spotify: '🎵', netflix: '🎬', 'hbo': '🎬', disney: '🎬', youtube: '▶️',
  apple: '🍎', microsoft: '🪟', adobe: '🎨', dropbox: '📦', google: '🔍',
  tele2: '📱', telia: '📱', tre: '📱', telenor: '📱', comviq: '📱',
  amazon: '📦', github: '💻', openai: '🤖', chatgpt: '🤖',
}

function getEmoji(merchant: string): string {
  const lower = merchant.toLowerCase()
  for (const [key, emoji] of Object.entries(SUB_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return '🔄'
}

export default function SubscriptionRadar({ subscriptions, loading, aliasMap }: SubscriptionRadarProps) {
  const monthlyTotal = subscriptions.reduce((sum, s) => sum + s.amount, 0)
  const annualTotal = monthlyTotal * 12

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-[#161616] rounded w-28 mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-[#161616] rounded-xl mb-2" />
        ))}
      </div>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
            Prenumerationer
          </h3>
        </div>
        <div className="flex flex-col items-center py-6 gap-2">
          <RefreshCw className="w-6 h-6 text-zinc-700" />
          <p className="text-xs text-zinc-600 text-center">Inga återkommande avgifter hittade.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
            Prenumerationer
          </h3>
        </div>
        <span className="text-[10px] text-zinc-600 bg-[#161616] px-2 py-0.5 rounded-full border border-white/[0.05]">
          {subscriptions.length} aktiva
        </span>
      </div>

      <ul className="space-y-2 mb-4">
        {subscriptions.map((sub) => {
          const days = daysSince(sub.lastCharged)
          const isToday = days === 0
          const stale = days > 50
          const displayName = aliasMap?.get(sub.merchant) ?? sub.merchant
          const emoji = getEmoji(sub.merchant) !== '🔄' ? getEmoji(sub.merchant) : getEmoji(displayName)

          return (
            <li
              key={sub.merchant}
              className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 transition-colors ${
                isToday
                  ? 'bg-amber-950/20 border-amber-500/20'
                  : 'bg-[#161616] border-white/[0.05] hover:border-white/[0.1]'
              }`}
            >
              <span className="text-lg leading-none shrink-0">{emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{displayName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isToday ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400">
                      <Zap className="w-2.5 h-2.5" /> Dragen idag
                    </span>
                  ) : stale ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-500">
                      <AlertCircle className="w-2.5 h-2.5" /> Används den?
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-600">
                      <Calendar className="w-2.5 h-2.5" /> {days}d sedan · {sub.monthsDetected} mån
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-zinc-100">
                  {Math.round(sub.amount).toLocaleString('sv-SE')} kr
                </p>
                <p className="text-[10px] text-zinc-600">/mån</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-white/[0.06] pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Per månad</span>
          <span className="text-sm font-bold text-zinc-200">
            {Math.round(monthlyTotal).toLocaleString('sv-SE')} kr
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600">Per år</span>
          <span className="text-xs font-semibold text-zinc-400">
            {Math.round(annualTotal).toLocaleString('sv-SE')} kr
          </span>
        </div>
      </div>
    </div>
  )
}
