import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { categorizeBatch } from '@/lib/categorizer'

export const maxDuration = 60

export async function POST() {
  const uncategorized = await prisma.transaction.findMany({
    where: {
      OR: [{ category: null }, { category: 'övrigt' }],
      isIncome: false,
    },
    select: { id: true, merchant: true, amount: true, isIncome: true, date: true, balance: true },
    orderBy: { date: 'desc' },
    take: 100,
  })

  if (uncategorized.length === 0) {
    const total = await prisma.transaction.count()
    return NextResponse.json({ message: 'Allt är redan kategoriserat', updated: 0, remaining: 0, total })
  }

  const categorized = await categorizeBatch(
    uncategorized.map((t) => ({
      id: t.id,
      merchant: t.merchant,
      amount: t.amount,
      isIncome: t.isIncome,
      date: t.date,
      balance: t.balance,
    }))
  )

  await Promise.all(
    categorized.map((t) =>
      prisma.transaction.update({
        where: { id: t.id },
        data: { category: t.category },
      })
    )
  )

  const remaining = await prisma.transaction.count({
    where: {
      OR: [{ category: null }, { category: 'övrigt' }],
      isIncome: false,
    },
  })

  return NextResponse.json({
    updated: categorized.length,
    remaining,
  })
}

export async function GET() {
  const [total, uncategorized] = await Promise.all([
    prisma.transaction.count({ where: { isIncome: false } }),
    prisma.transaction.count({
      where: {
        OR: [{ category: null }, { category: 'övrigt' }],
        isIncome: false,
      },
    }),
  ])
  return NextResponse.json({ total, uncategorized, categorized: total - uncategorized })
}
