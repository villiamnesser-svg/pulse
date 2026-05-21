import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Categories to exclude from savings calculation (pass-through)
const PASS_THROUGH_CATS = new Set(['utlägg', 'återbetalning'])

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const now = new Date()

    // Compute avg monthly savings over last 3 months for monthsToGo calculation
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const recentTxs = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo, lt: now },
        NOT: { category: { in: [...PASS_THROUGH_CATS] } },
      },
      select: { amount: true, isIncome: true, date: true },
    })

    // Group recent transactions by month to compute monthly savings
    const monthlyMap = new Map<string, { income: number; expenses: number }>()
    for (const tx of recentTxs) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const entry = monthlyMap.get(key) ?? { income: 0, expenses: 0 }
      if (tx.isIncome) {
        entry.income += tx.amount
      } else {
        entry.expenses += Math.abs(tx.amount)
      }
      monthlyMap.set(key, entry)
    }

    const monthlyNetValues = Array.from(monthlyMap.values()).map(
      m => m.income - m.expenses
    )
    const avgMonthlySavings =
      monthlyNetValues.length > 0
        ? monthlyNetValues.reduce((s, v) => s + v, 0) / monthlyNetValues.length
        : 0

    // For each goal compute savedAmount from goal.createdAt to now
    const goalsWithProgress = await Promise.all(
      goals.map(async goal => {
        const txsSinceCreated = await prisma.transaction.findMany({
          where: {
            userId,
            date: { gte: goal.createdAt, lte: now },
            NOT: { category: { in: [...PASS_THROUGH_CATS] } },
          },
          select: { amount: true, isIncome: true },
        })

        let savedAmount = 0
        for (const tx of txsSinceCreated) {
          if (tx.isIncome) {
            savedAmount += tx.amount
          } else {
            savedAmount -= Math.abs(tx.amount)
          }
        }

        const remaining = Math.max(0, goal.targetAmount - savedAmount)
        let monthsToGo: number | null = null
        if (avgMonthlySavings > 0 && savedAmount < goal.targetAmount) {
          monthsToGo = Math.ceil(remaining / avgMonthlySavings)
        }

        return {
          id: goal.id,
          name: goal.name,
          emoji: goal.emoji,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate?.toISOString() ?? null,
          createdAt: goal.createdAt.toISOString(),
          savedAmount: Math.max(0, savedAmount),
          monthsToGo,
        }
      })
    )

    return NextResponse.json(goalsWithProgress)
  } catch (err) {
    console.error('Goals GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const body = (await req.json()) as {
      name: string
      emoji?: string
      targetAmount: number
      targetDate?: string
    }

    if (!body.name || !body.targetAmount || body.targetAmount <= 0) {
      return NextResponse.json({ error: 'Ogiltigt mål' }, { status: 400 })
    }

    const goal = await prisma.savingsGoal.create({
      data: {
        userId,
        name: body.name,
        emoji: body.emoji ?? '🎯',
        targetAmount: body.targetAmount,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
      },
    })

    return NextResponse.json(goal, { status: 201 })
  } catch (err) {
    console.error('Goals POST error:', err)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    await prisma.savingsGoal.deleteMany({ where: { id, userId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Goals DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
