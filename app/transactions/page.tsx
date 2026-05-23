'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, PenLine, ChevronDown, Search, X, Check } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  balance: number
  category: string | null
  isIncome: boolean
  note: string | null
  createdAt: string
}

interface MerchantAlias {
  id: string
  merchant: string
  displayName: string
  explanation: string | null
}

interface MerchantGroup {
  merchant: string
  displayName: string
  explanation: string | null
  total: number
  count: number
  lastDate: string
  category: string | null
}

interface CategoryGroup {
  category: string
  total: number
  count: number
  merchants: { merchant: string; displayName: string; amount: number }[]
}

const CATEGORIES = [
  'mat', 'restaurang', 'transport', 'prenumeration', 'hyra',
  'nöje', 'hälsa', 'kläder', 'elektronik', 'kontantuttag', 'inkomst', 'övrigt',
  'utlägg', 'återbetalning',
]

const CAT_COLOR: Record<string, string> = {
  mat: 'bg-green-900/60 text-green-300',
  restaurang: 'bg-orange-900/60 text-orange-300',
  transport: 'bg-blue-900/60 text-blue-300',
  prenumeration: 'bg-purple-900/60 text-purple-300',
  hyra: 'bg-red-900/60 text-red-300',
  nöje: 'bg-pink-900/60 text-pink-300',
  hälsa: 'bg-teal-900/60 text-teal-300',
  kläder: 'bg-yellow-900/60 text-yellow-300',
  elektronik: 'bg-cyan-900/60 text-cyan-300',
  kontantuttag: 'bg-zinc-700/60 text-zinc-300',
  inkomst: 'bg-emerald-900/60 text-emerald-300',
  övrigt: 'bg-zinc-800/60 text-zinc-400',
  utlägg: 'bg-amber-900/60 text-amber-300',
  återbetalning: 'bg-emerald-900/60 text-emerald-300',
}

const CAT_BAR: Record<string, string> = {
  mat: 'bg-green-500', restaurang: 'bg-orange-500', transport: 'bg-blue-500',
  prenumeration: 'bg-purple-500', hyra: 'bg-red-500', nöje: 'bg-pink-500',
  hälsa: 'bg-teal-500', kläder: 'bg-yellow-500', elektronik: 'bg-cyan-500',
  kontantuttag: 'bg-zinc-500', inkomst: 'bg-emerald-500', övrigt: 'bg-zinc-600',
  utlägg: 'bg-amber-500',
  återbetalning: 'bg-emerald-400',
}

const MONTHS_SV = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December']
const MONTHS_SHORT: Record<number,string> = {0:'jan',1:'feb',2:'mar',3:'apr',4:'maj',5:'jun',6:'jul',7:'aug',8:'sep',9:'okt',10:'nov',11:'dec'}

