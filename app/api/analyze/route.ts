import { NextRequest, NextResponse } from 'next/server'
import { updateBaseline } from '@/lib/baseline'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'
import { generateAdvice } from '@/lib/advisor'
import { detectSubscriptions } from '@/lib/subscriptions'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canCallAI, recordAICall } from '@/lib/ai-budget'

async function getMonthSummary(userId: string) {
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [incomeRows, expenseRows, recentTransactions, uncategorizedCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, date: { gte: startOfMonth }, isIncome: true, NOT: { category: 'återbetalning' } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: startOfMonth }, isIncome: false, NOT: { category: 'utlägg' } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth } },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, date: true, merchant: true, amount: true, category: true, isIncome: true },
    }),
    prisma.transaction.count({
      where: { userId, date: { gte: startOfMonth }, OR: [{ category: null }, { category: 'övrigt' }], isIncome: false },
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

const INSIGHT_COOLDOWN_HOURS = 8

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    updateBaseline(userId).catch((err) => console.error('Baseline update failed:', err))

    const [velocity, categories, subscriptions, summary] = await Promise.all([
      calculateVelocity(userId),
      getCategoryBreakdown(userId),
      detectSubscriptions(userId),
      getMonthSummary(userId),
    ])

    const cooldownTime = new Date(Date.now() - INSIGHT_COOLDOWN_HOURS * 60 * 60 * 1000)
    Promise.all([
      prisma.insight.findFirst({
        where: { userId, type: { notIn: ['heartbeat-ping', 'claude-call'] }, sentAt: { gte: cooldownTime } },
        orderBy: { sentAt: 'desc' },
      }),
      canCallAI(userId),
    ]).then(async ([recentInsight, aiAllowed]) => {
      if (!recentInsight && aiAllowed) {
        try {
          // Timeout wrapper — don't let a slow Claude call hang on serverless
          const advice = await Promise.race([
            generateAdvice(velocity, categories, userId),
            new Promise<null>(res => setTimeout(() => res(null), 8000)),
          ])
          if (advice) {
            // Record AFTER success so quota isn't wasted on failures
            await recordAICall(userId)
            await prisma.insight.create({
              data: {
                userId,
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
