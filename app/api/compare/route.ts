import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth()

    const startOfThisMonth = new Date(thisYear, thisMonth, 1)
    const startOfLastMonth = new Date(thisYear, thisMonth - 1, 1)
    const endOfLastMonth = new Date(thisYear, thisMonth, 1)

    const [thisTxs, lastTxs] = await Promise.all([
      prisma.transaction.findMany({
        where: { date: { gte: startOfThisMonth }, isIncome: false },
        select: { amount: true, category: true },
      }),
      prisma.transaction.findMany({
        where: {
          date: { gte: startOfLastMonth, lt: endOfLastMonth },
          isIncome: false,
        },
        select: { amount: true, category: true },
      }),
    ])

    if (thisTxs.length === 0 && lastTxs.length === 0) {
      return NextResponse.json({ noData: true })
    }

    function sumByCategory(txs: { amount: number; category: string | null }[]) {
      const map = new Map<string, number>()
      let total = 0
      for (const t of txs) {
        const cat = t.category ?? 'övrigt'
        const abs = Math.abs(t.amount)
        map.set(cat, (map.get(cat) ?? 0) + abs)
        total += abs
      }
      const byCategory = Object.fromEntries(
        Array.from(map.entries()).sort((a, b) => b[1] - a[1])
      )
      return { total, byCategory }
    }

    const thisMonthData = sumByCategory(thisTxs)
    const lastMonthData = sumByCategory(lastTxs)

    const diff = thisMonthData.total - lastMonthData.total
    const diffPct =
      lastMonthData.total > 0
        ? Math.round((diff / lastMonthData.total) * 100)
        : 0

    return NextResponse.json({
      thisMonth: thisMonthData,
      lastMonth: lastMonthData,
      diff: Math.round(diff),
      diffPct,
    })
  } catch (err) {
    console.error('Compare API error:', err)
    return NextResponse.json({ error: 'Failed to compare' }, { status: 500 })
  }
}
