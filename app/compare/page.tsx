'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, ArrowLeftRight, TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface MonthData {
  total: number
  byCategory: Record<string, number>
}

interface CompareData {
  a: MonthData
  b: MonthData
  diff: number
  diffPct: number
  noData?: boolean
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec',
]

const CAT_COLORS: Record<string, string> = {
  mat: 'bg-green-500',
  restaurang: 'bg-orange-500',
  transport: 'bg-blue-500',
  prenumeration: 'bg-purple-500',
  hyra: 'bg-red-500',
  nöje: 'bg-pink-500',
  hälsa: 'bg-teal-500',
  kläder: 'bg-yellow-500',
  elektronik: 'bg-cyan-500',
  kontantuttag: 'bg-zinc-500',
  övrigt: 'bg-zinc-600',
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('sv-SE')
}

function getMonthOptions(count = 18) {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`
    options.push({ value, label })
  }
  return options
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)
  return `${MONTH_NAMES_SHORT[month - 1]} ${year}`
}

export default function ComparePage() {
  const monthOptions = getMonthOptions(18)

  const [monthA, setMonthA] = useState(monthOptions[0].value)
  const [monthB, setMonthB] = useState(monthOptions[1].value)
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (a: string, b: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/compare?a=${a}&b=${b}`)
      if (!res.ok) throw new Error('failed')
      const json = (await res.json()) as CompareData
      setData(json)
    } catch {
      setError('Kunde inte ladda jämförelse')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData(monthA, monthB)
  }, [monthA, monthB, loadData])

  function swapMonths() {
    const prevA = monthA
    setMonthA(monthB)
    setMonthB(prevA)
  }

  // Gather all categories from both months
  const allCategories = data
    ? Array.from(
        new Set([
          ...Object.keys(data.a.byCategory),
          ...Object.keys(data.b.byCategory),
        ])
      ).sort((x, y) => {
        const sumX = (data.a.byCategory[x] ?? 0) + (data.b.byCategory[x] ?? 0)
        const sumY = (data.a.byCategory[y] ?? 0) + (data.b.byCategory[y] ?? 0)
        return sumY - sumX
      })
    : []

  const maxCatValue = data
    ? Math.max(
        ...allCategories.map(c =>
          Math.max(data.a.byCategory[c] ?? 0, data.b.byCategory[c] ?? 0)
        ),
        1
      )
    : 1

  const diffPositive = (data?.diff ?? 0) > 0
  const diffNeutral = (data?.diff ?? 0) === 0

  return (
    <div className="min-h-screen bg-[#080808] pb-24 sm:pb-0">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <ArrowLeftRight className="w-4 h-4 text-zinc-600" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Jämför månader</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Jämför utgifter mellan två månader.</p>
          </div>
        </div>

        {/* Month selectors */}
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Månad A</p>
              <select
                value={monthA}
                onChange={e => setMonthA(e.target.value)}
                className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
              >
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={swapMonths}
              className="mt-5 flex items-center justify-center w-9 h-9 rounded-xl bg-[#161616] border border-white/[0.08] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.16] transition-colors shrink-0"
              title="Byt månader"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Månad B</p>
              <select
                value={monthB}
                onChange={e => setMonthB(e.target.value)}
                className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500/50"
              >
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-28" />
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-64" />
          </div>
        ) : data?.noData ? (
          <div className="text-center py-12">
            <ArrowLeftRight className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Inga transaktioner för valda månader.</p>
          </div>
        ) : data ? (
          <>
            {/* Summary */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                    {monthLabel(monthA)}
                  </p>
                  <p className="text-lg font-bold text-zinc-100">
                    {fmt(data.a.total)}
                  </p>
                  <p className="text-xs text-zinc-600">kr</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                    {monthLabel(monthB)}
                  </p>
                  <p className="text-lg font-bold text-zinc-100">
                    {fmt(data.b.total)}
                  </p>
                  <p className="text-xs text-zinc-600">kr</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
                    Skillnad
                  </p>
                  <div className="flex items-center gap-1">
                    {diffNeutral ? (
                      <Minus className="w-3.5 h-3.5 text-zinc-500" />
                    ) : diffPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <p
                      className={`text-lg font-bold ${
                        diffNeutral
                          ? 'text-zinc-400'
                          : diffPositive
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {diffPositive ? '+' : ''}{fmt(data.diff)}
                    </p>
                  </div>
                  <p
                    className={`text-xs mt-0.5 ${
                      diffNeutral
                        ? 'text-zinc-600'
                        : diffPositive
                        ? 'text-red-500'
                        : 'text-emerald-600'
                    }`}
                  >
                    {diffPositive ? '+' : ''}{data.diffPct}% vs B
                  </p>
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            {allCategories.length > 0 && (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                {/* Legend */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    Per kategori
                  </p>
                  <div className="flex items-center gap-3 text-xs text-zinc-600">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      {monthLabel(monthA)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" />
                      {monthLabel(monthB)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {allCategories.map(cat => {
                    const amtA = data.a.byCategory[cat] ?? 0
                    const amtB = data.b.byCategory[cat] ?? 0
                    const pctA = (amtA / maxCatValue) * 100
                    const pctB = (amtB / maxCatValue) * 100
                    const color = CAT_COLORS[cat] ?? 'bg-zinc-600'

                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm text-zinc-300 capitalize">{cat}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-400 font-medium">
                              {amtA > 0 ? `${fmt(amtA)} kr` : '—'}
                            </span>
                            <span className="text-zinc-500">
                              {amtB > 0 ? `${fmt(amtB)} kr` : '—'}
                            </span>
                          </div>
                        </div>
                        {/* Bar A */}
                        <div className="h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden mb-1">
                          <div
                            className={`h-full ${color} rounded-full transition-all`}
                            style={{ width: `${pctA}%` }}
                          />
                        </div>
                        {/* Bar B */}
                        <div className="h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-zinc-600 rounded-full transition-all"
                            style={{ width: `${pctB}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  )
}
