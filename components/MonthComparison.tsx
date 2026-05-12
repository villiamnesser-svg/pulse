'use client'

import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface CompareData {
  thisMonth: { total: number; byCategory: Record<string, number> }
  lastMonth: { total: number; byCategory: Record<string, number> }
  diff: number
  diffPct: number
  noData?: boolean
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec',
]

function fmt(n: number) {
  return Math.round(n).toLocaleString('sv-SE')
}

export default function MonthComparison() {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/compare')
      .then((r) => r.json())
      .then((d: CompareData) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const thisMonthName = MONTH_NAMES[now.getMonth()]
  const lastMonthName =
    MONTH_NAMES[now.getMonth() === 0 ? 11 : now.getMonth() - 1]

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
        <div className="h-3 w-32 bg-[#161616] rounded mb-4" />
        <div className="h-6 w-full bg-[#161616] rounded" />
      </div>
    )
  }

  if (!data || data.noData) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
          Månad för månad
        </p>
        <p className="text-sm text-zinc-600">
          Behöver mer data — ladda upp fler månader
        </p>
      </div>
    )
  }

  const isSpendingMore = data.diff > 0
  const diffColor = isSpendingMore ? 'text-amber-400' : 'text-emerald-400'
  const DiffIcon = isSpendingMore ? TrendingUp : TrendingDown

  // Top 4 categories from this month
  const topCats = Object.entries(data.thisMonth.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  // Find max for bar scaling
  const maxVal = Math.max(
    ...topCats.map(([cat]) =>
      Math.max(
        data.thisMonth.byCategory[cat] ?? 0,
        data.lastMonth.byCategory[cat] ?? 0
      )
    ),
    1
  )

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 space-y-4">
      {/* Title */}
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
        Månad för månad
      </p>

      {/* Totals row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-zinc-600 mb-0.5">{thisMonthName}</p>
          <p className="text-xl font-bold text-white tabular-nums">
            {fmt(data.thisMonth.total)}{' '}
            <span className="text-xs font-normal text-zinc-500">kr</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-600 mb-0.5">{lastMonthName}</p>
          <p className="text-xl font-bold text-zinc-400 tabular-nums">
            {fmt(data.lastMonth.total)}{' '}
            <span className="text-xs font-normal text-zinc-600">kr</span>
          </p>
        </div>
      </div>

      {/* Diff */}
      <div className={`flex items-center gap-1.5 ${diffColor}`}>
        <DiffIcon className="w-3.5 h-3.5" />
        <span className="text-sm font-semibold">
          {isSpendingMore ? '+' : ''}
          {fmt(data.diff)} kr ({isSpendingMore ? '+' : ''}
          {data.diffPct}%)
        </span>
        <span className="text-xs text-zinc-600 ml-1">
          {isSpendingMore ? 'mer än förra månaden' : 'mindre än förra månaden'}
        </span>
      </div>

      {/* Category mini bars */}
      {topCats.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/[0.05]">
          {topCats.map(([cat, thisAmt]) => {
            const lastAmt = data.lastMonth.byCategory[cat] ?? 0
            const thisPct = Math.round((thisAmt / maxVal) * 100)
            const lastPct = Math.round((lastAmt / maxVal) * 100)
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500 capitalize">{cat}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {fmt(thisAmt)} kr
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${thisPct}%` }}
                    />
                  </div>
                  <div className="h-1 bg-[#161616] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-600 rounded-full transition-all"
                      style={{ width: `${lastPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-xs text-zinc-600">{thisMonthName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-600">{lastMonthName}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
