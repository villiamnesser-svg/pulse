import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const { searchParams } = new URL(req.url)
    const paramA = searchParams.get('a')
    const paramB = searchParams.get('b')

    const now = new Date()

    let startA: Date
    let endA: Date
    let startB: Date
    let endB: Date

    if (paramA && paramB) {
      // Parse YYYY-MM format
      const [yearA, monthA] = paramA.split('-').map(Number)
      const [yearB, monthB] = paramB.split('-').map(Number)
      startA = new Date(yearA, monthA - 1, 1)
      endA = new Date(yearA, monthA, 1)
      startB = new Date(yearB, monthB - 1, 1)
      endB = new Date(yearB, monthB, 1)
    } else {
      // Default: current vs last month
      const thisYear = now.getFullYear()
      const thisMonth = now.getMonth()
      startA = new Date(thisYear, thisMonth, 1)
      endA = new Date(thisYear, thisMonth + 1, 1)
      startB = new Date(thisYear, thisMonth - 1, 1)
      endB = new Date(thisYear, thisMonth, 1)
    }

    const [txsA, txsB] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: startA, lt: endA }, isIncome: false },
        select: { amount: true, category: true },
      }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: startB, lt: endB }, isIncome: false },
        select: { amount: true, category: true },
      }),
    ])

    if (txsA.length === 0 && txsB.length === 0) {
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
      return {
        total,
        byCategory: Object.fromEntries(
          Array.from(map.entries()).sort((a, b) => b[1] - a[1])
        ),
      }
    }

    const dataA = sumByCategory(txsA)
    const dataB = sumByCategory(txsB)
    const diff = dataA.total - dataB.total
    const diffPct =
      dataB.total > 0 ? Math.round((diff / dataB.total) * 100) : 0

    // Legacy field names for backwards compat (thisMonth = A, lastMonth = B)
    return NextResponse.json({
      thisMonth: dataA,
      lastMonth: dataB,
      diff: Math.round(diff),
      diffPct,
      // Also expose A/B naming for new compare page
      a: dataA,
      b: dataB,
    })
  } catch (err) {
    console.error('Compare API error:', err)
    return NextResponse.json({ error: 'Failed to compare' }, { status: 500 })
  }
}
