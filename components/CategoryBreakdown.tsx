'use client'

import { PieChart } from 'lucide-react'

interface CategoryBreakdown {
  category: string
  amount: number
  baseline: number
}

interface CategoryBreakdownProps {
  categories: CategoryBreakdown[]
  loading?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  mat: 'Mat',
  restaurang: 'Restaurang',
  transport: 'Transport',
  prenumeration: 'Prenumerationer',
  hyra: 'Hyra',
  nöje: 'Nöje',
  hälsa: 'Hälsa',
  kläder: 'Kläder',
  elektronik: 'Elektronik',
  kontantuttag: 'Kontantuttag',
  inkomst: 'Inkomst',
  övrigt: 'Övrigt',
}

export default function CategoryBreakdown({ categories, loading }: CategoryBreakdownProps) {
  const maxAmount = Math.max(...categories.map((c) => Math.max(c.amount, c.baseline)), 1)

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-[#161616] rounded w-36 mb-5" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="mb-4">
            <div className="h-3 bg-[#161616] rounded w-32 mb-2" />
            <div className="h-2 bg-[#161616] rounded-full w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
            Kategorier
          </h3>
        </div>
        <p className="text-zinc-500 text-sm py-4 text-center">
          Ingen data ännu.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <PieChart className="w-3.5 h-3.5 text-zinc-500" />
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Kategorier denna månad
        </h3>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => {
          const isOver = cat.baseline > 0 && cat.amount > cat.baseline
          const barWidth = `${(cat.amount / maxAmount) * 100}%`
          const baselineWidth = `${(cat.baseline / maxAmount) * 100}%`

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-zinc-400">
                  {CATEGORY_LABELS[cat.category] ?? cat.category}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${isOver ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {Math.round(cat.amount).toLocaleString('sv-SE')} kr
                  </span>
                  {cat.baseline > 0 && (
                    <span className="text-xs text-zinc-600">
                      / {Math.round(cat.baseline).toLocaleString('sv-SE')} kr
                    </span>
                  )}
                </div>
              </div>

              {/* Bar container */}
              <div className="relative h-2 bg-[#161616] rounded-full overflow-hidden">
                {/* Baseline indicator */}
                {cat.baseline > 0 && (
                  <div
                    className="absolute top-0 left-0 h-full bg-zinc-700/40 rounded-full transition-all duration-500"
                    style={{ width: baselineWidth }}
                  />
                )}
                {/* Actual spend bar */}
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${
                    isOver ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: barWidth }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-zinc-600">Under snitt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-zinc-600">Över snitt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-zinc-700/40" />
          <span className="text-xs text-zinc-600">Snitt</span>
        </div>
      </div>
    </div>
  )
}
