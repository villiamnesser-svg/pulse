'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, FileText, TrendingUp, TrendingDown, Minus, Sparkles, Loader2, ChevronDown, ChevronUp, Download } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  merchant: string
  amount: number
  category: string | null
  isIncome: boolean
}

interface MerchantAlias {
  merchant: string
  displayName: string
}

interface MonthReport {
  month: string
  year: number
  totalIncome: number
  totalExpenses: number
  netSavings: number
  byCategory: { category: string; amount: number; count: number }[]
  transactions: Transaction[]
}

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

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' }),
    })
  }
  return options
}

// Render AI analysis markdown-like text
function AiText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <h4 key={i} className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mt-4 first:mt-0">{line.slice(2, -2)}</h4>
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return <p key={i} className="pl-3 border-l-2 border-zinc-700 text-zinc-400">{line.slice(2)}</p>
        }
        if (line.trim() === '') return null
        // Bold within text
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="text-zinc-100 font-medium">{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function ReportPage() {
  const months = getMonthOptions()
  const [selectedMonth, setSelectedMonth] = useState(months[0].value)
  const [report, setReport] = useState<MonthReport | null>(null)
  const [aliases, setAliases] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showAllTx, setShowAllTx] = useState(false)

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiMonth, setAiMonth] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/merchants')
      .then(r => r.json())
      .then((data: MerchantAlias[]) => {
        setAliases(new Map(data.map(a => [a.merchant, a.displayName])))
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    setLoading(true)
    setAiAnalysis(null)
    setAiError(null)
    void fetch(`/api/transactions?month=${selectedMonth}`)
      .then(r => r.json())
      .then((txs: Transaction[]) => {
        const income = txs.filter(t => t.isIncome)
        const expenses = txs.filter(t => !t.isIncome)
        const totalIncome = income.reduce((s, t) => s + t.amount, 0)
        const totalExpenses = Math.abs(expenses.reduce((s, t) => s + t.amount, 0))

        const catMap = new Map<string, { amount: number; count: number }>()
        for (const tx of expenses) {
          const cat = tx.category ?? 'övrigt'
          const existing = catMap.get(cat) ?? { amount: 0, count: 0 }
          catMap.set(cat, { amount: existing.amount + Math.abs(tx.amount), count: existing.count + 1 })
        }

        const byCategory = Array.from(catMap.entries())
          .map(([category, data]) => ({ category, ...data }))
          .sort((a, b) => b.amount - a.amount)

        const [year, month] = selectedMonth.split('-')
        const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1)
          .toLocaleDateString('sv-SE', { month: 'long' })

        setReport({ month: monthLabel, year: parseInt(year), totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses, byCategory, transactions: txs })
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [selectedMonth])

  async function generateAiAnalysis() {
    if (aiLoading) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/report/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      })
      const data = await res.json() as { analysis?: string; error?: string }
      if (!res.ok || data.error) {
        setAiError(data.error ?? 'Kunde inte generera analys')
      } else {
        setAiAnalysis(data.analysis ?? null)
        setAiMonth(selectedMonth)
      }
    } catch {
      setAiError('Nätverksfel — försök igen')
    } finally {
      setAiLoading(false)
    }
  }

  const fmt = (n: number) => Math.round(n).toLocaleString('sv-SE')
  const displayName = (merchant: string) => aliases.get(merchant) ?? merchant

  function downloadCsv() {
    const [year, month] = selectedMonth.split('-')
    const from = `${year}-${month}-01`
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    window.location.href = `/api/export?format=csv&from=${from}&to=${to}`
  }

  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <FileText className="w-4 h-4 text-zinc-600" />
        <button
          onClick={downloadCsv}
          title="Ladda ner CSV"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.06] px-2.5 py-1.5 rounded-xl transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-100">Månadsrapport</h2>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="bg-[#0f0f0f] border border-white/[0.08] rounded-xl px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : report ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1">Inkomst</p>
                <p className="text-lg font-bold text-emerald-400">+{fmt(report.totalIncome)}</p>
                <p className="text-xs text-zinc-600">kr</p>
              </div>
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1">Utgifter</p>
                <p className="text-lg font-bold text-zinc-100">-{fmt(report.totalExpenses)}</p>
                <p className="text-xs text-zinc-600">kr</p>
              </div>
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs text-zinc-600 uppercase tracking-wide mb-1">Netto</p>
                <div className="flex items-center gap-1">
                  {report.netSavings > 0
                    ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                    : report.netSavings < 0
                    ? <TrendingDown className="w-4 h-4 text-red-400" />
                    : <Minus className="w-4 h-4 text-zinc-500" />
                  }
                  <p className={`text-lg font-bold ${report.netSavings > 0 ? 'text-emerald-400' : report.netSavings < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                    {report.netSavings > 0 ? '+' : ''}{fmt(report.netSavings)}
                  </p>
                </div>
                <p className="text-xs text-zinc-600">kr</p>
              </div>
            </div>

            {/* AI Analysis */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">AI-analys</p>
                </div>
                {(!aiAnalysis || aiMonth !== selectedMonth) && (
                  <button
                    onClick={() => void generateAiAnalysis()}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 bg-emerald-950/30 border border-emerald-500/20 px-3 py-1.5 rounded-lg"
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {aiLoading ? 'Analyserar...' : 'Generera analys'}
                  </button>
                )}
              </div>

              {aiAnalysis && aiMonth === selectedMonth ? (
                <AiText text={aiAnalysis} />
              ) : aiError ? (
                <p className="text-sm text-red-400">{aiError}</p>
              ) : (
                <p className="text-sm text-zinc-600">
                  Låt Pulse analysera din {report.month} med AI — se vad som sticker ut, var du kan spara och personlig coaching.
                </p>
              )}
            </div>

            {/* Category breakdown */}
            {report.byCategory.length > 0 && (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Per kategori</p>
                <div className="space-y-3">
                  {report.byCategory.map(cat => {
                    const pct = report.totalExpenses > 0 ? (cat.amount / report.totalExpenses) * 100 : 0
                    const color = CAT_COLORS[cat.category] ?? 'bg-zinc-600'
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-zinc-300 capitalize">{cat.category}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-600">{cat.count} köp</span>
                            <span className="text-sm text-zinc-200">{fmt(cat.amount)} kr</span>
                          </div>
                        </div>
                        <div className="h-1 bg-[#1c1c1c] rounded-full overflow-hidden">
                          <div className={`h-full ${color} opacity-70 rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* All transactions */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                  Alla transaktioner ({report.transactions.length})
                </p>
                <button
                  onClick={() => setShowAllTx(!showAllTx)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
                >
                  {showAllTx ? <><ChevronUp className="w-3 h-3" />Minimera</> : <><ChevronDown className="w-3 h-3" />Visa alla</>}
                </button>
              </div>
              <div className={`space-y-0 ${showAllTx ? '' : 'max-h-72 overflow-y-auto'}`}>
                {report.transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{displayName(tx.merchant)}</p>
                      <p className="text-xs text-zinc-600">
                        {new Date(tx.date).toLocaleDateString('sv-SE')} · {tx.category ?? 'övrigt'}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ml-3 shrink-0 ${tx.isIncome ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {tx.isIncome ? '+' : '-'}{fmt(Math.abs(tx.amount))} kr
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Inga transaktioner denna månad.</p>
          </div>
        )}
      </main>
    </div>
  )
}
