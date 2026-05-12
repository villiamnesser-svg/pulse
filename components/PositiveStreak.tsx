'use client'

import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { VelocityResult } from '@/lib/velocity'

interface PositiveStreakProps {
  velocity: VelocityResult | null
}

interface SeasonalRecord {
  year: number
  month: string
  total: number
}

function fmt(n: number) {
  return Math.round(Math.abs(n)).toLocaleString('sv-SE')
}

const MONTH_NAMES = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

export default function PositiveStreak({ velocity }: PositiveStreakProps) {
  const [seasonal, setSeasonal] = useState<SeasonalRecord[]>([])

  useEffect(() => {
    fetch('/api/seasonal')
      .then((r) => r.ok ? r.json() as Promise<SeasonalRecord[]> : Promise.resolve([]))
      .then(setSeasonal)
      .catch(() => {})
  }, [])

  if (!velocity) return null

  const weeklySpend = velocity.currentSpend / (velocity.daysElapsed / 7)
  const weeklyBaseline = velocity.baselineMonthly / 4.33
  const weeklySavings = weeklyBaseline - weeklySpend
  const goodWeek = weeklySavings > 100 && velocity.level === 'SAFE'

  // Year-over-year comparison for current month
  const currentMonthName = MONTH_NAMES[new Date().getMonth()]
  const thisYear = new Date().getFullYear()
  const lastYearRecord = seasonal.find((r) => r.year === thisYear - 1 && r.month === currentMonthName)
  const currentProjected = velocity.projectedMonthTotal

  const yoyDiff = lastYearRecord ? lastYearRecord.total - currentProjected : 0
  const yoyBetter = yoyDiff > 500

  // Year-to-date comparison
  const currentMonthIndex = new Date().getMonth()
  const thisYearMonths = seasonal.filter((r) => r.year === thisYear && MONTH_NAMES.indexOf(r.month) < currentMonthIndex)
  const lastYearMonths = seasonal.filter((r) => r.year === thisYear - 1 && MONTH_NAMES.indexOf(r.month) < currentMonthIndex)

  let ytdMessage: string | null = null
  if (thisYearMonths.length >= 2 && lastYearMonths.length >= 2) {
    const thisYearTotal = thisYearMonths.reduce((s, r) => s + r.total, 0)
    const lastYearTotal = lastYearMonths.reduce((s, r) => s + r.total, 0)
    const ytdSaved = lastYearTotal - thisYearTotal
    if (ytdSaved > 500) {
      ytdMessage = `Hittills i år har du spenderat ${fmt(ytdSaved)} kr mindre än samma period förra året.`
    }
  }

  const showCard = goodWeek || yoyBetter || ytdMessage !== null
  if (!showCard) return null

  return (
    <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-950/60 flex items-center justify-center">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-emerald-500/80">
          Bra jobbat
        </h3>
      </div>

      <div className="space-y-3">
        {goodWeek && (
          <div>
            <p className="text-sm text-emerald-100/80 leading-relaxed">
              Den här veckan spenderar du{' '}
              <span className="font-bold text-emerald-300">{fmt(weeklySavings)} kr mindre</span>{' '}
              än ditt veckosnitt.
            </p>
            <div className="mt-2 flex gap-4 text-xs text-emerald-700/80">
              <span>Denna vecka: <span className="text-emerald-400 font-medium">{fmt(weeklySpend)} kr</span></span>
              <span>Snitt: <span className="text-emerald-600">{fmt(weeklyBaseline)} kr</span></span>
            </div>
          </div>
        )}

        {yoyBetter && lastYearRecord && (
          <div className={goodWeek ? 'border-t border-emerald-500/10 pt-3' : ''}>
            <p className="text-sm text-emerald-100/80 leading-relaxed">
              Förra {currentMonthName} spenderade du{' '}
              <span className="font-bold text-emerald-300">{fmt(yoyDiff)} kr mer</span>{' '}
              än du är på väg att göra i år.
            </p>
          </div>
        )}

        {ytdMessage && (
          <div className={(goodWeek || yoyBetter) ? 'border-t border-emerald-500/10 pt-3' : ''}>
            <p className="text-sm text-emerald-100/80 leading-relaxed">{ytdMessage}</p>
          </div>
        )}
      </div>
    </div>
  )
}
