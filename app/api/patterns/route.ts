import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

const DAY_NAMES_SV = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']

export interface WeekdayPattern {
  day: number
  dayName: string
  avgAmount: number
  txCount: number
  topCategory: string | null
  isHighest: boolean
  multiplierVsOthers: number
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const transactions = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: since } },
    select: { date: true, amount: true, category: true },
  })

  if (transactions.length < 20) return NextResponse.json([])

  const byDay: Map<number, { total: number; count: number; categories: Map<string, number> }> = new Map()
  for (let i = 0; i < 7; i++) byDay.set(i, { total: 0, count: 0, categories: new Map() })

  const weekdayCounts = new Array(7).fill(0)
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    weekdayCounts[d.getDay()]++
  }

  for (const tx of transactions) {
    const wd = tx.date.getDay()
    const entry = byDay.get(wd)!
    entry.total += Math.abs(tx.amount)
    entry.count++
    const cat = tx.category ?? 'övrigt'
    entry.categories.set(cat, (entry.categories.get(cat) ?? 0) + 1)
  }

  const patterns: WeekdayPattern[] = []
  for (const [day, data] of byDay.entries()) {
    const dayCount = weekdayCounts[day] || 1
    const avgAmount = data.total / dayCount
    let topCategory: string | null = null
    let topCount = 0
    for (const [cat, count] of data.categories.entries()) {
      if (count > topCount) { topCount = count; topCategory = cat }
    }
    patterns.push({ day, dayName: DAY_NAMES_SV[day], avgAmount: Math.round(avgAmount),
      txCount: Math.round(data.count / dayCount * 10) / 10, topCategory, isHighest: false, multiplierVsOthers: 0 })
  }

  const weekdaysOnly = patterns.filter(p => p.day >= 1 && p.day <= 5)
  const maxWd = Math.max(...weekdaysOnly.map(p => p.avgAmount))
  const avgExcludingHighest = weekdaysOnly.filter(p => p.avgAmount < maxWd)
    .reduce((s, p) => s + p.avgAmount, 0) / Math.max(weekdaysOnly.filter(p => p.avgAmount < maxWd).length, 1)

  for (const p of patterns) {
    p.isHighest = p.avgAmount === maxWd && p.day >= 1 && p.day <= 5
    p.multiplierVsOthers = avgExcludingHighest > 0 ? Math.round((p.avgAmount / avgExcludingHighest) * 10) / 10 : 1
  }

  patterns.sort((a, b) => { const order = [1, 2, 3, 4, 5, 6, 0]; return order.indexOf(a.day) - order.indexOf(b.day) })
  return NextResponse.json(patterns)
}
