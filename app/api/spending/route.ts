import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const transactions = await prisma.transaction.findMany({
    where: { isIncome: false, date: { gte: since } },
    select: { date: true, amount: true, category: true },
    orderBy: { date: 'asc' },
  })

  // Build map of date → total spend
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
    dayOfWeek: new Date(date).getDay(), // 0=sun, 6=sat
  }))

  return NextResponse.json(data)
}
