'use client'

import { Target, TrendingUp, TrendingDown } from 'lucide-react'

interface Props {
  summary: {
    totalIncome: number
    totalExpenses: number
    netSavings: number
  } | null
  savingsTarget: number | null
  loading?: boolean
}

export default function SavingsGoal({ summary, savingsTarget, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-[#161616] rounded w-32 mb-4" />
        <div className="h-8 bg-[#161616] rounded-full w-full mb-3" />
        <div className="h-3 bg-[#161616] rounded w-24" />
      </div>
    )
  }

  const net = summary?.netSavings ?? 0
  const target = savingsTarget ?? 0

  if (!target || !summary) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">Sparmål</h3>
        </div>
        <p className="text-xs text-zinc-600 text-center py-3">
          Sätt ett sparmål i inställningar för att se progress.
        </p>
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, (net / target) * 100))
  const ahead = net >= target
  const behind = net < 0

  const barColor = behind ? 'bg-red-500' : ahead ? 'bg-emerald-500' : 'bg-amber-500'
  const textColor = behind ? 'text-red-400' : ahead ? 'text-emerald-400' : 'text-amber-400'
  const borderColor = behind ? 'border-red-500/20' : ahead ? 'border-emerald-500/20' : 'border-white/[0.08]'
  const glow = behind ? '0 0 40px rgba(239,68,68,0.06)' : ahead ? '0 0 40px rgba(16,185,129,0.06)' : 'none'

  const diff = net - target
  const Icon = ahead ? TrendingUp : TrendingDown

  return (
    <div
      className={`bg-[#0f0f0f] border ${borderColor} rounded-2xl p-5`}
      style={{ boxShadow: glow }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">Sparmål</h3>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ahead ? 'bg-emerald-500/10 text-emerald-400' : behind ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
          <Icon className="w-2.5 h-2.5" />
          {ahead ? 'På spår' : behind ? 'Minus' : `${Math.round(pct)}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 bg-[#161616] rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-2xl font-black tabular-nums ${textColor}`}>
            {net >= 0 ? '+' : ''}{Math.round(net).toLocaleString('sv-SE')}
            <span className="text-sm font-medium text-zinc-500 ml-1">kr</span>
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Mål: {Math.round(target).toLocaleString('sv-SE')} kr/mån
          </p>
        </div>
        {diff !== 0 && (
          <p className={`text-xs font-medium ${diff > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString('sv-SE')} kr vs mål
          </p>
        )}
      </div>
    </div>
  )
}
