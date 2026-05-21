'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'

interface Subscription {
  merchant: string
  amount: number
  lastCharged: string
  monthsDetected: number
  dayOfMonth: number
  annualCost: number
}

interface SubscriptionsData {
  subscriptions: Subscription[]
  totalMonthly: number
  totalAnnual: number
}

interface AliasMap {
  merchant: string
  displayName: string
}

const SUB_EMOJI: Record<string, string> = {
  spotify: '🎵',
  netflix: '🎬',
  hbo: '🎬',
  disney: '🎬',
  youtube: '▶️',
  apple: '🍎',
  microsoft: '🪟',
  adobe: '🎨',
  dropbox: '📦',
  google: '🔍',
  tele2: '📱',
  telia: '📱',
  tre: '📱',
  telenor: '📱',
  comviq: '📱',
  amazon: '📦',
  github: '💻',
  openai: '🤖',
  chatgpt: '🤖',
}

function getEmoji(merchant: string): string {
  const lower = merchant.toLowerCase()
  for (const [key, emoji] of Object.entries(SUB_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return '🔄'
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('sv-SE')
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function statusColor(days: number) {
  if (days < 45) return 'text-emerald-400'
  if (days < 90) return 'text-amber-400'
  return 'text-red-400'
}

function statusDot(days: number) {
  if (days < 45) return 'bg-emerald-500'
  if (days < 90) return 'bg-amber-500'
  return 'bg-red-500'
}

function statusLabel(days: number) {
  if (days < 45) return null
  if (days < 90) return 'Stale?'
  return 'Avslutad?'
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsData | null>(null)
  const [aliases, setAliases] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For income % insight
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0)

  useEffect(() => {
    void Promise.all([
      fetch('/api/subscriptions').then(r => r.json()),
      fetch('/api/merchants').then(r => r.json()).catch(() => [] as AliasMap[]),
      fetch('/api/analyze').then(r => r.json()).catch(() => null),
    ])
      .then(([subs, aliasArr, analyze]) => {
        setData(subs as SubscriptionsData)
        setAliases(
          new Map(
            (aliasArr as AliasMap[]).map((a: AliasMap) => [a.merchant, a.displayName])
          )
        )
        // Try to extract monthly income from analyze
        const analyzeData = analyze as { monthlyIncome?: number; income?: number } | null
        if (analyzeData) {
          setMonthlyIncome(analyzeData.monthlyIncome ?? analyzeData.income ?? 0)
        }
      })
      .catch(() => setError('Kunde inte ladda prenumerationer'))
      .finally(() => setLoading(false))
  }, [])

  const displayName = (merchant: string) => aliases.get(merchant) ?? merchant

  const incomeSharePct =
    monthlyIncome > 0 && data
      ? Math.round((data.totalMonthly / monthlyIncome) * 100)
      : null

  return (
    <div className="min-h-screen bg-[#080808] pb-24 sm:pb-0">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <RefreshCw className="w-4 h-4 text-zinc-600" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Prenumerationer</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Automatiskt detekterade återkommande betalningar.</p>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse h-32" />
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-16"
              />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Insight banner */}
            {data.subscriptions.length > 0 && (
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-200/80">
                    Prenumerationer kostar dig{' '}
                    <span className="font-semibold text-amber-300">
                      {fmt(data.totalAnnual)} kr/år
                    </span>
                    {incomeSharePct !== null && (
                      <> — det är <span className="font-semibold text-amber-300">{incomeSharePct}%</span> av din inkomst</>
                    )}
                    .
                  </p>
                </div>
              </div>
            )}

            {/* Summary card */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                Totalt
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold text-zinc-100">{fmt(data.totalMonthly)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">kr/mån</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-100">{fmt(data.totalAnnual)}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">kr/år</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-zinc-100">{data.subscriptions.length}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">abonnemang</p>
                </div>
              </div>
            </div>

            {/* Subscription list */}
            {data.subscriptions.length === 0 ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">
                  Inga återkommande betalningar hittades.
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Minst 2 lika betalningar med ~30 dagars mellanrum krävs.
                </p>
              </div>
            ) : (
              <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    Prenumerationer ({data.subscriptions.length})
                  </p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {data.subscriptions.map(sub => {
                    const name = displayName(sub.merchant)
                    const emoji =
                      getEmoji(sub.merchant) !== '🔄'
                        ? getEmoji(sub.merchant)
                        : getEmoji(name)
                    const days = daysSince(sub.lastCharged)
                    const label = statusLabel(days)

                    return (
                      <div
                        key={sub.merchant}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="text-xl leading-none shrink-0">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-zinc-200 truncate">
                              {name}
                            </p>
                            {label && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                  days < 90
                                    ? 'text-amber-400 border-amber-500/20 bg-amber-950/20'
                                    : 'text-red-400 border-red-500/20 bg-red-950/20'
                                }`}
                              >
                                {label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${statusDot(days)}`} />
                            <p className={`text-xs ${statusColor(days)}`}>
                              Senast {formatDate(sub.lastCharged)}
                            </p>
                            <span className="text-zinc-700">·</span>
                            <p className="text-xs text-zinc-600">
                              dag {sub.dayOfMonth} i månaden
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-zinc-200">
                            {fmt(sub.amount)} kr/mån
                          </p>
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {fmt(sub.annualCost)} kr/år
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer note */}
            <p className="text-xs text-zinc-700 text-center pb-2">
              Detekterade automatiskt · Baserat på dina senaste 12 månader
            </p>
          </>
        ) : (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">Inga data tillgängliga.</p>
          </div>
        )}
      </main>
    </div>
  )
}
