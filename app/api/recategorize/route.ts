import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { categorizeBatch } from '@/lib/categorizer'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  const uncategorized = await prisma.transaction.findMany({
    where: { userId, OR: [{ category: null }, { category: 'övrigt' }], isIncome: false },
    select: { id: true, merchant: true, amount: true, isIncome: true, date: true, balance: true },
    orderBy: { date: 'desc' },
    take: 100,
  })

  if (uncategorized.length === 0) {
    const total = await prisma.transaction.count({ where: { userId } })
    return NextResponse.json({ message: 'Allt är redan kategoriserat', updated: 0, remaining: 0, total })
  }

  const categorized = await categorizeBatch(uncategorized.map((t) => ({
    id: t.id, merchant: t.merchant, amount: t.amount, isIncome: t.isIncome, date: t.date, balance: t.balance,
  })), userId)

  await Promise.all(categorized.map((t) =>
    prisma.transaction.update({ where: { id: t.id }, data: { category: t.category } })
  ))

  const remaining = await prisma.transaction.count({
    where: { userId, OR: [{ category: null }, { category: 'övrigt' }], isIncome: false },
  })

  return NextResponse.json({ updated: categorized.length, remaining })
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  const [total, uncategorized] = await Promise.all([
    prisma.transaction.count({ where: { userId, isIncome: false } }),
    prisma.transaction.count({ where: { userId, OR: [{ category: null }, { category: 'övrigt' }], isIncome: false } }),
  ])
  return NextResponse.json({ total, uncategorized, categorized: total - uncategorized })
}
