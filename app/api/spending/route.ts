import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const transactions = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: since }, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
    select: { date: true, amount: true, category: true },
    orderBy: { date: 'asc' },
  })

  const dayMap = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(since)
    d.setDate(d.getDate() + i)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }

  for (const tx of transactions) {
    const key = tx.date.toISOString().slice(0, 10)
    dayMap.set(key, (dayMap.get(key) ?? 0) + Math.abs(tx.amount))
  }

  const data = Array.from(dayMap.entries()).map(([date, amount]) => ({
    date,
    amount: Math.round(amount),
    dayOfWeek: new Date(date).getDay(),
  }))

  return NextResponse.json(data)
}
