import { NextResponse } from 'next/server'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'
import { detectSubscriptions, getChargedToday } from '@/lib/subscriptions'
import { checkSeasonalMemory, storeMonthlySnapshot } from '@/lib/seasonal'
import { sendPushNotification } from '@/lib/push'
import { generatePushDecisions, generateRuleBasedPushes } from '@/lib/advisor'
import { detectAnomalies } from '@/lib/anomalies'
import { detectHabitInsights } from '@/lib/habits'
import { prisma } from '@/lib/db'
import {
  fridaySpendingPrediction,
  annualSubscriptionWarning,
  paydayBehaviorWarning,
  cashFlowForecast,
  categoryTrendAlert,
  cashWithdrawalReflection,
  newBehaviorDetection,
  postBigTransactionNudge,
  opportunityCostNudge,
  sundayWeeklySummary,
  almostThereRecord,
  streakInDanger,
  monthlySpendingRecord,
  yearOverYearInsight,
  goodWeekendDetection,
  fridayPermissionGiving,
  swishCategorizationPrompt,
  reEngagement30Days,
  lifeEventDetection,
  // New notification types
  repeatedMerchantAlert,
  midMonthPaceAlert,
  staleSubscriptionAlert,
  savingsGoalCelebration,
  opportunityCostMonthly,
  annualHabitConverter,
  paydayArrivalNudge,
  upcomingBillWarning,
  bestWeekRecord,
  unreimbursedOutlayAlert,
  reimbursementMatchSuggestion,
  mondayWeeklyRecap,
  type Notification,
} from '@/lib/notifications'
import { canCallAI, recordAICall } from '@/lib/ai-budget'
import { isPremiumUser } from '@/lib/subscription'

const MAX_DAILY = parseInt(process.env.MAX_DAILY_INSIGHTS ?? '12', 10)

// Helper: send a notification if not already sent today with this type key
async function maybePush(
  userId: string,
  type: string,
  notif: Notification | null,
  todayStart: Date,
  pushed: string[],
  sentToday: number,
): Promise<boolean> {
  if (!notif) return false
  if (pushed.length + sentToday >= MAX_DAILY) return false

  const alreadySent = await prisma.insight.count({
    where: { userId, type, sentAt: { gte: todayStart } },
  })
  if (alreadySent > 0) return false

  await prisma.insight.create({ data: { userId, type, message: notif.body } })
  await sendPushNotification(notif.title, notif.body, userId)
  pushed.push(notif.body)
  return true
}

const HEARTBEAT_COOLDOWN_MINUTES = parseInt(process.env.HEARTBEAT_COOLDOWN_MINUTES ?? '90', 10)

