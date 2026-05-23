'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Settings, Upload, RefreshCw } from 'lucide-react'
import VelocityCard from '@/components/VelocityCard'
import InsightFeed from '@/components/InsightFeed'
import SubscriptionRadar from '@/components/SubscriptionRadar'
import PositiveStreak from '@/components/PositiveStreak'
import CategoryBreakdown from '@/components/CategoryBreakdown'
import PushSetup from '@/components/PushSetup'
import MonthComparison from '@/components/MonthComparison'
import MonthSummary from '@/components/MonthSummary'
import SpendingChart from '@/components/SpendingChart'
import SavingsGoal from '@/components/SavingsGoal'
import PaydayForecast from '@/components/PaydayForecast'
import HealthScore from '@/components/HealthScore'
import { VelocityResult, CategoryBreakdown as CategoryBreakdownType } from '@/lib/velocity'

interface UserProfile {
  id: string
  name: string | null
  savingsTarget: number | null
  paydayDay: number
  monthlyRent: number
}

interface Subscription {
  merchant: string
  amount: number
  lastCharged: string
  monthsDetected: number
  isKnown: boolean
}

interface MonthSummaryData {
  totalIncome: number
  totalExpenses: number
  netSavings: number
  incomeCount: number
  expenseCount: number
  recentTransactions: {
    id: string
    date: string
    merchant: string
    amount: number
    category: string | null
    isIncome: boolean
  }[]
  uncategorizedCount: number
}

interface AnalyzeResponse {
  velocity: VelocityResult
  categories: CategoryBreakdownType[]
  subscriptions?: Subscription[]
  summary?: MonthSummaryData
}

const LEVEL_DOT: Record<string, string> = {
  SAFE: 'bg-emerald-400',
  WARNING: 'bg-amber-400 animate-pulse',
  CRITICAL: 'bg-red-400 animate-pulse',
}

export default function Home() {
  const [data, setData] = useState<AnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showPushBanner, setShowPushBanner] = useState(false)
  const [aliasMap, setAliasMap] = useState<Map<string, string>>(new Map())
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    void fetchAnalysis()
    void fetchProfile()
    void fetch('/api/merchants').then(r => r.json()).then((aliases: { merchant: string; displayName: string }[]) => {
      const m = new Map<string, string>()
      aliases.forEach(a => m.set(a.merchant, a.displayName))
      setAliasMap(m)
    }).catch(() => {})
    runDailyHeartbeat()
    const timer = setTimeout(() => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      try { if (Notification.permission === 'denied') return } catch { return }
      navigator.serviceWorker.getRegistration('/sw.js')
        .then(async (reg) => {
          if (!reg) { setShowPushBanner(true); return }
          const sub = await reg.pushManager.getSubscription()
          if (!sub) setShowPushBanner(true)
        })
        .catch(() => setShowPushBanner(true))
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  function runDailyHeartbeat() {
    const now = new Date()
    const win = Math.floor(now.getHours() / 8)
    const key = `pulse_heartbeat_${now.toDateString()}_${win}`
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      fetch('/api/heartbeat').catch(() => {})
    }
  }

  async function fetchProfile() {
    try {
      const res = await fetch('/api/profile')
      if (res.ok) setProfile((await res.json()) as UserProfile | null)
    } catch { /* silent */ }
  }

  async function fetchAnalysis(manual = false) {
    if (manual) setRefreshing(true)
    else setLoading(true)
    setFetchError(false)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch('/api/analyze', { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) setData((await res.json()) as AnalyzeResponse)
      else setFetchError(true)
    } catch { setFetchError(true) }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const dotClass = LEVEL_DOT[data?.velocity?.level ?? ''] ?? 'bg-zinc-700'

  const now = new Date()
  const hours = now.getHours()
  const greeting = hours < 5 ? 'God natt' : hours < 12 ? 'God morgon' : hours < 18 ? 'Hej' : 'God kväll'
  const firstName = profile?.name?.split(' ')[0]

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* ── Header ── */}
      <header className="bg-[#080808]/90 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 sm:top-12 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: logo + status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-black tracking-[0.15em] text-white uppercase">PULSE</span>
            </div>
            <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => void fetchAnalysis(true)}
              disabled={refreshing}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
              title="Uppdatera"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/upload"
              className="flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl transition-colors"
            >
              <Upload className="w-3 h-3" />
              Importera
            </Link>
            <Link
              href="/settings"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
            </Link>
            <PushSetup />
          </div>
        </div>

        {/* Greeting bar */}
        {firstName && (
          <div className="max-w-5xl mx-auto px-4 pb-2.5">
            <p className="text-xs text-zinc-500">
              {greeting}, <span className="text-zinc-300 font-medium">{firstName}</span>
            </p>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 sm:pb-8 space-y-4">
        {/* Push notification banner */}
        {showPushBanner && (
          <PushSetup banner onDismiss={() => setShowPushBanner(false)} />
        )}

        {/* Error state */}
        {fetchError && !loading && (
          <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-red-400 text-sm">⚠</span>
            <p className="text-sm text-red-400">Kunde inte hämta data — kontrollera anslutningen.</p>
            <button onClick={() => void fetchAnalysis(true)} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
              Försök igen
            </button>
          </div>
        )}

        {/* Velocity card — hero */}
        <VelocityCard velocity={data?.velocity ?? null} loading={loading} />

        {/* Month summary + savings goal side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MonthSummary summary={data?.summary ?? null} loading={loading} aliasMap={aliasMap} />
          </div>
          <div className="space-y-4">
            <PaydayForecast />
            <SavingsGoal
              summary={data?.summary ?? null}
              savingsTarget={profile?.savingsTarget ?? null}
              loading={loading}
            />
            <PositiveStreak velocity={data?.velocity ?? null} />
          </div>
        </div>

        {/* 30-day spending chart */}
        <SpendingChart />

        {/* Insights + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <InsightFeed />
            <MonthComparison />
          </div>
          <div className="space-y-4">
            <HealthScore />
            <SubscriptionRadar subscriptions={data?.subscriptions ?? []} loading={loading} aliasMap={aliasMap} />
          </div>
        </div>

        {/* Category breakdown — full width */}
        <CategoryBreakdown categories={data?.categories ?? []} loading={loading} />
      </main>

      <footer className="border-t border-white/[0.04] py-5 text-center">
        <p className="text-[10px] text-zinc-700 tracking-wider uppercase">Pulse · AI Ekonomiassistent</p>
      </footer>
    </div>
  )
}
