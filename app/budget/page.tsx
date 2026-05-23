'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, Target, Plus, Trash2, TrendingUp, TrendingDown, Sparkles, Loader2, Check } from 'lucide-react'

interface Budget {
  id: string
  category: string
  amount: number
}

interface CategorySpend {
  category: string
  amount: number
  baseline: number
}

interface BudgetSuggestion {
  category: string
  amount: number
  reason: string
}

const CATEGORIES = [
  'mat', 'restaurang', 'transport', 'prenumeration', 'nöje',
  'hälsa', 'kläder', 'elektronik', 'kontantuttag', 'övrigt',
]

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<CategorySpend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newAmount, setNewAmount] = useState('')
  const [saving, setSaving] = useState(false)

  // AI suggestions
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[] | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set())

  useEffect(() => {
    void Promise.all([
      fetch('/api/budget').then(r => r.json()),
      fetch('/api/analyze').then(r => r.json()),
    ])
      .then(([b, a]) => {
        setBudgets(b as Budget[])
        setCategories(((a as { categories?: CategorySpend[] }).categories) ?? [])
      })
      .catch(() => setError('Kunde inte ladda budget'))
      .finally(() => setLoading(false))
  }, [])

  async function saveBudget() {
    if (!newAmount || parseFloat(newAmount) <= 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory, amount: parseFloat(newAmount) }),
      })
      if (!res.ok) throw new Error('failed')
      const budget = await res.json() as Budget
      setBudgets(prev => [...prev.filter(b => b.category !== budget.category), budget])
      setAdding(false)
      setNewAmount('')
    } catch {
      setError('Kunde inte spara budget')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBudget(category: string) {
    try {
      await fetch(`/api/budget?category=${encodeURIComponent(category)}`, { method: 'DELETE' })
      setBudgets(prev => prev.filter(b => b.category !== category))
    } catch {
      setError('Kunde inte ta bort budget')
    }
  }

  async function acceptSuggestion(s: BudgetSuggestion) {
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: s.category, amount: s.amount }),
      })
      if (!res.ok) throw new Error('failed')
      const budget = await res.json() as Budget
      setBudgets(prev => [...prev.filter(b => b.category !== budget.category), budget])
      setAcceptedSuggestions(prev => new Set([...prev, s.category]))
    } catch {
      setError('Kunde inte spara förslag')
    }
  }

  async function fetchSuggestions() {
    setSuggestLoading(true)
    setSuggestError(null)
    setSuggestions(null)
    setAcceptedSuggestions(new Set())
    try {
      const res = await fetch('/api/budget/suggest')
      const data = await res.json() as { suggestions?: BudgetSuggestion[]; error?: string }
      if (!res.ok || data.error) {
        setSuggestError(data.error ?? 'Kunde inte hämta förslag')
      } else {
        setSuggestions(data.suggestions ?? [])
      }
    } catch {
      setSuggestError('Nätverksfel — försök igen')
    } finally {
      setSuggestLoading(false)
    }
  }

  const budgetMap = new Map(budgets.map(b => [b.category, b.amount]))
  const spendMap = new Map(categories.map(c => [c.category, c.amount]))

  const allCategories = new Set([...budgets.map(b => b.category), ...categories.map(c => c.category)])
  const budgetedCategories = [...allCategories].filter(c => budgetMap.has(c))
  const unbudgetedCategories = [...allCategories].filter(c => !budgetMap.has(c) && c !== 'inkomst')

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <Target className="w-4 h-4 text-zinc-600" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Budget</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Sätt månadsbudget per kategori.</p>
          </div>
          <button
            onClick={() => void fetchSuggestions()}
            disabled={suggestLoading}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
          >
            {suggestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI-förslag
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>
        )}

        {/* AI Suggestions */}
        {(suggestions || suggestError) && (
          <div className="bg-[#0f0f0f] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">AI-rekommendationer</p>
            </div>
            {suggestError ? (
              <p className="text-sm text-red-400">{suggestError}</p>
            ) : suggestions && suggestions.length > 0 ? (
              <>
                <p className="text-xs text-zinc-500">Baserat på dina senaste 3 månaders utgifter. Klicka för att acceptera.</p>
                <div className="space-y-2">
                  {suggestions.map(s => {
                    const accepted = acceptedSuggestions.has(s.category)
                    const existing = budgetMap.get(s.category)
                    return (
                      <div key={s.category} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${accepted ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-[#141414] border-white/[0.04]'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-200 capitalize">{s.category}</span>
                            {existing && existing !== s.amount && (
                              <span className="text-xs text-zinc-600">(nu: {existing.toLocaleString('sv-SE')} kr)</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-600 mt-0.5">{s.reason}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-semibold ${accepted ? 'text-emerald-400' : 'text-zinc-100'}`}>
                            {s.amount.toLocaleString('sv-SE')} kr
                          </span>
                          <button
                            onClick={() => void acceptSuggestion(s)}
                            disabled={accepted}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${accepted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#1c1c1c] text-zinc-500 hover:bg-emerald-950/40 hover:text-emerald-400'}`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {acceptedSuggestions.size > 0 && (
                  <p className="text-xs text-emerald-500 text-center pt-1">
                    {acceptedSuggestions.size} av {suggestions.length} accepterade ✓
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Inga förslag just nu.</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <>
            {/* Budgeted categories */}
            {budgetedCategories.length > 0 && (
              <div className="space-y-3">
                {budgetedCategories.map(cat => {
                  const limit = budgetMap.get(cat) ?? 0
                  const spent = spendMap.get(cat) ?? 0
                  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0
                  const over = spent > limit
                  const remaining = limit - spent

                  return (
                    <div key={cat} className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-100 capitalize">{cat}</span>
                          {over
                            ? <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                            : pct > 80
                            ? <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                            : <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                          }
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${over ? 'text-red-400' : 'text-zinc-400'}`}>
                            {Math.round(spent).toLocaleString('sv-SE')} / {Math.round(limit).toLocaleString('sv-SE')} kr
                          </span>
                          <button
                            onClick={() => void deleteBudget(cat)}
                            className="text-zinc-700 hover:text-zinc-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <p className={`text-xs mt-1.5 ${over ? 'text-red-400' : pct > 80 ? 'text-amber-400' : 'text-zinc-600'}`}>
                        {over
                          ? `${Math.round(Math.abs(remaining)).toLocaleString('sv-SE')} kr över budget`
                          : `${Math.round(remaining).toLocaleString('sv-SE')} kr kvar denna månad`
                        }
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add budget form */}
            {adding ? (
              <div className="bg-[#0f0f0f] border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-medium text-zinc-200">Lägg till budget</p>
                <div className="flex gap-2">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="flex-1 bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                  >
                    {CATEGORIES.filter(c => !budgetMap.has(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      value={newAmount}
                      onChange={e => setNewAmount(e.target.value)}
                      placeholder="2000"
                      min={0}
                      className="w-32 bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 pr-8 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">kr</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void saveBudget()}
                    disabled={saving || !newAmount}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 rounded-xl font-medium transition-colors disabled:opacity-40"
                  >
                    {saving ? 'Sparar...' : 'Spara'}
                  </button>
                  <button onClick={() => setAdding(false)} className="px-4 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full flex items-center justify-center gap-2 bg-[#0f0f0f] border border-dashed border-white/[0.08] hover:border-white/[0.16] text-zinc-500 hover:text-zinc-300 text-sm py-4 rounded-2xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Lägg till budget manuellt
              </button>
            )}

            {/* Unbudgeted categories */}
            {unbudgetedCategories.filter(c => (spendMap.get(c) ?? 0) > 0).length > 0 && (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Utan budget denna månad</p>
                <div className="space-y-2">
                  {unbudgetedCategories
                    .filter(c => (spendMap.get(c) ?? 0) > 0)
                    .sort((a, b) => (spendMap.get(b) ?? 0) - (spendMap.get(a) ?? 0))
                    .map(cat => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="text-sm text-zinc-400 capitalize">{cat}</span>
                        <span className="text-sm text-zinc-300">
                          {Math.round(spendMap.get(cat) ?? 0).toLocaleString('sv-SE')} kr
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
