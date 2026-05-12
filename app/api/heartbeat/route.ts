import { NextResponse } from 'next/server'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'
import { detectSubscriptions, getChargedToday } from '@/lib/subscriptions'
import { checkSeasonalMemory, storeMonthlySnapshot } from '@/lib/seasonal'
import { sendPushNotification } from '@/lib/push'
import { generatePushDecisions, generateRuleBasedPushes } from '@/lib/advisor'
import { detectAnomalies } from '@/lib/anomalies'
import { detectHabitInsights } from '@/lib/habits'
import { prisma } from '@/lib/db'

const MAX_DAILY = parseInt(process.env.MAX_DAILY_INSIGHTS ?? '5', 10)

export async function GET() {
  try {
    const today = new Date()
    const hour = today.getHours()
    const weekday = today.getDay() // 0=sun, 1=mon, 5=fri

    // No pushes during night hours (23:00–07:00)
    if (hour >= 23 || hour < 7) {
      return NextResponse.json({ ok: true, skipped: 'night-hours' })
    }

    // On 1st of month: store last month's snapshot for seasonal memory
    if (today.getDate() === 1) {
      const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1
      const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
      await storeMonthlySnapshot(lastMonthYear, lastMonth).catch(() => {})
    }

    const [velocity, categories, subscriptions, chargedToday, anomalies, seasonalInsight, habitInsights] = await Promise.all([
      calculateVelocity(),
      getCategoryBreakdown(),
      detectSubscriptions(),
      getChargedToday(),
      detectAnomalies(),
      checkSeasonalMemory(),
      detectHabitInsights(),
    ])

    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)

    // Save seasonal insight to feed (not push-driven)
    if (seasonalInsight) {
      const alreadySaved = await prisma.insight.count({
        where: { type: 'seasonal', sentAt: { gte: todayStart } },
      })
      if (alreadySaved === 0) {
        await prisma.insight.create({ data: { type: 'seasonal', message: seasonalInsight } })
      }
    }

    // Save habit insights to feed (once per day per type)
    for (const habit of habitInsights.slice(0, 3)) {
      const alreadySaved = await prisma.insight.count({
        where: { type: habit.type, sentAt: { gte: todayStart }, message: { contains: habit.title } },
      })
      if (alreadySaved === 0) {
        await prisma.insight.create({ data: { type: habit.type, message: habit.body } })
      }
    }

    // Save new anomalies to feed (deduplicated by merchant + day)
    for (const anomaly of anomalies) {
      const alreadySaved = await prisma.insight.count({
        where: {
          type: 'anomaly',
          sentAt: { gte: todayStart },
          message: { contains: anomaly.merchant },
        },
      })
      if (alreadySaved === 0) {
        const msg = anomaly.reason === 'new_merchant'
          ? `Ovanlig transaktion: ${anomaly.amount.toLocaleString('sv-SE')} kr hos ${anomaly.merchant} — du har aldrig handlat där innan. Var det du?`
          : anomaly.reason === 'unusually_large'
            ? `${anomaly.merchant}: ${anomaly.amount.toLocaleString('sv-SE')} kr — ovanligt stort köp. ${anomaly.context}`
            : anomaly.context
        await prisma.insight.create({
          data: { type: 'anomaly', message: msg, data: JSON.stringify(anomaly) },
        })
      }
    }

    // How many pushes sent today?
    const sentToday = await prisma.insight.count({
      where: { sentAt: { gte: todayStart }, type: { notIn: ['seasonal', 'anomaly', 'pattern'] } },
    })

    const pushed: string[] = []

    // ── 1. Anomaly push (highest priority) ──
    for (const anomaly of anomalies.slice(0, 1)) {
      if (pushed.length + sentToday >= MAX_DAILY) break
      const alreadyPushed = await prisma.insight.count({
        where: { type: 'anomaly', sentAt: { gte: todayStart }, message: { contains: anomaly.merchant } },
      })
      if (alreadyPushed > 1) continue // already saved once above
      const msg = anomaly.reason === 'new_merchant'
        ? `Ovanlig transaktion: ${anomaly.amount.toLocaleString('sv-SE')} kr hos ${anomaly.merchant} — aldrig handlat där tidigare.`
        : `${anomaly.merchant}: ${anomaly.amount.toLocaleString('sv-SE')} kr — ovanligt stort köp.`
      await sendPushNotification('Pulse — Avvikelse', msg)
      pushed.push(msg)
    }

    // ── 2. Subscription charged today ──
    if (chargedToday.length > 0 && pushed.length + sentToday < MAX_DAILY) {
      for (const sub of chargedToday.slice(0, 1)) {
        const alreadyPushed = await prisma.insight.count({
          where: { type: 'subscription', sentAt: { gte: todayStart }, message: { contains: sub.merchant } },
        })
        if (alreadyPushed > 0) continue
        const months = sub.monthsDetected
        const body = months >= 6
          ? `${sub.merchant} drog ${sub.amount.toLocaleString('sv-SE')} kr idag. Du har betalt det ${months} månader i rad. Fortfarande värt det?`
          : `${sub.merchant} drog ${sub.amount.toLocaleString('sv-SE')} kr idag.`
        await prisma.insight.create({
          data: { type: 'subscription', message: body, data: JSON.stringify({ merchant: sub.merchant, amount: sub.amount, months }) },
        })
        await sendPushNotification('Pulse — Prenumeration', body)
        pushed.push(body)
        break
      }
    }

    // ── 3. Monday: cash flow calendar push ──
    if (weekday === 1 && hour >= 8 && pushed.length + sentToday < MAX_DAILY) {
      const alreadySentMonday = await prisma.insight.count({
        where: { type: 'insight', sentAt: { gte: todayStart }, message: { contains: 'Den här veckan' } },
      })
      if (alreadySentMonday === 0) {
        // Build what's coming this week
        const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
        const PAYDAY_DAY = parseInt(process.env.PAYDAY_DAY ?? '25', 10)
        const MONTHLY_RENT = parseFloat(process.env.MONTHLY_RENT ?? '8500')
        const items: string[] = []

        // Check if rent is due this week
        const rentDate = new Date(today.getFullYear(), today.getMonth(), 1)
        if (rentDate >= today && rentDate <= weekEnd && MONTHLY_RENT > 0) {
          const dayName = rentDate.toLocaleDateString('sv-SE', { weekday: 'long' })
          items.push(`hyra ${MONTHLY_RENT.toLocaleString('sv-SE')} kr på ${dayName}`)
        }

        // Subscriptions this week
        for (const sub of subscriptions.slice(0, 2)) {
          const last = sub.lastCharged instanceof Date ? sub.lastCharged : new Date(sub.lastCharged as string)
          const next = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000)
          if (next >= today && next <= weekEnd) {
            const dayName = next.toLocaleDateString('sv-SE', { weekday: 'long' })
            items.push(`${sub.merchant} ${sub.amount.toLocaleString('sv-SE')} kr på ${dayName}`)
          }
        }

        // Payday this week
        const paydayThisMonth = new Date(today.getFullYear(), today.getMonth(), PAYDAY_DAY)
        if (paydayThisMonth >= today && paydayThisMonth <= weekEnd) {
          items.push(`lön på ${paydayThisMonth.toLocaleDateString('sv-SE', { weekday: 'long' })}`)
        }

        const balance = Math.round(velocity.currentBalance)
        const balancePart = balance > 10000
          ? `Du har ${balance.toLocaleString('sv-SE')} kr — ser bra ut.`
          : `Du har ${balance.toLocaleString('sv-SE')} kr.`

        const body = items.length > 0
          ? `Den här veckan: ${items.join(', ')}. ${balancePart}`
          : `Ny vecka. ${balancePart}`

        await prisma.insight.create({ data: { type: 'insight', message: body } })
        await sendPushNotification('Pulse — Veckokoll', body)
        pushed.push(body)
      }
    }

    // ── 3b. Habit/spike push (midday check, once per day) ──
    if (hour >= 12 && hour <= 15 && pushed.length + sentToday < MAX_DAILY) {
      const topHabit = habitInsights.find(h => h.priority >= 6)
      if (topHabit) {
        const alreadyPushed = await prisma.insight.count({
          where: { type: topHabit.type, sentAt: { gte: todayStart }, message: { contains: topHabit.title } },
        })
        if (alreadyPushed <= 1) { // was saved above but not pushed
          await sendPushNotification('Pulse — Observation', topHabit.body)
          pushed.push(topHabit.body)
        }
      }
    }

    // ── 4. Friday pattern push ──
    if (weekday === 5 && hour >= 8 && pushed.length + sentToday < MAX_DAILY) {
      const alreadySentFriday = await prisma.insight.count({
        where: { type: 'pattern', sentAt: { gte: todayStart } },
      })
      if (alreadySentFriday === 0) {
        // Check if Friday is the expensive day in patterns
        const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        const fridayTx = await prisma.transaction.aggregate({
          where: { isIncome: false, date: { gte: since90 } },
          _sum: { amount: true },
          _count: true,
        })
        // Count Fridays in 90 days ≈ 13
        const friAvg = Math.abs((fridayTx._sum.amount ?? 0)) / 13
        const allAvg = Math.abs((fridayTx._sum.amount ?? 0)) / 90

        if (friAvg > allAvg * 2 && friAvg > 500) {
          const balance = Math.round(velocity.currentBalance)
          const body = `Fredagskänsla — men fredagar kostar dig i snitt ${Math.round(friAvg).toLocaleString('sv-SE')} kr. Du har ${balance.toLocaleString('sv-SE')} kr kvar till löning.`
          await prisma.insight.create({ data: { type: 'pattern', message: body } })
          await sendPushNotification('Pulse — Fredagsmönster', body)
          pushed.push(body)
        }
      }
    }

    // ── 5. Claude (or rule-based fallback) contextual push ──
    if (pushed.length + sentToday < MAX_DAILY) {
      let decisions
      try {
        decisions = await generatePushDecisions(
          velocity, categories, subscriptions,
          sentToday + pushed.length, MAX_DAILY, anomalies
        )
      } catch {
        decisions = generateRuleBasedPushes(velocity, anomalies, sentToday + pushed.length, MAX_DAILY)
      }

      for (const decision of decisions) {
        if (!decision.send || pushed.length + sentToday >= MAX_DAILY) continue
        await prisma.insight.create({
          data: {
            type: velocity.level === 'CRITICAL' ? 'velocity' : 'insight',
            message: decision.body,
            data: JSON.stringify({ title: decision.title, level: velocity.level }),
          },
        })
        await sendPushNotification(decision.title, decision.body)
        pushed.push(decision.body)
      }
    }

    return NextResponse.json({
      ok: true,
      velocity: velocity.level,
      chargedToday: chargedToday.map(s => s.merchant),
      anomalies: anomalies.map(a => a.context),
      sentToday: sentToday + pushed.length,
      pushed,
      seasonal: !!seasonalInsight,
    })
  } catch (err) {
    console.error('Heartbeat error:', err)
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 })
  }
}
