import { prisma } from './db'
import { getBaseline } from './baseline'

export type VelocityLevel = 'SAFE' | 'WARNING' | 'CRITICAL'

export interface VelocityResult {
  level: VelocityLevel
  projectedMonthTotal: number
  baselineMonthly: number
  currentSpend: number
  daysElapsed: number
  daysInMonth: number
  daysUntilPayday: number
  dailyBudgetRemaining: number
  currentBalance: number
  message: string
}

export interface CategoryBreakdown {
  category: string
  amount: number
  baseline: number
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getDaysUntilPayday(today: Date, paydayDay: number): number {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), paydayDay)
  if (thisMonth > today) {
    return Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, paydayDay)
  return Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export async function calculateVelocity(userId = 'local'): Promise<VelocityResult> {
  const profile = await prisma.userProfile.findFirst({ where: { userId } })

  const PAYDAY_DAY = profile?.paydayDay ?? parseInt(process.env.PAYDAY_DAY ?? '25', 10)
  const MONTHLY_RENT = profile?.monthlyRent ?? parseFloat(process.env.MONTHLY_RENT ?? '8500')
  const CRITICAL_BUFFER = profile?.criticalBuffer ?? parseFloat(process.env.CRITICAL_BUFFER ?? '5000')
  const WARNING_THRESHOLD = profile?.warningThreshold ?? parseFloat(process.env.WARNING_THRESHOLD ?? '1.25')

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const startOfMonth = new Date(year, month, 1)
  const daysInMonth = getDaysInMonth(year, month)
  const daysElapsed = Math.max(today.getDate(), 1)
  const daysUntilPayday = getDaysUntilPayday(today, PAYDAY_DAY)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: startOfMonth }, isIncome: false, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
  })

  const currentSpend = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const dailyRate = currentSpend / daysElapsed
  const projectedMonthTotal = dailyRate * daysInMonth

  const latestTx = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { date: 'desc' },
  })
  const currentBalance = latestTx?.balance ?? 0

  const baselines = await getBaseline(userId)
  const baselineMonthly = baselines.reduce((sum, b) => sum + b.monthlyAvg, 0)

  const daysRemaining = daysInMonth - daysElapsed
  const budgetLeft = currentBalance - MONTHLY_RENT - CRITICAL_BUFFER
  const dailyBudgetRemaining = daysRemaining > 0 ? budgetLeft / daysRemaining : 0

  let level: VelocityLevel = 'SAFE'
  if (currentBalance < CRITICAL_BUFFER || dailyBudgetRemaining < 200) {
    level = 'CRITICAL'
  } else if (projectedMonthTotal > baselineMonthly * WARNING_THRESHOLD) {
    level = 'WARNING'
  } else if (projectedMonthTotal > baselineMonthly * 1.1) {
    level = 'WARNING'
  }

  const monthNames = [
    'januari', 'februari', 'mars', 'april', 'maj', 'juni',
    'juli', 'augusti', 'september', 'oktober', 'november', 'december',
  ]
  const monthName = monthNames[month]
  const projFmt = Math.round(projectedMonthTotal).toLocaleString('sv-SE')
  const baseFmt = Math.round(baselineMonthly).toLocaleString('sv-SE')
  const budgetFmt = Math.round(dailyBudgetRemaining).toLocaleString('sv-SE')

  let message: string
  if (level === 'SAFE') {
    if (projectedMonthTotal < baselineMonthly * 0.9) {
      message = `Bra takt — du är på väg mot ${projFmt} kr i ${monthName}. Det är ${Math.round(baselineMonthly - projectedMonthTotal).toLocaleString('sv-SE')} kr under ditt snitt. Fortsätt så.`
    } else {
      message = `Du är på väg mot ${projFmt} kr den här månaden. Ditt snitt är ${baseFmt} kr — bra kontroll.`
    }
  } else if (level === 'WARNING') {
    message = `Du är på väg mot ${projFmt} kr den här månaden. Ditt snitt är ${baseFmt} kr. Bromsa lite den här veckan.`
  } else {
    message = `Om du fortsätter i den här takten har du ${budgetFmt} kr/dag kvar till löning den ${PAYDAY_DAY}:e. Lite tight.`
  }

  return {
    level, projectedMonthTotal, baselineMonthly, currentSpend,
    daysElapsed, daysInMonth, daysUntilPayday, dailyBudgetRemaining, currentBalance, message,
  }
}

export async function getCategoryBreakdown(userId = 'local'): Promise<CategoryBreakdown[]> {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: startOfMonth }, isIncome: false, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
  })

  const baselines = await getBaseline(userId)
  const baselineMap = new Map(baselines.map((b) => [b.category, b.monthlyAvg]))

  const categoryTotals = new Map<string, number>()
  for (const tx of transactions) {
    const cat = tx.category ?? 'övrigt'
    categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + Math.abs(tx.amount))
  }

  return Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      baseline: baselineMap.get(category) ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}
