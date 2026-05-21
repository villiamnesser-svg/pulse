'use client'

import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'

interface CategoryBreakdown {
  category: string
  amount: number
  baseline: number
}

interface CategoryBreakdownProps {
  categories: CategoryBreakdown[]
  loading?: boolean
}

const CATEGORY_META: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  mat:          { label: 'Mat & Dagligvaror',   emoji: '🛒', color: 'bg-lime-500',    bg: 'bg-lime-500/10' },
  restaurang:   { label: 'Restaurang & Café',   emoji: '🍽️', color: 'bg-orange-500', bg: 'bg-orange-500/10' },
  transport:    { label: 'Transport',            emoji: '🚇', color: 'bg-blue-500',   bg: 'bg-blue-500/10' },
  prenumeration:{ label: 'Prenumerationer',      emoji: '🔄', color: 'bg-purple-500', bg: 'bg-purple-500/10' },
  hyra:         { label: 'Hyra & Boende',        emoji: '🏠', color: 'bg-cyan-500',   bg: 'bg-cyan-500/10' },
  nöje:         { label: 'Nöje & Fritid',        emoji: '🎭', color: 'bg-pink-500',   bg: 'bg-pink-500/10' },
  hälsa:        { label: 'Hälsa & Vård',         emoji: '💊', color: 'bg-red-400',    bg: 'bg-red-400/10' },
  kläder:       { label: 'Kläder & Mode',        emoji: '👗', color: 'bg-rose-500',   bg: 'bg-rose-500/10' },
  elektronik:   { label: 'Elektronik & Tech',    emoji: '💻', color: 'bg-indigo-500', bg: 'bg-indigo-500/10' },
  träning:      { label: 'Träning & Sport',      emoji: '🏋️', color: 'bg-teal-500',  bg: 'bg-teal-500/10' },
  resor:        { label: 'Resor',                emoji: '✈️', color: 'bg-sky-500',    bg: 'bg-sky-500/10' },
  skönhet:      { label: 'Skönhet & Hygien',     emoji: '💅', color: 'bg-fuchsia-500',bg: 'bg-fuchsia-500/10' },
  hem:          { label: 'Hem & Inredning',      emoji: '🪴', color: 'bg-amber-600',  bg: 'bg-amber-600/10' },
  tjänster:     { label: 'Tjänster & Avgifter',  emoji: '🏦', color: 'bg-slate-400',  bg: 'bg-slate-400/10' },
  kontantuttag: { label: 'Kontantuttag',         emoji: '💵', color: 'bg-yellow-500', bg: 'bg-yellow-500/10' },
  övrigt:       { label: 'Övrigt',               emoji: '📦', color: 'bg-zinc-500',   bg: 'bg-zinc-500/10' },
}

function getMeta(cat: string) {
  return CATEGORY_META[cat] ?? { label: cat, emoji: '📦', color: 'bg-zinc-500', bg: 'bg-zinc-500/10' }
}

export default function CategoryBreakdown({ categories, loading }: CategoryBreakdownProps) {
  const [expanded, setExpanded] = useState(false)

  const expenses = categories.filter(c => c.category !== 'inkomst')
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount)
  const totalSpend = sorted.reduce((s, c) => s + c.amount, 0)

  const SHOW = 6
  const visible = expanded ? sorted : sorted.slice(0, SHOW)
  const hasMore = sorted.length > SHOW

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 bg-[#161616] rounded w-36 mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 bg-[#161616] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">Kategorier</h3>
        </div>
        <p className="text-zinc-500 text-sm py-6 text-center">Ingen data ännu.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
            Utgifter denna månad
          </h3>
        </div>
        <span className="text-xs text-zinc-600">
          {Math.round(totalSpend).toLocaleString('sv-SE')} kr totalt
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {visible.map((cat) => {
          const meta = getMeta(cat.category)
          const pct = totalSpend > 0 ? (cat.amount / totalSpend) * 100 : 0
          const isOver = cat.baseline > 0 && cat.amount > cat.baseline * 1.1
          const barPct = cat.baseline > 0
            ? Math.min((cat.amount / cat.baseline) * 100, 100)
            : pct * 2

          return (
            <div
              key={cat.category}
              className="bg-[#161616] border border-white/[0.05] rounded-xl p-3.5 hover:border-white/[0.1] transition-colors"
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{meta.emoji}</span>
                  <span className="text-sm font-medium text-zinc-300">{meta.label}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${isOver ? 'text-amber-400' : 'text-zinc-100'}`}>
                    {Math.round(cat.amount).toLocaleString('sv-SE')} kr
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-1.5 bg-[#0f0f0f] rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-amber-500' : meta.color}`}
                  style={{ width: `${Math.min(barPct, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600">
                  {pct.toFixed(1)}% av totalt
                </span>
                {cat.baseline > 0 && (
                  <span className={`text-[10px] ${isOver ? 'text-amber-500' : 'text-zinc-600'}`}>
                    {isOver ? '▲ ' : ''}snitt {Math.round(cat.baseline).toLocaleString('sv-SE')} kr
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-2 border border-white/[0.05] hover:border-white/[0.1] rounded-xl"
        >
          {expanded ? 'Visa färre' : `Visa ${sorted.length - SHOW} fler kategorier`}
        </button>
      )}
    </div>
  )
}
