'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle } from 'lucide-react'

interface RecentTransaction {
  id: string
  date: string
  merchant: string
  amount: number
  category: string | null
  isIncome: boolean
}

interface SummaryData {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  incomeCount: number
  expenseCount: number
  recentTransactions: RecentTransaction[]
  uncategorizedCount: number
}

interface Props {
  aliasMap?: Map<string, string>
  summary: SummaryData | null
  loading: boolean
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('sv-SE', { maximumFractionDigits: 0 }) + ' kr'
}

export default function MonthSummary({ summary, loading, aliasMap }: Props) {
  const [recatState, setRecatState] = useState<'idle' | 'running' | 'done'>('idle')
  const [recatProgress, setRecatProgress] = useState<{ updated: number; remaining: number } | null>(null)

  async function runRecategorize() {
    setRecatState('running')
    let remaining = summary?.uncategorizedCount ?? 1
    let maxIterations = 20 // safety cap

    while (remaining > 0 && maxIterations-- > 0) {
      try {
        const res = await fetch('/api/recategorize', { method: 'POST' })
        if (!res.ok) break
        const data = (await res.json()) as { updated: number; remaining: number }
        setRecatProgress(data)
        remaining = data.remaining
        if (remaining === 0) break
        await new Promise((r) => setTimeout(r, 600))
      } catch {
        break
      }
    }

    setRecatState('done')
  }

  const monthNames = [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december',
  ]
  const month = monthNames[new Date().getMonth()]

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.06] rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-white/[0.04] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!summary) return null

  const savingsPositive = summary.netSavings >= 0
  const savingsPercent =
    summary.totalIncome > 0
      ? Math.round((summary.netSavings / summary.totalIncome) * 100)
      : 0

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {month} — översikt
        </span>
        {summary.uncategorizedCount > 0 && recatState === 'idle' && (
          <button
            onClick={() => void runRecategorize()}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Kategorisera {summary.uncategorizedCount} tx
          </button>
        )}
        {recatState === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {recatProgress
              ? `${recatProgress.updated} klara, ${recatProgress.remaining} kvar`
              : 'Kör...'}
          </span>
        )}
        {recatState === 'done' && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-500">
            <CheckCircle className="w-3 h-3" />
            Kategorisering klar
          </span>
        )}
      </div>

      {/* Income / Expenses / Net */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Inkomst</span>
          </div>
          <div className="text-sm font-semibold text-white">{fmt(summary.totalIncome)}</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">{summary.incomeCount} poster</div>
        </div>

        <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Utgifter</span>
          </div>
          <div className="text-sm font-semibold text-white">{fmt(summary.totalExpenses)}</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">{summary.expenseCount} poster</div>
        </div>

        <div className="bg-[#161616] border border-white/[0.06] rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Minus className={`w-3.5 h-3.5 ${savingsPositive ? 'text-emerald-500' : 'text-red-400'}`} />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Netto</span>
          </div>
          <div className={`text-sm font-semibold ${savingsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {savingsPositive ? '+' : '-'}{fmt(summary.netSavings)}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">
            {savingsPositive ? `${savingsPercent}% sparat` : 'underskott'}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      {summary.recentTransactions.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Senaste</div>
          <div className="space-y-1">
            {summary.recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-300 truncate">{aliasMap?.get(tx.merchant) ?? tx.merchant}</div>
                  <div className="text-[10px] text-zinc-600">
                    {new Date(tx.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}
                    {tx.category && !tx.isIncome && (
                      <> · <span className="text-zinc-600">{tx.category}</span></>
                    )}
                  </div>
                </div>
                <div className={`text-xs font-medium ml-3 shrink-0 ${tx.isIncome ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {tx.isIncome ? '+' : ''}{tx.amount.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
