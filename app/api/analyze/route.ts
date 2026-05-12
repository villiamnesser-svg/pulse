import { NextResponse } from 'next/server'
import { updateBaseline } from '@/lib/baseline'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'
import { generateAdvice } from '@/lib/advisor'
import { detectSubscriptions } from '@/lib/subscriptions'
import { prisma } from '@/lib/db'

async function getMonthSummary() {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [incomeRows, expenseRows, recentTransactions, uncategorizedCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { date: { gte: startOfMonth }, isIncome: true },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { date: { gte: startOfMonth }, isIncome: false },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { date: { gte: startOfMonth } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, date: true, merchant: true, amount: true, category: true, isIncome: true },
    }),
    prisma.transaction.count({
      where: {
        OR: [{ category: null }, { category: 'övrigt' }],
        isIncome: false,
      },
    }),
  ])

  const totalIncome = incomeRows._sum.amount ?? 0
  const totalExpenses = Math.abs(expenseRows._sum.amount ?? 0)

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    incomeCount: incomeRows._count,
    expenseCount: expenseRows._count,
    recentTransactions,
    uncategorizedCount,
  }
}

const INSIGHT_COOLDOWN_HOURS = 4

export async function GET() {
  try {
    // Baseline update is heavy — run in background, don't block the response
    updateBaseline().catch(() => {})

    const [velocity, categories, subscriptions, summary] = await Promise.all([
      calculateVelocity(),
      getCategoryBreakdown(),
      detectSubscriptions(),
      getMonthSummary(),
    ])

    // Generate AI insight in the background — don't block the response
    const cooldownTime = new Date(Date.now() - INSIGHT_COOLDOWN_HOURS * 60 * 60 * 1000)
    prisma.insight.findFirst({
      where: { sentAt: { gte: cooldownTime } },
      orderBy: { sentAt: 'desc' },
    }).then(async (recentInsight) => {
      if (!recentInsight) {
        try {
          const advice = await generateAdvice(velocity, categories)
          if (advice) {
            await prisma.insight.create({
              data: {
                type: velocity.level === 'SAFE' ? 'positive' : 'velocity',
                message: advice,
                data: JSON.stringify({ level: velocity.level }),
              },
            })
          }
        } catch (err) {
          console.error('Background advice generation failed:', err)
        }
      }
    }).catch(() => {})

    return NextResponse.json({ velocity, categories, subscriptions, summary })
  } catch (err) {
    console.error('Analysis error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