function formatDate(d: string) {
  const dt = new Date(d)
  return `${dt.getDate().toString().padStart(2,'0')} ${MONTHS_SHORT[dt.getMonth()]??''}`
}
function fmt(n: number) { return Math.round(n).toLocaleString('sv-SE') }
function getCurrentMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${(n.getMonth()+1).toString().padStart(2,'0')}`
}
function recentMonths() {
  const months: string[] = []
  const n = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(n.getFullYear(), n.getMonth()-i, 1)
    months.push(`${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`)
  }
  return months
}
function monthLabel(m: string) {
  const [y,mon] = m.split('-').map(Number)
  return `${MONTHS_SV[mon-1]} ${y}`
}

const inputCls = 'bg-[#0f0f0f] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/[0.16] transition-colors'

type ViewMode = 'lista' | 'handlare' | 'kategorier'

interface EditorState {
  displayName: string
  explanation: string
  category: string
  saved: boolean
  saving: boolean
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [aliasMap, setAliasMap] = useState<Map<string, MerchantAlias>>(new Map())
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(getCurrentMonth())
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [view, setView] = useState<ViewMode>('lista')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<Record<string, EditorState>>({})
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [merchantFilter, setMerchantFilter] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search])

  useEffect(() => { void fetchAliases() }, [])

  async function fetchAliases() {
    const res = await fetch('/api/merchants').catch(() => null)
    if (!res?.ok) return
    const data = (await res.json()) as MerchantAlias[]
    const map = new Map<string, MerchantAlias>()
    data.forEach((a) => map.set(a.merchant, a))
    setAliasMap(map)
  }

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (month) p.set('month', month)
      if (category) p.set('category', category)
      if (debouncedSearch) p.set('search', debouncedSearch)
      const res = await fetch(`/api/transactions?${p}`)
      if (res.ok) setTransactions((await res.json()) as Transaction[])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [month, category, debouncedSearch])

  useEffect(() => { void fetchTransactions() }, [fetchTransactions])

  function openEditor(tx: Transaction) {
    const alias = aliasMap.get(tx.merchant)
    setEditor((prev) => ({
      ...prev,
      [tx.id]: {
        displayName: alias?.displayName ?? tx.merchant,
        explanation: alias?.explanation ?? tx.note ?? '',
        category: tx.category ?? 'övrigt',
        saved: false,
        saving: false,
      },
    }))
    setEditingId(tx.id)
  }

  async function saveEditor(tx: Transaction) {
    const e = editor[tx.id]
    if (!e || e.saving || e.saved) return
    setEditor((prev) => ({ ...prev, [tx.id]: { ...e, saving: true } }))
    try {
      await Promise.all([
        fetch('/api/merchants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant: tx.merchant, displayName: e.displayName, explanation: e.explanation }),
        }),
        fetch(`/api/transactions/${tx.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: e.explanation || null, category: e.category }),
        }),
      ])
      setAliasMap((prev) => {
        const next = new Map(prev)
        next.set(tx.merchant, { id: prev.get(tx.merchant)?.id ?? '', merchant: tx.merchant, displayName: e.displayName, explanation: e.explanation || null })
        return next
      })
      setTransactions((prev) => prev.map((t) =>
        t.id === tx.id ? { ...t, note: e.explanation || null, category: e.category } : t
      ))
      setEditor((prev) => ({ ...prev, [tx.id]: { ...e, saved: true, saving: false } }))
      setTimeout(() => setEditingId(null), 600)
    } catch (err) {
      console.error(err)
      setEditor((prev) => ({ ...prev, [tx.id]: { ...e, saving: false } }))
    }
  }

  // ── Derived data ──────────────────────────────────────────────
  const spending = transactions.filter((t) => !t.isIncome)
  const totalSpend = spending.reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalIncome = transactions.filter((t) => t.isIncome).reduce((s, t) => s + t.amount, 0)

  const merchantGroups: MerchantGroup[] = (() => {
    const map = new Map<string, MerchantGroup>()
    for (const tx of spending) {
      const alias = aliasMap.get(tx.merchant)
      const key = tx.merchant
      const ex = map.get(key)
      if (ex) {
        ex.total += Math.abs(tx.amount)
        ex.count++
        if (tx.date > ex.lastDate) ex.lastDate = tx.date
      } else {
        map.set(key, {
          merchant: tx.merchant,
          displayName: alias?.displayName ?? tx.merchant,
          explanation: alias?.explanation ?? null,
          total: Math.abs(tx.amount),
          count: 1,
          lastDate: tx.date,
          category: tx.category,
        })
      }
    }
    return Array.from(map.values())
      .filter((g) => !merchantFilter || g.displayName.toLowerCase().includes(merchantFilter.toLowerCase()) || g.merchant.toLowerCase().includes(merchantFilter.toLowerCase()))
      .sort((a, b) => b.total - a.total)
  })()

  const categoryGroups: CategoryGroup[] = (() => {
    const map = new Map<string, CategoryGroup>()
    for (const tx of spending) {
      const cat = tx.category ?? 'övrigt'
      const alias = aliasMap.get(tx.merchant)
      const name = alias?.displayName ?? tx.merchant
      const ex = map.get(cat)
      if (ex) {
        ex.total += Math.abs(tx.amount)
        ex.count++
        // Key by raw merchant so we can pass it to the search filter correctly
        const m = ex.merchants.find((x) => x.merchant === tx.merchant)
        if (m) m.amount += Math.abs(tx.amount)
        else ex.merchants.push({ merchant: tx.merchant, displayName: name, amount: Math.abs(tx.amount) })
      } else {
        map.set(cat, { category: cat, total: Math.abs(tx.amount), count: 1, merchants: [{ merchant: tx.merchant, displayName: name, amount: Math.abs(tx.amount) }] })
      }
    }
    return Array.from(map.values())
      .map((g) => ({ ...g, merchants: g.merchants.sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.total - a.total)
  })()

  const maxCatTotal = categoryGroups[0]?.total ?? 1

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      {/* Header */}
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-4 sticky top-0 sm:top-12 z-30">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5 text-sm">
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-lg font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        {!loading && (
          <div className="text-right">
            <p className="text-sm font-bold text-red-400">−{fmt(totalSpend)} kr</p>
            {totalIncome > 0 && <p className="text-xs text-emerald-400">+{fmt(totalIncome)} kr in</p>}
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24 sm:pb-5 space-y-4">

        {/* Search + month row */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök handlare, kategori, not…"
              className="w-full bg-[#0f0f0f] border border-white/[0.08] rounded-xl pl-9 pr-8 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/[0.16] transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={`${inputCls} shrink-0`}
          >
            <option value="">Alla</option>
            {recentMonths().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>

        {/* Sub-header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-300">
            {search ? `Söker "${search}"` : month ? monthLabel(month) : 'Alla månader'}
          </h2>
          {!loading && (
            <p className="text-xs text-zinc-600">
              {transactions.length} transaktioner
            </p>
          )}
        </div>

        {/* View tabs */}
        <div className="flex gap-1 bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-1">
          {(['lista', 'handlare', 'kategorier'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                view === v ? 'bg-[#161616] text-zinc-100 border border-white/[0.08]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'lista' ? 'Lista' : v === 'handlare' ? 'Per handlare' : 'Per kategori'}
            </button>
          ))}
        </div>

        {/* Category chips — lista view only */}
        {view === 'lista' && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory('')}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${category === '' ? 'border-zinc-400 text-zinc-100 bg-zinc-700' : 'border-white/[0.08] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300'}`}
            >
              Alla
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? '' : cat)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${category === cat ? `${CAT_COLOR[cat]} border-transparent` : 'border-white/[0.08] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ─── LISTA VIEW ─── */}
        {view === 'lista' && (
          loading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl p-4 animate-pulse h-16" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-10 text-center">
              <p className="text-zinc-500 text-sm">Inga transaktioner hittades.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx) => {
                const alias = aliasMap.get(tx.merchant)
                const displayName = alias?.displayName ?? tx.merchant
                const explanation = alias?.explanation ?? tx.note
                const catColor = CAT_COLOR[tx.category ?? 'övrigt'] ?? CAT_COLOR['övrigt']
                const isEditing = editingId === tx.id
                const e = editor[tx.id]
                const amountCls = tx.isIncome ? 'text-emerald-400' : 'text-zinc-200'

                return (
                  <div
                    key={tx.id}
                    className={`bg-[#0f0f0f] border rounded-2xl overflow-hidden transition-colors ${
                      isEditing ? 'border-white/[0.14]' : 'border-white/[0.06] hover:border-white/[0.10]'
                    }`}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                      onClick={() => isEditing ? setEditingId(null) : openEditor(tx)}
                    >
                      <span className="text-xs text-zinc-600 shrink-0 w-10 tabular-nums">{formatDate(tx.date)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-zinc-100 truncate">{displayName}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${catColor}`}>{tx.category ?? 'övrigt'}</span>
                          {tx.category === 'utlägg' && (
                            <span className="text-[10px] text-amber-400/70 ml-1">↩ utlägg</span>
                          )}
                        </div>
                        {explanation ? (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">{explanation}</p>
                        ) : alias?.displayName && alias.displayName !== tx.merchant ? (
                          <p className="text-xs text-zinc-700 mt-0.5 flex items-center gap-1 opacity-60">
                            <PenLine className="w-2.5 h-2.5" />
                            {tx.merchant}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-700 mt-0.5 flex items-center gap-1">
                            <PenLine className="w-2.5 h-2.5" />
                            Tryck för att byta namn
                          </p>
                        )}
                      </div>
                      <span className={`text-sm font-semibold shrink-0 tabular-nums ${amountCls}`}>
                        {tx.isIncome ? '+' : '−'}{fmt(Math.abs(tx.amount))} kr
                      </span>
                    </div>

                    {/* Inline editor */}
                    {isEditing && e && (
                      <div className="px-4 pb-4 pt-2 border-t border-white/[0.08] bg-[#0a0a0a] space-y-3">
                        <p className="text-xs text-zinc-600">
                          Alias och förklaring gäller alla transaktioner från <span className="text-zinc-400">{tx.merchant}</span>
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Display name */}
                          <div>
                            <label className="text-xs text-zinc-500 font-medium block mb-1">Byt namn (visas överallt i appen)</label>
                            <input
                              autoFocus
                              type="text"
                              value={e.displayName}
                              onChange={(ev) => setEditor((p) => ({ ...p, [tx.id]: { ...e, displayName: ev.target.value } }))}
                              onKeyDown={(ev) => { if (ev.key === 'Enter') void saveEditor(tx); if (ev.key === 'Escape') setEditingId(null) }}
                              placeholder={tx.merchant}
                              className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] transition-colors"
                            />
                          </div>

                          {/* Category */}
                          <div>
                            <label className="text-xs text-zinc-500 font-medium block mb-1">Kategori</label>
                            <select
                              value={e.category}
                              onChange={(ev) => setEditor((p) => ({ ...p, [tx.id]: { ...e, category: ev.target.value } }))}
                              className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-white/[0.18] transition-colors"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Explanation */}
                        <div>
                          <label className="text-xs text-zinc-500 font-medium block mb-1">Förklaring för AI:n</label>
                          <input
                            type="text"
                            value={e.explanation}
                            onChange={(ev) => setEditor((p) => ({ ...p, [tx.id]: { ...e, explanation: ev.target.value } }))}
                            onKeyDown={(ev) => { if (ev.key === 'Enter') void saveEditor(tx); if (ev.key === 'Escape') setEditingId(null) }}
                            placeholder="t.ex. spelbolag, gymkort, middag med jobbet, LeoVegas = nöje"
                            className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/[0.18] transition-colors"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs text-zinc-600 hover:text-zinc-400 px-3 py-1.5 transition-colors"
                          >
                            Avbryt
                          </button>
                          <button
                            onClick={() => void saveEditor(tx)}
                            disabled={e.saving || e.saved}
                            className={`flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-xl font-medium transition-all ${
                              e.saved
                                ? 'bg-emerald-900/60 border border-emerald-500/30 text-emerald-400'
                                : e.saving
                                  ? 'opacity-50 cursor-not-allowed bg-emerald-950/50 border border-emerald-500/20 text-emerald-400'
                                  : 'bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {e.saved ? <><Check className="w-3.5 h-3.5" /> Sparat</> : e.saving ? 'Sparar…' : 'Spara'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ─── HANDLARE VIEW ─── */}
        {view === 'handlare' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
              <input
                type="text"
                value={merchantFilter}
                onChange={(e) => setMerchantFilter(e.target.value)}
                placeholder="Filtrera handlare…"
                className="w-full bg-[#0f0f0f] border border-white/[0.08] rounded-xl pl-9 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/[0.16] transition-colors"
              />
            </div>
            <p className="text-xs text-zinc-600">{merchantGroups.length} handlare · {fmt(totalSpend)} kr totalt</p>

            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4].map((i) => <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl h-16 animate-pulse" />)}
              </div>
            ) : merchantGroups.length === 0 ? (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-10 text-center">
                <p className="text-zinc-500 text-sm">Inga handlare hittades.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {merchantGroups.map((g) => {
                  const pct = totalSpend > 0 ? Math.round((g.total / totalSpend) * 100) : 0
                  return (
                    <div key={g.merchant} className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.10] transition-colors">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-zinc-100 truncate">{g.displayName}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${CAT_COLOR[g.category ?? 'övrigt']}`}>{g.category ?? 'övrigt'}</span>
                          </div>
                          {g.explanation ? (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{g.explanation}</p>
                          ) : g.displayName !== g.merchant ? (
                            <p className="text-xs text-zinc-700 mt-0.5">{g.merchant}</p>
                          ) : null}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-zinc-100">{fmt(g.total)} kr</p>
                          <p className="text-xs text-zinc-600">{g.count} köp · {pct}%</p>
                        </div>
                      </div>
                      {/* Spend bar */}
                      <div className="h-0.5 bg-[#161616]">
                        <div className={`h-0.5 ${CAT_BAR[g.category ?? 'övrigt'] ?? 'bg-zinc-600'}`} style={{ width: `${Math.min(pct * 3, 100)}%` }} />
                      </div>
                      <button
                        onClick={() => { setSearch(g.merchant); setView('lista') }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] transition-colors border-t border-white/[0.06]"
                      >
                        <span>Visa alla {g.count} transaktioner</span>
                        <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── KATEGORIER VIEW ─── */}
        {view === 'kategorier' && (
          <div className="space-y-1.5">
            {loading ? (
              <div className="space-y-2">
                {[1,2,3,4].map((i) => <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl h-14 animate-pulse" />)}
              </div>
            ) : categoryGroups.length === 0 ? (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-10 text-center">
                <p className="text-zinc-500 text-sm">Inga kategorier att visa.</p>
              </div>
            ) : categoryGroups.map((g) => {
              const pct = Math.round((g.total / maxCatTotal) * 100)
              const isExpanded = expandedCategory === g.category

              return (
                <div key={g.category} className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.10] transition-colors">
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : g.category)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CAT_COLOR[g.category] ?? CAT_COLOR['övrigt']}`}>{g.category}</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-[#161616] rounded-full overflow-hidden">
                        <div className={`h-1.5 ${CAT_BAR[g.category] ?? 'bg-zinc-600'} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-zinc-100">{fmt(g.total)} kr</p>
                      <p className="text-xs text-zinc-600">{g.count} köp</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/[0.06]">
                      {g.merchants.slice(0, 12).map((m) => (
                        <button
                          key={m.merchant}
                          onClick={() => { setSearch(m.merchant); setView('lista') }}
                          className="w-full flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <span className="text-sm text-zinc-300 hover:text-zinc-100 truncate text-left">{m.displayName}</span>
                          <span className="text-sm text-zinc-500 shrink-0 ml-3">{fmt(m.amount)} kr</span>
                        </button>
                      ))}
                      {g.merchants.length > 12 && (
                        <p className="px-4 py-2 text-xs text-zinc-700">+{g.merchants.length - 12} fler</p>
                      )}
                      <button
                        onClick={() => { setCategory(g.category); setView('lista') }}
                        className="w-full px-4 py-2.5 text-xs text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] transition-colors text-left border-t border-white/[0.06]"
                      >
                        Visa alla {g.count} i {g.category} →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
