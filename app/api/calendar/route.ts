import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { detectSubscriptions } from '@/lib/subscriptions'

export interface CalendarEvent {
  type: 'payday' | 'rent' | 'subscription' | 'spending'
  label: string
  amount: number
  merchant?: string
}

export interface CalendarDay {
  date: string
  events: CalendarEvent[]
  projectedBalance: number
  isCritical: boolean
  isPayday: boolean
  isToday: boolean
  isPast: boolean
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)

  const profile = await prisma.userProfile.findFirst({ where: { userId } })
  const PAYDAY_DAY = profile?.paydayDay ?? parseInt(process.env.PAYDAY_DAY ?? '25', 10)
  const MONTHLY_RENT = profile?.monthlyRent ?? parseFloat(process.env.MONTHLY_RENT ?? '8500')
  const CRITICAL_BUFFER = profile?.criticalBuffer ?? parseFloat(process.env.CRITICAL_BUFFER ?? '5000')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, isIncome: true }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId, isIncome: false }, _sum: { amount: true } }),
  ])
  const currentBalance = (incomeAgg._sum.amount ?? 0) + (expenseAgg._sum.amount ?? 0)

  const since30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentSpend = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: since30 }, category: { not: 'hyra' }, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
    _sum: { amount: true },
    _count: true,
  })
  const avgDailySpend = recentSpend._count > 0 ? Math.abs((recentSpend._sum.amount ?? 0)) / 30 : 300

  const subscriptions = await detectSubscriptions(userId)

  const subEvents: { dayOfMonth: number; label: string; amount: number; merchant: string }[] = []
  for (const sub of subscriptions) {
    const last = sub.lastCharged instanceof Date ? sub.lastCharged : new Date(sub.lastCharged)
    const next = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (next >= today && next <= new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000)) {
      subEvents.push({ dayOfMonth: next.getDate(), label: sub.merchant, amount: sub.amount, merchant: sub.merchant })
    }
  }

  const days: CalendarDay[] = []
  let balance = currentBalance

  for (let i = 0; i < 30; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().slice(0, 10)
    const dayNum = date.getDate()
    const isPast = date < today
    const isToday = date.getTime() === today.getTime()
    const isPayday = dayNum === PAYDAY_DAY

    const events: CalendarEvent[] = []
    let dayDelta = -avgDailySpend

    if (isPayday) {
      const lastIncome = await prisma.transaction.findFirst({
        where: { userId, isIncome: true },
        orderBy: { date: 'desc' },
        select: { amount: true },
      })
      const salary = lastIncome?.amount ?? 25000
      events.push({ type: 'payday', label: 'Lön', amount: salary })
      dayDelta += salary
    }

    if (dayNum === 1 && MONTHLY_RENT > 0) {
      events.push({ type: 'rent', label: 'Hyra', amount: -MONTHLY_RENT })
      dayDelta -= MONTHLY_RENT
    }

    for (const sub of subEvents) {
      if (sub.dayOfMonth === dayNum) {
        events.push({ type: 'subscription', label: sub.label, amount: -sub.amount, merchant: sub.merchant })
        dayDelta -= sub.amount
      }
    }

    if (!isPast) balance += dayDelta

    days.push({
      date: dateStr, events, projectedBalance: Math.round(balance),
      isCritical: balance < CRITICAL_BUFFER && !isPayday, isPayday, isToday, isPast,
    })
  }

  return NextResponse.json({ days, avgDailySpend: Math.round(avgDailySpend) })
}
