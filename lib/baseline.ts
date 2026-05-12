import { prisma } from './db'
import type { Baseline } from '@prisma/client'

export { Baseline }

export async function updateBaseline(): Promise<void> {
  const transactions = await prisma.transaction.findMany({
    where: { isIncome: false },
    orderBy: { date: 'asc' },
  })

  if (transactions.length === 0) return

  // Group by category
  const categoryData: Record<
    string,
    { weekly: number[]; monthly: number[]; byWeekday: Record<number, number[]> }
  > = {}

  for (const tx of transactions) {
    const cat = tx.category ?? 'övrigt'
    if (!categoryData[cat]) {
      categoryData[cat] = { weekly: [], monthly: [], byWeekday: {} }
    }

    // Weekday 0=Monday...6=Sunday
    const jsDay = tx.date.getDay() // 0=Sunday
    const weekday = jsDay === 0 ? 6 : jsDay - 1

    if (!categoryData[cat].byWeekday[weekday]) {
      categoryData[cat].byWeekday[weekday] = []
    }
    categoryData[cat].byWeekday[weekday].push(Math.abs(tx.amount))
  }

  // Calculate weekly and monthly averages by grouping transactions into weeks/months
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
    monthlyByCategory[cat][monthKey] =
      (monthlyByCategory[cat][monthKey] ?? 0) + Math.abs(tx.amount)
  }

  for (const [cat, data] of Object.entries(categoryData)) {
    const weeklyValues = Object.values(weeklyByCategory[cat] ?? {})
    const monthlyValues = Object.values(monthlyByCategory[cat] ?? {})

    const weeklyAvg =
      weeklyValues.length > 0
        ? weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length
        : 0

    const monthlyAvg =
      monthlyValues.length > 0
        ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length
        : 0

    // byWeekday: average spend per weekday
    const byWeekday: Record<number, number> = {}
    for (const [day, amounts] of Object.entries(data.byWeekday)) {
      byWeekday[Number(day)] = amounts.reduce((a, b) => a + b, 0) / amounts.length
    }

    await prisma.baseline.upsert({
      where: { category: cat },
      update: {
        weeklyAvg,
        monthlyAvg,
        byWeekday: JSON.stringify(byWeekday),
      },
      create: {
        category: cat,
        weeklyAvg,
        monthlyAvg,
        byWeekday: JSON.stringify(byWeekday),
      },
    })
  }
}

export async function getBaseline(): Promise<Baseline[]> {
  return prisma.baseline.findMany()
}

export function hasEnoughData(baselines: Baseline[]): boolean {
  // Check if we have at least 4 weeks of data
  // This is a heuristic — if monthly avg is significantly set we assume enough data
  return baselines.length > 0 && baselines.some((b) => b.monthlyAvg > 0)
}
