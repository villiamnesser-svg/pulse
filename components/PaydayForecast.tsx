'use client'

import { useEffect, useState } from 'react'
import { Wallet, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import type { ForecastResult } from '@/app/api/forecast/route'

function fmt(n: number) {
  return Math.round(Math.abs(n)).toLocaleString('sv-SE')
}

export default function PaydayForecast() {
  const [data, setData] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d as ForecastResult | null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 w-40 bg-white/[0.06] rounded mb-4" />
        <div className="h-16 bg-white/[0.04] rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const STATUS_STYLE = {
    safe:     { border: 'border-emerald-500/20', bg: 'bg-emerald-950/20', Icon: CheckCircle, iconColor: 'text-emerald-400', barColor: 'bg-emerald-500', textColor: 'text-emerald-400' },
    tight:    { border: 'border-amber-500/20',   bg: 'bg-amber-950/20',   Icon: AlertTriangle, iconColor: 'text-amber-400', barColor: 'bg-amber-500',   textColor: 'text-amber-400' },
    critical: { border: 'border-red-500/20',     bg: 'bg-red-950/20',     Icon: AlertTriangle, iconColor: 'text-red-400',   barColor: 'bg-red-500',     textColor: 'text-red-400' },
  }

  const style = STATUS_STYLE[data.status]
  const { Icon } = style

  // Progress bar: how much of the current balance we'll spend before payday
  const spendRatio = data.currentBalance > 0
    ? Math.min((data.currentBalance - data.projectedBalance) / data.currentBalance, 1)
    : 0
  const barWidth = Math.max(0, Math.min(100, spendRatio * 100))

  return (
    <div className={`bg-[#0f0f0f] border ${style.border} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-3.5 h-3.5 text-zinc-500" />
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Klarar du dig till lönen?
        </h3>
        <span className="ml-auto text-[10px] text-zinc-600 bg-[#161616] px-2 py-0.5 rounded-full border border-white/[0.05]">
          {data.daysToPayday} dagar kvar
        </span>
      </div>

      {/* Status message */}
      <div className={`flex items-start gap-3 p-3 rounded-xl ${style.bg} mb-4`}>
        <Icon className={`w-4 h-4 ${style.iconColor} shrink-0 mt-0.5`} />
        <p className={`text-sm font-medium ${style.textColor} leading-snug`}>
          {data.statusMessage}
        </p>
      </div>

      {/* Balance progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-500">Nuvarande saldo</span>
          <span className="text-sm font-bold text-zinc-100">{fmt(data.currentBalance)} kr</span>
        </div>
        <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${style.barColor}`}
            style={{ width: `${100 - barWidth}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-zinc-600">
            Beräknat kvar vid löning
          </span>
          <span className={`text-xs font-semibold ${data.projectedBalance < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
            {data.projectedBalance < 0 ? '−' : ''}{fmt(data.projectedBalance)} kr
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#161616] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3 h-3 text-zinc-500" />
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Snitt/dag</p>
          </div>
          <p className="text-sm font-bold text-zinc-200">{fmt(data.avgDailySpend)} kr</p>
        </div>
        {data.knownUpcomingCost > 0 ? (
          <div className="bg-[#161616] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-zinc-500" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Kommande</p>
            </div>
            <p className="text-sm font-bold text-amber-400">{fmt(data.knownUpcomingCost)} kr</p>
          </div>
        ) : (
          <div className="bg-[#161616] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3 h-3 text-zinc-500" />
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Beräknat</p>
            </div>
            <p className="text-sm font-bold text-zinc-200">
              {fmt(data.avgDailySpend * data.daysToPayday)} kr
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
