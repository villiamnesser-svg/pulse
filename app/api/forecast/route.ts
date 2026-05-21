import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

function getDaysUntilPayday(today: Date, paydayDay: number): number {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), paydayDay)
  if (thisMonth > today) {
    return Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, paydayDay)
  return Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export interface ForecastResult {
  daysToPayday: number
  currentBalance: number
  avgDailySpend: number
  projectedBalance: number
  projectedShortfall: number       // negative = fine, positive = potential shortfall
  knownUpcomingCost: number        // rent + detected recurring bills
  status: 'safe' | 'tight' | 'critical'
  statusMessage: string
  paydayDay: number
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const profile = await prisma.userProfile.findFirst({ where: { userId } })

    const paydayDay = profile?.paydayDay ?? 25
    const monthlyRent = profile?.monthlyRent ?? 0
    const criticalBuffer = profile?.criticalBuffer ?? 5000

    const today = new Date()
    const daysToPayday = getDaysUntilPayday(today, paydayDay)

    // Get current balance from most recent transaction
    const lastTx = await prisma.transaction.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { balance: true },
    })
    const currentBalance = lastTx?.balance ?? 0

    // Calculate avg daily spend over last 30 days
    const since30 = new Date()
    since30.setDate(since30.getDate() - 30)
    const recent = await prisma.transaction.findMany({
      where: { userId, isIncome: false, date: { gte: since30 }, NOT: { category: { in: ['utlägg', 'återbetalning'] } } },
      select: { amount: true, date: true },
    })
    const totalRecent = recent.reduce((s, t) => s + Math.abs(t.amount), 0)
    const avgDailySpend = recent.length > 0 ? totalRecent / 30 : 0

    // Detect if rent is due before payday (rent typically due on the 1st in Sweden)
    const rentDueDay = 1 // first of the month
    const nextRentDate = (() => {
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), rentDueDay)
      if (thisMonth > today) return thisMonth
      return new Date(today.getFullYear(), today.getMonth() + 1, rentDueDay)
    })()
    const daysToRent = Math.ceil((nextRentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const knownUpcomingCost = (daysToRent <= daysToPayday && monthlyRent > 0) ? monthlyRent : 0

    // Project balance at payday
    const projectedSpend = avgDailySpend * daysToPayday + knownUpcomingCost
    const projectedBalance = currentBalance - projectedSpend
    const projectedShortfall = criticalBuffer - projectedBalance

    // Determine status
    let status: 'safe' | 'tight' | 'critical'
    let statusMessage: string

    if (projectedBalance >= criticalBuffer * 2) {
      status = 'safe'
      statusMessage = `Du klarar dig fint — beräknat ${Math.round(projectedBalance).toLocaleString('sv-SE')} kr kvar till lönen.`
    } else if (projectedBalance >= criticalBuffer) {
      status = 'tight'
      statusMessage = `Lite tight — försök hålla nere utgifterna de nästa ${daysToPayday} dagarna.`
    } else {
      status = 'critical'
      statusMessage = `Saldot riskerar att gå under ${Math.round(criticalBuffer).toLocaleString('sv-SE')} kr innan lönen.`
    }

    const result: ForecastResult = {
      daysToPayday,
      currentBalance,
      avgDailySpend,
      projectedBalance,
      projectedShortfall,
      knownUpcomingCost,
      status,
      statusMessage,
      paydayDay,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Forecast error:', err)
    return NextResponse.json({ error: 'Forecast failed' }, { status: 500 })
  }
}
