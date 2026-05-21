import { prisma } from './db'
import type { Baseline } from '@prisma/client'

export { Baseline }

export async function updateBaseline(userId = 'local'): Promise<void> {
  const transactions = await prisma.transaction.findMany({
    where: { userId, isIncome: false, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
    orderBy: { date: 'asc' },
  })

  if (transactions.length === 0) return

  const categoryData: Record<
    string,
    { weekly: number[]; monthly: number[]; byWeekday: Record<number, number[]> }
  > = {}

  for (const tx of transactions) {
    const cat = tx.category ?? 'övrigt'
    if (!categoryData[cat]) {
      categoryData[cat] = { weekly: [], monthly: [], byWeekday: {} }
    }
    const jsDay = tx.date.getDay()
    const weekday = jsDay === 0 ? 6 : jsDay - 1
    if (!categoryData[cat].byWeekday[weekday]) {
      categoryData[cat].byWeekday[weekday] = []
    }
    categoryData[cat].byWeekday[weekday].push(Math.abs(tx.amount))
  }

  const weeklyByCategory: Record<string, Record<string, number>> = {}
  const monthlyByCategory: Record<string, Record<string, number>> = {}

  for (const tx of transactions) {
    const cat = tx.category ?? 'övrigt'
    const d = tx.date
    const weekKey = `${d.getFullYear()}-W${Math.floor(d.getDate() / 7)}`
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`
    if (!weeklyByCategory[cat]) weeklyByCategory[cat] = {}
    if (!monthlyByCategory[cat]) monthlyByCategory[cat] = {}
    weeklyByCategory[cat][weekKey] = (weeklyByCategory[cat][weekKey] ?? 0) + Math.abs(tx.amount)
    monthlyByCategory[cat][monthKey] = (monthlyByCategory[cat][monthKey] ?? 0) + Math.abs(tx.amount)
  }

  for (const [cat, data] of Object.entries(categoryData)) {
    if (cat === 'utlägg' || cat === 'återbetalning') continue
    const weeklyValues = Object.values(weeklyByCategory[cat] ?? {})
    const monthlyValues = Object.values(monthlyByCategory[cat] ?? {})

    const weeklyAvg = weeklyValues.length > 0
      ? weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length : 0
    const monthlyAvg = monthlyValues.length > 0
      ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length : 0

    const byWeekday: Record<number, number> = {}
    for (const [day, amounts] of Object.entries(data.byWeekday)) {
      byWeekday[Number(day)] = amounts.reduce((a, b) => a + b, 0) / amounts.length
    }

    await prisma.baseline.upsert({
      where: { userId_category: { userId, category: cat } },
      update: { weeklyAvg, monthlyAvg, byWeekday: JSON.stringify(byWeekday) },
      create: { userId, category: cat, weeklyAvg, monthlyAvg, byWeekday: JSON.stringify(byWeekday) },
    })
  }
}

export async function getBaseline(userId = 'local'): Promise<Baseline[]> {
  return prisma.baseline.findMany({ where: { userId } })
}

export function hasEnoughData(baselines: Baseline[]): boolean {
  return baselines.length > 0 && baselines.some((b) => b.monthlyAvg > 0)
}
