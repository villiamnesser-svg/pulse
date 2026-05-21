'use client'

import { useState, useEffect } from 'react'
import { Zap, TrendingUp, AlertTriangle, CreditCard, Calendar, Lightbulb, Inbox, ShieldAlert, BarChart2, Flame, Eye } from 'lucide-react'
import type { WeekdayPattern } from '@/app/api/patterns/route'

interface Insight {
  id: string
  type: string
  message: string
  data: string | null
  read: boolean
  sentAt: string
}

const TYPE_CONFIG: Record<string, { Icon: React.ElementType; iconBg: string; iconColor: string }> = {
  velocity:     { Icon: Zap,         iconBg: 'bg-emerald-950/60', iconColor: 'text-emerald-400' },
  positive:     { Icon: TrendingUp,  iconBg: 'bg-emerald-950/60', iconColor: 'text-emerald-400' },
  insight:      { Icon: Lightbulb,   iconBg: 'bg-zinc-800',       iconColor: 'text-zinc-400' },
  alert:        { Icon: AlertTriangle, iconBg: 'bg-amber-950/60', iconColor: 'text-amber-400' },
  subscription: { Icon: CreditCard,  iconBg: 'bg-purple-950/60',  iconColor: 'text-purple-400' },
  seasonal:     { Icon: Calendar,    iconBg: 'bg-blue-950/60',    iconColor: 'text-blue-400' },
  anomaly:      { Icon: ShieldAlert, iconBg: 'bg-red-950/60',     iconColor: 'text-red-400' },
  pattern:      { Icon: BarChart2,   iconBg: 'bg-indigo-950/60',  iconColor: 'text-indigo-400' },
  spike:        { Icon: Flame,       iconBg: 'bg-orange-950/60',  iconColor: 'text-orange-400' },
  habit:        { Icon: Eye,         iconBg: 'bg-sky-950/60',     iconColor: 'text-sky-400' },
  streak:       { Icon: TrendingUp,  iconBg: 'bg-emerald-950/60', iconColor: 'text-emerald-400' },
}
const DEFAULT_CONFIG = { Icon: Lightbulb, iconBg: 'bg-zinc-800', iconColor: 'text-zinc-400' }

const PRIORITY_ORDER = ['anomaly', 'spike', 'velocity', 'alert', 'subscription', 'habit', 'pattern', 'streak', 'positive', 'insight', 'seasonal']

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d sedan`
  if (hours > 0) return `${hours}h sedan`
  if (mins > 0) return `${mins}min sedan`
  return 'nyss'
}

const DAY_NAMES_SHORT = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör']

function WeekdayPatternCard({ patterns }: { patterns: WeekdayPattern[] }) {
  const max = Math.max(...patterns.map(p => p.avgAmount), 1)
  // Reorder Mon–Sun
  const ordered = [...patterns].sort((a, b) => {
    const o = [1, 2, 3, 4, 5, 6, 0]
    return o.indexOf(a.day) - o.indexOf(b.day)
  })

  return (
    <div className="mt-3 space-y-1">
      {ordered.map(p => (
        <div key={p.day} className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-8 shrink-0">{DAY_NAMES_SHORT[p.day]}</span>
          <div className="flex-1 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${p.isHighest ? 'bg-amber-500' : 'bg-indigo-500/60'}`}
              style={{ width: `${(p.avgAmount / max) * 100}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium w-16 text-right shrink-0 ${p.isHighest ? 'text-amber-400' : 'text-zinc-500'}`}>
            {p.avgAmount.toLocaleString('sv-SE')} kr
          </span>
        </div>
      ))}
    </div>
  )
}

export default function InsightFeed() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [patterns, setPatterns] = useState<WeekdayPattern[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchAll()
  }, [])

  async function fetchAll() {
    try {
      // Fetch both in parallel and wait for both before clearing loading state
      const [insightRes, patternRes] = await Promise.all([
        fetch('/api/insights'),
        fetch('/api/patterns').catch(() => null),
      ])
      if (insightRes.ok) {
        const data = (await insightRes.json()) as Insight[]
        const sorted = [...data].sort((a, b) => {
          const ap = PRIORITY_ORDER.indexOf(a.type)
          const bp = PRIORITY_ORDER.indexOf(b.type)
          if (ap !== bp) return (ap === -1 ? 99 : ap) - (bp === -1 ? 99 : bp)
          return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
        })
        setInsights(sorted)
      }
      if (patternRes?.ok) {
        setPatterns((await patternRes.json()) as WeekdayPattern[])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id: string) {
    try {
      // Server-first: update DB before updating UI to avoid ghost read state
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed')
      setInsights(prev => prev.map(ins => ins.id === id ? { ...ins, read: true } : ins))
    } catch (err) { console.error(err) }
  }

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
        <div className="h-3 bg-[#161616] rounded w-16 mb-4" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3 mb-3 animate-pulse">
            <div className="w-8 h-8 bg-[#161616] rounded-lg flex-shrink-0" />
            <div className="flex-1">
              <div className="h-3 bg-[#161616] rounded w-full mb-2" />
              <div className="h-3 bg-[#161616] rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Show pattern insight if clear Friday/heavy day found
  const highestDay = patterns.find(p => p.isHighest)
  const showPatternCard = highestDay && highestDay.multiplierVsOthers >= 1.5

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-4">
        Insikter
      </h3>

      {insights.length === 0 && !showPatternCard ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Inbox className="w-8 h-8 text-zinc-700" />
          <p className="text-zinc-500 text-sm text-center">
            Inga insikter än — ladda upp transaktioner för att börja.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {/* Weekday pattern card */}
          {showPatternCard && patterns.length > 0 && (
            <li className="p-4 rounded-xl bg-[#0f0f0f] border border-white/[0.10]">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-950/60">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    <span className="font-semibold text-white">{highestDay.dayName}ar</span> är din dyraste dag —{' '}
                    <span className="text-amber-400 font-semibold">{highestDay.avgAmount.toLocaleString('sv-SE')} kr</span> i snitt,{' '}
                    {highestDay.multiplierVsOthers}x mer än andra dagar.
                    {highestDay.topCategory && (
                      <> Domineras av <span className="text-zinc-300">{highestDay.topCategory}</span>.</>
                    )}
                  </p>
                  <WeekdayPatternCard patterns={patterns} />
                </div>
              </div>
            </li>
          )}

          {insights.map(insight => {
            const cfg = TYPE_CONFIG[insight.type] ?? DEFAULT_CONFIG
            const { Icon } = cfg

            return (
              <li
                key={insight.id}
                onClick={() => !insight.read && markRead(insight.id)}
                className={`flex gap-3 p-4 rounded-xl transition-all cursor-pointer border ${
                  insight.read
                    ? 'opacity-40 border-transparent bg-transparent'
                    : 'bg-[#0f0f0f] border-white/[0.10] hover:border-white/[0.14]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                  <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-relaxed">{insight.message}</p>
                  <p className="text-xs text-zinc-600 mt-1">{timeAgo(insight.sentAt)}</p>
                </div>
                {!insight.read && (
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                    insight.type === 'anomaly' ? 'bg-red-400' : 'bg-emerald-400'
                  }`} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
