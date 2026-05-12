'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, MessageCircle, Settings, CalendarDays } from 'lucide-react'
import VelocityCard from '@/components/VelocityCard'
import InsightFeed from '@/components/InsightFeed'
import SubscriptionRadar from '@/components/SubscriptionRadar'
import PositiveStreak from '@/components/PositiveStreak'
import CategoryBreakdown from '@/components/CategoryBreakdown'
import PushSetup from '@/components/PushSetup'
import MonthComparison from '@/components/MonthComparison'
import MonthSummary from '@/components/MonthSummary'
import SpendingChart from '@/components/SpendingChart'
import { VelocityResult, CategoryBreakdown as CategoryBreakdownType } from '@/lib/velocity'

interface UserProfile {
  id: string
  name: string | null
  age: number | null
  occupation: string | null
  financialGoal: string | null
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
  WARNING: 'bg-amber-400',
  CRITICAL: 'bg-red-400 animate-pulse',
}

export default function Home() {
  const [data, setData] = useState<AnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [showPushBanner, setShowPushBanner] = useState(false)

  useEffect(() => {
    void fetchAnalysis()
    void fetchProfile()
    runDailyHeartbeat()
    // Show push banner after a short delay if not subscribed
    const timer = setTimeout(() => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      try {
        if (Notification.permission === 'denied') return
      } catch { return }
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
      if (res.ok) {
        const p = (await res.json()) as UserProfile | null
        setProfile(p)
      }
    } catch (err) {
      console.error('Profile fetch error:', err)
    }
  }

  async function fetchAnalysis() {
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch('/api/analyze', { signal: controller.signal })
      clearTimeout(timeout)
      if (res.ok) {
        const analyzeData = (await res.json()) as AnalyzeResponse
        setData(analyzeData)
      }
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const dotClass = data?.velocity?.level
    ? (LEVEL_DOT[data.velocity.level] ?? 'bg-zinc-500')
    : 'bg-zinc-600'

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Header */}
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h1 className="text-lg font-black tracking-widest text-white uppercase">PULSE</h1>
          <div className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
          {profile?.name && (
            <span className="text-sm text-zinc-400 hidden sm:inline">
              Hej {profile.name}!
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchAnalysis()}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            Uppdatera
          </button>
          <Link
            href="/transactions"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            Transaktioner
          </Link>
          <Link
            href="/onboarding"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            Profil
          </Link>
          <Link
            href="/calendar"
            className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Kalender
          </Link>
          <Link
            href="/chat"
            className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Fråga
          </Link>
          <Link
            href="/settings"
            className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1"
          >
            <Settings className="w-3.5 h-3.5" />
            Inställningar
          </Link>
          <PushSetup />
          <Link
            href="/upload"
            className="text-xs bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] hover:border-white/[0.12] text-zinc-200 px-3 py-1.5 rounded-xl transition-colors font-medium"
          >
            + Importera
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6 space-y-4">
        {/* Push notification banner */}
        {showPushBanner && (
          <PushSetup banner onDismiss={() => setShowPushBanner(false)} />
        )}

        {/* Velocity Card — full width */}
        <VelocityCard velocity={data?.velocity ?? null} loading={loading} />

        {/* Month summary — income/expenses/net + recent tx + recategorize */}
        <MonthSummary summary={data?.summary ?? null} loading={loading} />

        {/* 30-day spending chart */}
        <SpendingChart />

        {/* Two-column layout on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — InsightFeed (wider) */}
          <div className="lg:col-span-2 space-y-4">
            <InsightFeed />
          </div>

          {/* Right column — SubscriptionRadar + PositiveStreak + MonthComparison */}
          <div className="space-y-4">
            <SubscriptionRadar subscriptions={data?.subscriptions ?? []} loading={loading} />
            <PositiveStreak velocity={data?.velocity ?? null} />
            <MonthComparison />
          </div>
        </div>

        {/* Category Breakdown — full width */}
        <CategoryBreakdown categories={data?.categories ?? []} loading={loading} />
      </main>

      <footer className="border-t border-white/[0.06] mt-12 py-6 text-center text-xs text-zinc-700">
        Pulse — AI Ekonomiassistent
      </footer>
    </div>
  )
}