async function runForUser(userId: string) {
  // Only send push notifications to premium users
  const premium = await isPremiumUser(userId)
  if (!premium) return { skipped: 'not-premium' }

  const today = new Date()
  const hour = today.getHours()
  const weekday = today.getDay()

  if (hour >= 23 || hour < 7) return { skipped: 'night-hours' }

  // Server-side rate limit: skip if last heartbeat was too recent
  const cooldownMs = HEARTBEAT_COOLDOWN_MINUTES * 60 * 1000
  const recentHeartbeat = await prisma.insight.findFirst({
    where: { userId, type: 'heartbeat-ping', sentAt: { gte: new Date(Date.now() - cooldownMs) } },
  })
  if (recentHeartbeat) return { skipped: 'cooldown' }

  // Record this run so the next call can detect the cooldown
  await prisma.insight.create({ data: { userId, type: 'heartbeat-ping', message: 'heartbeat' } })

  if (today.getDate() === 1) {
    const lastMonth = today.getMonth() === 0 ? 11 : today.getMonth() - 1
    const lastMonthYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
    await storeMonthlySnapshot(lastMonthYear, lastMonth, userId).catch(() => {})
  }

  const [velocity, categories, subscriptions, chargedToday, anomalies, seasonalInsight, habitInsights] = await Promise.all([
    calculateVelocity(userId),
    getCategoryBreakdown(userId),
    detectSubscriptions(userId),
    getChargedToday(userId),
    detectAnomalies(userId),
    checkSeasonalMemory(userId),
    detectHabitInsights(userId),
  ])

  const profile = await prisma.userProfile.findFirst({ where: { userId } })
  const PAYDAY_DAY = profile?.paydayDay ?? 25
  const MONTHLY_RENT = profile?.monthlyRent ?? 8500

  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)

  // ── Save insights (non-push) ──────────────────────────────────────────────

  if (seasonalInsight) {
    const alreadySaved = await prisma.insight.count({
      where: { userId, type: 'seasonal', sentAt: { gte: todayStart } },
    })
    if (alreadySaved === 0) {
      await prisma.insight.create({ data: { userId, type: 'seasonal', message: seasonalInsight } })
    }
  }

  for (const habit of habitInsights.slice(0, 3)) {
    const alreadySaved = await prisma.insight.count({
      where: { userId, type: habit.type, sentAt: { gte: todayStart } },
    })
    if (alreadySaved === 0) {
      await prisma.insight.create({ data: { userId, type: habit.type, message: habit.body } })
    }
  }

  for (const anomaly of anomalies) {
    const alreadySaved = await prisma.insight.count({
      where: { userId, type: 'anomaly', sentAt: { gte: todayStart }, message: { contains: anomaly.merchant } },
    })
    if (alreadySaved === 0) {
      const msg = anomaly.reason === 'new_merchant'
        ? `Ovanlig transaktion: ${anomaly.amount.toLocaleString('sv-SE')} kr hos ${anomaly.merchant} — du har aldrig handlat där innan. Var det du?`
        : `${anomaly.merchant}: ${anomaly.amount.toLocaleString('sv-SE')} kr — ovanligt stort köp. ${anomaly.context}`
      await prisma.insight.create({ data: { userId, type: 'anomaly', message: msg, data: JSON.stringify(anomaly) } })
    }
  }

  // ── Count already sent today ───────────────────────────────────────────────

  const sentToday = await prisma.insight.count({
    where: {
      userId,
      sentAt: { gte: todayStart },
      type: { in: ['velocity', 'insight', 'subscription', 'anomaly', 'positive', 'prediction', 'trend', 'nudge', 'streak', 'timing'] },
    },
  })

  const pushed: string[] = []

  // ── PRIORITY 1: Anomaly push ───────────────────────────────────────────────

  for (const anomaly of anomalies.slice(0, 1)) {
    if (pushed.length + sentToday >= MAX_DAILY) break
    const alreadyPushed = await prisma.insight.count({
      where: { userId, type: 'anomaly', sentAt: { gte: todayStart }, message: { contains: anomaly.merchant } },
    })
    if (alreadyPushed > 0) continue
    const msg = anomaly.reason === 'new_merchant'
      ? `Ovanlig transaktion: ${anomaly.amount.toLocaleString('sv-SE')} kr hos ${anomaly.merchant} — aldrig handlat där tidigare.`
      : `${anomaly.merchant}: ${anomaly.amount.toLocaleString('sv-SE')} kr — ovanligt stort köp.`
    await sendPushNotification('Pulse — Avvikelse', msg, userId)
    pushed.push(msg)
  }

  // ── PRIORITY 2: Life event detection ──────────────────────────────────────

  if (hour >= 10) {
    await maybePush(userId, 'life-event', await lifeEventDetection(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 3: Subscription charged today ────────────────────────────────

  if (chargedToday.length > 0 && pushed.length + sentToday < MAX_DAILY) {
    for (const sub of chargedToday.slice(0, 1)) {
      const alreadyPushed = await prisma.insight.count({
        where: { userId, type: 'subscription', sentAt: { gte: todayStart }, message: { contains: sub.merchant } },
      })
      if (alreadyPushed > 0) continue
      const months = sub.monthsDetected
      const body = months >= 6
        ? `${sub.merchant} drog ${sub.amount.toLocaleString('sv-SE')} kr idag. Du har betalt det ${months} månader i rad. Fortfarande värt det?`
        : `${sub.merchant} drog ${sub.amount.toLocaleString('sv-SE')} kr idag.`
      await prisma.insight.create({ data: { userId, type: 'subscription', message: body, data: JSON.stringify({ merchant: sub.merchant, amount: sub.amount, months }) } })
      await sendPushNotification('Pulse — Prenumeration', body, userId)
      pushed.push(body)
      break
    }
  }

  // ── PRIORITY 4: Annual subscription warning ────────────────────────────────

  if (hour >= 8) {
    await maybePush(userId, 'annual-sub', await annualSubscriptionWarning(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 5: Post-big-transaction nudge (any time) ─────────────────────

  if (hour >= 9 && hour <= 22) {
    await maybePush(userId, 'big-tx-nudge', await postBigTransactionNudge(userId, categories), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 6: Swish categorization prompt (morning after) ───────────────

  if (hour >= 8 && hour <= 11) {
    await maybePush(userId, 'swish-prompt', await swishCategorizationPrompt(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 7: Monday veckokoll (existing logic) + good weekend ──────────

  if (weekday === 1 && hour >= 8 && pushed.length + sentToday < MAX_DAILY) {
    const alreadySentMonday = await prisma.insight.count({
      where: { userId, type: 'insight', sentAt: { gte: todayStart }, message: { contains: 'Den här veckan' } },
    })
    if (alreadySentMonday === 0) {
      const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      const items: string[] = []

      const rentDate = new Date(today.getFullYear(), today.getMonth(), 1)
      if (rentDate >= today && rentDate <= weekEnd && MONTHLY_RENT > 0) {
        items.push(`hyra ${MONTHLY_RENT.toLocaleString('sv-SE')} kr på ${rentDate.toLocaleDateString('sv-SE', { weekday: 'long' })}`)
      }

      for (const sub of subscriptions.slice(0, 2)) {
        const last = sub.lastCharged instanceof Date ? sub.lastCharged : new Date(sub.lastCharged as string)
        const next = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000)
        if (next >= today && next <= weekEnd) {
          items.push(`${sub.merchant} ${sub.amount.toLocaleString('sv-SE')} kr på ${next.toLocaleDateString('sv-SE', { weekday: 'long' })}`)
        }
      }

      const paydayThisMonth = new Date(today.getFullYear(), today.getMonth(), PAYDAY_DAY)
      if (paydayThisMonth >= today && paydayThisMonth <= weekEnd) {
        items.push(`lön på ${paydayThisMonth.toLocaleDateString('sv-SE', { weekday: 'long' })}`)
      }

      const balance = Math.round(velocity.currentBalance)
      const balancePart = balance > 10000 ? `Du har ${balance.toLocaleString('sv-SE')} kr — ser bra ut.` : `Du har ${balance.toLocaleString('sv-SE')} kr.`
      const body = items.length > 0 ? `Den här veckan: ${items.join(', ')}. ${balancePart}` : `Ny vecka. ${balancePart}`

      await prisma.insight.create({ data: { userId, type: 'insight', message: body } })
      await sendPushNotification('Pulse — Veckokoll', body, userId)
      pushed.push(body)
    }

    // Good weekend detection on Monday morning
    await maybePush(userId, 'good-weekend', await goodWeekendDetection(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 8: Friday notifications ──────────────────────────────────────

  if (weekday === 5) {
    // Friday morning prediction (07-10)
    if (hour >= 7 && hour <= 10) {
      await maybePush(userId, 'friday-prediction', await fridaySpendingPrediction(userId, velocity), todayStart, pushed, sentToday)
    }
    // Friday streak danger (morning)
    if (hour >= 8 && hour <= 11) {
      await maybePush(userId, 'streak-danger', await streakInDanger(userId, velocity), todayStart, pushed, sentToday)
    }
    // Friday afternoon permission-giving (15-18)
    if (hour >= 15 && hour <= 18) {
      await maybePush(userId, 'friday-permission', await fridayPermissionGiving(userId, velocity), todayStart, pushed, sentToday)
    }
  }

  // ── PRIORITY 9: Sunday weekly summary (17-22) ─────────────────────────────

  if (weekday === 0 && hour >= 17 && hour <= 22) {
    await maybePush(userId, 'sunday-summary', await sundayWeeklySummary(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 10: Habit/spike push (midday) ────────────────────────────────

  if (hour >= 12 && hour <= 15 && pushed.length + sentToday < MAX_DAILY) {
    const topHabit = habitInsights.find(h => h.priority >= 6)
    if (topHabit) {
      const alreadyPushed = await prisma.insight.count({
        where: { userId, type: topHabit.type, sentAt: { gte: todayStart } },
      })
      if (alreadyPushed <= 1) {
        await sendPushNotification('Pulse — Observation', topHabit.body, userId)
        pushed.push(topHabit.body)
      }
    }
  }

  // ── PRIORITY 11: Predictive / trend notifications ─────────────────────────

  if (hour >= 9 && hour <= 14) {
    await maybePush(userId, 'payday-behavior', await paydayBehaviorWarning(userId, velocity, PAYDAY_DAY), todayStart, pushed, sentToday)
    await maybePush(userId, 'cashflow-forecast', await cashFlowForecast(userId, velocity, MONTHLY_RENT), todayStart, pushed, sentToday)
    await maybePush(userId, 'category-trend', await categoryTrendAlert(userId), todayStart, pushed, sentToday)
    await maybePush(userId, 'new-behavior', await newBehaviorDetection(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 12: Monthly reflections (first week of month) ────────────────

  if (today.getDate() <= 7 && hour >= 10) {
    await maybePush(userId, 'cash-withdrawal', await cashWithdrawalReflection(userId), todayStart, pushed, sentToday)
    await maybePush(userId, 'yoy-insight', await yearOverYearInsight(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 13: End-of-month nudges ──────────────────────────────────────

  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  if (daysLeft <= 4 && hour >= 9) {
    await maybePush(userId, 'almost-record', await almostThereRecord(userId, categories), todayStart, pushed, sentToday)
    await maybePush(userId, 'monthly-record', await monthlySpendingRecord(userId, velocity), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 14: Opportunity cost nudge (mid-month, when tight) ───────────

  if (today.getDate() >= 10 && today.getDate() <= 20 && velocity.level !== 'SAFE' && hour >= 11) {
    await maybePush(userId, 'opportunity-cost', await opportunityCostNudge(userId, subscriptions, velocity), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 15: 30-day re-engagement ─────────────────────────────────────

  if (today.getDate() === 15 && hour >= 10) {
    await maybePush(userId, 'reengagement', await reEngagement30Days(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY X: Reimbursement match suggestion (within 48h of income) ─────

  if (hour >= 9 && hour <= 20) {
    await maybePush(userId, 'reimbursement-match', await reimbursementMatchSuggestion(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY X: Unreimbursed outlay reminder (any weekday morning) ────────

  if (weekday >= 1 && weekday <= 5 && hour >= 9 && hour <= 11) {
    await maybePush(userId, 'unreimbursed-outlay', await unreimbursedOutlayAlert(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 16 (new): Payday arrival nudge (within 24h of salary) ────────

  if (hour >= 9 && hour <= 20) {
    await maybePush(userId, 'payday-arrival', await paydayArrivalNudge(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 17 (new): Upcoming bill warning (3 days ahead) ──────────────

  if (hour >= 8 && hour <= 12) {
    await maybePush(userId, 'upcoming-bill', await upcomingBillWarning(userId, subscriptions, MONTHLY_RENT, PAYDAY_DAY), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 18 (new): Repeated merchant pattern (Tue-Thu midday) ─────────

  if (weekday >= 2 && weekday <= 5 && hour >= 11 && hour <= 15) {
    await maybePush(userId, 'repeated-merchant', await repeatedMerchantAlert(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 19 (new): Mid-month pace alert (14th-16th morning) ──────────

  if (today.getDate() >= 14 && today.getDate() <= 16 && hour >= 9 && hour <= 12) {
    await maybePush(userId, 'midmonth-pace', await midMonthPaceAlert(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 20 (new): Stale subscription alert (any weekday morning) ─────

  if (weekday >= 1 && weekday <= 5 && hour >= 9 && hour <= 11) {
    await maybePush(userId, 'stale-subscription', await staleSubscriptionAlert(userId, subscriptions), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 21 (new): Annual habit converter (once a week, mid-week) ─────

  if (weekday === 3 && hour >= 10 && hour <= 14) {
    await maybePush(userId, 'annual-habit', await annualHabitConverter(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 22 (new): Opportunity cost monthly (mid-month insight) ───────

  if (today.getDate() >= 10 && today.getDate() <= 18 && hour >= 10) {
    await maybePush(userId, 'opportunity-cost-monthly', await opportunityCostMonthly(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 23 (new): Savings goal celebration (last 5 days of month) ────

  const daysLeftMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  if (daysLeftMonth <= 5 && hour >= 10) {
    await maybePush(userId, 'savings-goal', await savingsGoalCelebration(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 24 (new): Best week record (Wed-Sun, any time of day) ────────

  if (weekday >= 3 && hour >= 9 && hour <= 20) {
    await maybePush(userId, 'best-week', await bestWeekRecord(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 25: Monday weekly recap ──────────────────────────────────────

  if (weekday === 1 && hour >= 8 && hour <= 10) {
    await maybePush(userId, 'weekly-recap', await mondayWeeklyRecap(userId), todayStart, pushed, sentToday)
  }

  // ── PRIORITY 16: Claude contextual push ───────────────────────────────────

  if (pushed.length + sentToday < MAX_DAILY) {
    let decisions
    const aiAllowed = await canCallAI(userId)
    try {
      if (aiAllowed) {
        await recordAICall(userId)
        decisions = await generatePushDecisions(velocity, categories, subscriptions, sentToday + pushed.length, MAX_DAILY, anomalies, userId)
      } else {
        decisions = generateRuleBasedPushes(velocity, anomalies, sentToday + pushed.length, MAX_DAILY)
      }
    } catch {
      decisions = generateRuleBasedPushes(velocity, anomalies, sentToday + pushed.length, MAX_DAILY)
    }

    for (const decision of decisions) {
      if (!decision.send || pushed.length + sentToday >= MAX_DAILY) continue
      await prisma.insight.create({
        data: {
          userId,
          type: velocity.level === 'CRITICAL' ? 'velocity' : 'insight',
          message: decision.body,
          data: JSON.stringify({ title: decision.title, level: velocity.level }),
        },
      })
      await sendPushNotification(decision.title, decision.body, userId)
      pushed.push(decision.body)
    }
  }

  return { pushed, sentToday: sentToday + pushed.length, velocity: velocity.level }
}

export async function GET() {
  try {
    const userIds = await prisma.pushSubscription.findMany({
      select: { userId: true },
      distinct: ['userId'],
    })

    const results = []
    for (const { userId } of userIds) {
      try {
        const result = await runForUser(userId)
        results.push({ userId, ...result })
      } catch (err) {
        console.error(`Heartbeat failed for user ${userId}:`, err)
      }
    }

    if (userIds.length === 0) {
      const result = await runForUser('local')
      results.push({ userId: 'local', ...result })
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('Heartbeat error:', err)
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 })
  }
}
