import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { detectSubscriptions } from '@/lib/subscriptions'

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const profile = await prisma.userProfile.findFirst({ where: { userId } })

    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    const [incomeAgg, expenseAgg, lastTx, subscriptions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, date: { gte: startOfMonth }, isIncome: true, NOT: { category: 'återbetalning' } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, date: { gte: startOfMonth }, isIncome: false, NOT: { category: 'utlägg' } },
        _sum: { amount: true },
      }),
      prisma.transaction.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { balance: true },
      }),
      detectSubscriptions(userId).catch(() => [] as { amount: number }[]),
    ])

    const totalIncome = incomeAgg._sum.amount ?? 0
    const totalExpenses = Math.abs(expenseAgg._sum.amount ?? 0)
    const netSavings = totalIncome - totalExpenses
    const currentBalance = lastTx?.balance ?? 0

    // Monthly subscription total
    const monthlySubscriptions = subscriptions.reduce((s, sub) => s + sub.amount, 0)

    // Get avg daily spend from last 30 days
    const since30 = new Date()
    since30.setDate(since30.getDate() - 30)
    const recentExpenses = await prisma.transaction.aggregate({
      where: { userId, date: { gte: since30 }, isIncome: false, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
      _sum: { amount: true },
    })
    const avgDailySpend = Math.abs(recentExpenses._sum.amount ?? 0) / 30
    const cashCushionDays = avgDailySpend > 0 ? Math.round(currentBalance / avgDailySpend) : 0

    // ── Compute sub-scores (each 0–100) ──

    // 1. Savings rate: ideal = 20%+ of income
    const savingsRateRaw = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0
    // 20%+ → 100, 10% → 70, 0% → 40, negative → 0
    const savingsRate = savingsRateRaw >= 20
      ? 100
      : savingsRateRaw >= 0
        ? clamp(40 + (savingsRateRaw / 20) * 60)
        : clamp(40 + (savingsRateRaw / 20) * 40)

    // 2. Budget adherence: compare this month's spend to user's savingsTarget + baseline
    const savingsTarget = profile?.savingsTarget ?? 0
    const impliedBudget = totalIncome > 0 ? totalIncome - savingsTarget : totalExpenses
    const budgetAdherenceRaw = impliedBudget > 0 ? (totalExpenses / impliedBudget) : 1
    // 0.8 or less → 100 (under budget), 1.0 → 70, 1.3+ → 0
    const budgetAdherence = budgetAdherenceRaw <= 0.8
      ? 100
      : budgetAdherenceRaw <= 1.0
        ? clamp(70 + (1.0 - budgetAdherenceRaw) / 0.2 * 30)
        : clamp(70 - ((budgetAdherenceRaw - 1.0) / 0.3) * 70)

    // 3. Subscription ratio: < 5% = ideal, > 20% = bad
    const subscriptionRatioRaw = totalIncome > 0 ? (monthlySubscriptions / totalIncome) * 100 : 0
    const subscriptionRatio = subscriptionRatioRaw <= 5
      ? 100
      : subscriptionRatioRaw <= 10
        ? clamp(100 - ((subscriptionRatioRaw - 5) / 5) * 30)
        : subscriptionRatioRaw <= 20
          ? clamp(70 - ((subscriptionRatioRaw - 10) / 10) * 70)
          : 0

    // 4. Cash cushion: >30 days = ideal, <7 = critical
    const cashCushion = cashCushionDays >= 30
      ? 100
      : cashCushionDays >= 14
        ? clamp(70 + ((cashCushionDays - 14) / 16) * 30)
        : cashCushionDays >= 7
          ? clamp(30 + ((cashCushionDays - 7) / 7) * 40)
          : clamp(cashCushionDays / 7 * 30)

    // Weighted total: savings 30%, budget 30%, subscriptions 20%, cushion 20%
    const total = Math.round(
      savingsRate * 0.30 +
      budgetAdherence * 0.30 +
      subscriptionRatio * 0.20 +
      cashCushion * 0.20
    )

    return NextResponse.json({
      total: clamp(total),
      savingsRate: Math.round(clamp(savingsRate)),
      budgetAdherence: Math.round(clamp(budgetAdherence)),
      subscriptionRatio: Math.round(clamp(subscriptionRatio)),
      cashCushion: Math.round(clamp(cashCushion)),
      savingsRateRaw,
      subscriptionRatioRaw,
      cashCushionDays,
    })
  } catch (err) {
    console.error('Health score error:', err)
    return NextResponse.json({ error: 'Score failed' }, { status: 500 })
  }
}
