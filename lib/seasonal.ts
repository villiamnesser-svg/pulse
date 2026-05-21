import { prisma } from './db'

const MONTH_NAMES = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

export async function storeMonthlySnapshot(year: number, month: number, userId = 'local'): Promise<void> {
  const startOfMonth = new Date(year, month, 1)
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: startOfMonth, lte: endOfMonth }, isIncome: false },
  })

  const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const byCategory: Record<string, number> = {}
  for (const tx of transactions) {
    const cat = tx.category ?? 'övrigt'
    byCategory[cat] = (byCategory[cat] ?? 0) + Math.abs(tx.amount)
  }

  const monthName = MONTH_NAMES[month]

  await prisma.seasonalMemory.upsert({
    where: { userId_year_month: { userId, year, month: monthName } },
    update: { total, byCategory: JSON.stringify(byCategory) },
    create: { userId, year, month: monthName, total, byCategory: JSON.stringify(byCategory) },
  })
}

export async function checkSeasonalMemory(userId = 'local'): Promise<string | null> {
  const today = new Date()
  const currentMonth = today.getMonth()
  const lastYear = today.getFullYear() - 1
  const monthName = MONTH_NAMES[currentMonth]

  const lastYearRecord = await prisma.seasonalMemory.findUnique({
    where: { userId_year_month: { userId, year: lastYear, month: monthName } },
  })
  if (!lastYearRecord) return null

  const allRecords = await prisma.seasonalMemory.findMany({ where: { userId } })
  if (allRecords.length < 2) return null

  const avgTotal = allRecords.reduce((sum, r) => sum + r.total, 0) / allRecords.length
  const ratio = lastYearRecord.total / avgTotal

  if (ratio > 1.2) {
    return `Förra ${monthName} spenderade du ${Math.round(lastYearRecord.total).toLocaleString('sv-SE')} kr — ${Math.round((ratio - 1) * 100)}% mer än ditt snitt. Håll koll så att det inte händer igen.`
  }
  if (ratio < 0.8) {
    return `Förra ${monthName} var du extra sparsam — bara ${Math.round(lastYearRecord.total).toLocaleString('sv-SE')} kr. Bra jobbat förra året!`
  }
  return null
}
