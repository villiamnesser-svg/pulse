import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1)

    // Get all expense transactions from last 12 months
    const txs = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: twelveMonthsAgo, lte: now },
        isIncome: false,
      },
      select: { merchant: true, amount: true, date: true },
      orderBy: { date: 'asc' },
    })

    // Group by merchant
    const merchantMap = new Map<
      string,
      { amounts: number[]; dates: Date[] }
    >()

    for (const tx of txs) {
      const key = tx.merchant
      const entry = merchantMap.get(key) ?? { amounts: [], dates: [] }
      entry.amounts.push(Math.abs(tx.amount))
      entry.dates.push(new Date(tx.date))
      merchantMap.set(key, entry)
    }

    interface Subscription {
      merchant: string
      amount: number
      lastCharged: string
      monthsDetected: number
      dayOfMonth: number
      annualCost: number
    }

    const subscriptions: Subscription[] = []

    for (const [merchant, data] of merchantMap.entries()) {
      // Need at least 2 charges
      if (data.dates.length < 2) continue

      // Sort dates
      const sortedDates = [...data.dates].sort((a, b) => a.getTime() - b.getTime())

      // Check that charges are roughly 28–35 days apart (monthly pattern)
      let monthlyCount = 0
      for (let i = 1; i < sortedDates.length; i++) {
        const diffDays =
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) /
          (1000 * 60 * 60 * 24)
        if (diffDays >= 25 && diffDays <= 40) {
          monthlyCount++
        }
      }

      // Require at least 2 consecutive monthly intervals
      if (monthlyCount < 1) continue

      const avgAmount =
        data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length
      const lastCharged = sortedDates[sortedDates.length - 1]
      const dayOfMonth = lastCharged.getDate()

      subscriptions.push({
        merchant,
        amount: Math.round(avgAmount),
        lastCharged: lastCharged.toISOString(),
        monthsDetected: data.dates.length,
        dayOfMonth,
        annualCost: Math.round(avgAmount * 12),
      })
    }

    // Sort by amount descending
    subscriptions.sort((a, b) => b.amount - a.amount)

    const totalMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0)
    const totalAnnual = subscriptions.reduce((s, sub) => s + sub.annualCost, 0)

    return NextResponse.json({ subscriptions, totalMonthly, totalAnnual })
  } catch (err) {
    console.error('Subscriptions GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}
