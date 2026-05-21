import { prisma } from './db'

export interface HabitInsight {
  type: 'spike' | 'habit' | 'streak'
  title: string
  body: string
  priority: number
}

async function detectCategorySpikes(userId: string): Promise<HabitInsight[]> {
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  thisWeekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const lastWeekEnd = new Date(thisWeekStart)

  const [thisWeek, lastWeek] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, isIncome: false, date: { gte: thisWeekStart }, category: { not: null } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, isIncome: false, date: { gte: lastWeekStart, lt: lastWeekEnd }, category: { not: null } },
      _sum: { amount: true },
    }),
  ])

  const lastWeekMap = new Map(lastWeek.map(r => [r.category, Math.abs(r._sum.amount ?? 0)]))
  const insights: HabitInsight[] = []

  for (const row of thisWeek) {
    const cat = row.category!
    if (cat === 'hyra' || cat === 'inkomst') continue
    const thisAmt = Math.abs(row._sum.amount ?? 0)
    const lastAmt = lastWeekMap.get(cat) ?? 0
    if (thisAmt < 200) continue
    if (lastAmt === 0 && thisAmt > 500) {
      insights.push({ type: 'spike', title: `Ny kategori denna vecka: ${cat}`,
        body: `Du har lagt ${thisAmt.toLocaleString('sv-SE')} kr på ${cat} den här veckan — inget förra veckan.`, priority: 6 })
    } else if (lastAmt > 0 && thisAmt > lastAmt * 2 && thisAmt > 300) {
      const mult = Math.round((thisAmt / lastAmt) * 10) / 10
      insights.push({ type: 'spike', title: `${cat} spike`,
        body: `${cap(cat)} den här veckan: ${thisAmt.toLocaleString('sv-SE')} kr — ${mult}x mer än förra veckan (${lastAmt.toLocaleString('sv-SE')} kr).`, priority: 7 })
    }
  }
  return insights
}

async function detectMissingMerchants(userId: string): Promise<HabitInsight[]> {
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const regularMerchants = await prisma.transaction.groupBy({
    by: ['merchant'],
    where: { userId, isIncome: false, date: { gte: since90 } },
    _count: { merchant: true },
    having: { merchant: { _count: { gte: 4 } } },
  })

  const insights: HabitInsight[] = []
  for (const row of regularMerchants.slice(0, 5)) {
    const merchant = row.merchant
    const lastVisit = await prisma.transaction.findFirst({
      where: { userId, merchant, isIncome: false },
      orderBy: { date: 'desc' },
      select: { date: true },
    })
    if (!lastVisit) continue
    const daysSince = Math.floor((Date.now() - lastVisit.date.getTime()) / (1000 * 60 * 60 * 24))
    const freq = row._count.merchant
    const expectedDaysBetween = Math.floor(90 / freq)
    if (daysSince > expectedDaysBetween * 2 && daysSince >= 10 && lastVisit.date < since14) {
      insights.push({ type: 'habit', title: `Länge sedan ${merchant}`,
        body: `Du brukar handla på ${merchant} var ${expectedDaysBetween}:e dag — det är ${daysSince} dagar sedan sist. Allt okej?`, priority: 4 })
    }
  }
  return insights
}

async function detectNoSpendStreak(userId: string): Promise<HabitInsight | null> {
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentTx = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: since7 } },
    select: { date: true },
    orderBy: { date: 'desc' },
  })
  if (recentTx.length === 0) return null
  const today = new Date()
  today.setHours(23, 59, 59, 0)
  const daysSinceLast = Math.floor((today.getTime() - recentTx[0].date.getTime()) / (1000 * 60 * 60 * 24))
  if (daysSinceLast >= 2) {
    return { type: 'streak', title: 'Ingen utgift',
      body: `${daysSinceLast} dagar utan ett enda köp. Ovanligt för dig — och ganska bra.`, priority: 3 }
  }
  return null
}

export async function analyzeNewTransactions(
  newTxs: { merchant: string; amount: number; category: string | null; isIncome: boolean }[],
  userId = 'local'
): Promise<string | null> {
  const expenses = newTxs.filter(t => !t.isIncome)
  if (expenses.length === 0) return null

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const candidates: { msg: string; score: number }[] = []

  for (const tx of expenses) {
    const amount = Math.abs(tx.amount)
    if (amount < 100) continue
    const history = await prisma.transaction.findMany({
      where: { userId, merchant: tx.merchant, isIncome: false, date: { gte: since90 } },
      select: { amount: true },
    })
    if (history.length === 0 && amount >= 300) {
      candidates.push({ msg: `Nytt ställe: ${tx.merchant} för ${amount.toLocaleString('sv-SE')} kr. Aldrig handlat där innan.`, score: 8 + Math.min(amount / 1000, 4) })
      continue
    }
    if (history.length >= 2) {
      const avg = history.reduce((s, t) => s + Math.abs(t.amount), 0) / history.length
      if (amount > avg * 2 && amount > 300) {
        const mult = Math.round((amount / avg) * 10) / 10
        candidates.push({ msg: `${tx.merchant}: ${amount.toLocaleString('sv-SE')} kr — ${mult}x ditt snitt på ${Math.round(avg).toLocaleString('sv-SE')} kr där.`, score: 6 + Math.min(mult, 5) })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.msg ?? null
}

export async function detectHabitInsights(userId = 'local'): Promise<HabitInsight[]> {
  const [spikes, missing, streak] = await Promise.all([
    detectCategorySpikes(userId),
    detectMissingMerchants(userId),
    detectNoSpendStreak(userId),
  ])
  return [...spikes, ...missing, ...(streak ? [streak] : [])].sort((a, b) => b.priority - a.priority)
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
