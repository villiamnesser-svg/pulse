import { prisma } from './db'
import { VelocityResult, CategoryBreakdown } from './velocity'
import { Subscription } from './subscriptions'

export interface Notification {
  title: string
  body: string
}

const MONTH_NAMES = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
]

// ─── PREDIKTIV ───────────────────────────────────────────────────────────────

// Predict weekend spending based on historical Fri-Sun average (send Friday morning)
// Also shows last weekend's actual spend for comparison
export async function fridaySpendingPrediction(
  userId: string,
  velocity: VelocityResult,
): Promise<Notification | null> {
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
  const txs = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: eightWeeksAgo } },
    select: { date: true, amount: true, category: true },
  })

  // Group spending into Fri(5)-Sun(0) windows
  const weekMap: Record<string, number> = {}
  for (const t of txs) {
    if (t.category === 'hyra') continue
    const d = new Date(t.date)
    const dow = d.getDay()
    if (dow === 5 || dow === 6 || dow === 0) {
      const friday = new Date(d)
      if (dow === 6) friday.setDate(d.getDate() - 1)
      else if (dow === 0) friday.setDate(d.getDate() - 2)
      const key = friday.toISOString().slice(0, 10)
      weekMap[key] = (weekMap[key] ?? 0) + Math.abs(t.amount)
    }
  }

  const today = new Date()
  const todayFriday = new Date(today)
  const todayKey = today.toISOString().slice(0, 10)

  // Last weekend = the Friday 7 days ago
  const lastFriday = new Date(today)
  lastFriday.setDate(today.getDate() - 7)
  const lastFridayKey = lastFriday.toISOString().slice(0, 10)
  const lastWeekendActual = weekMap[lastFridayKey] ?? 0

  // Exclude this weekend from averages
  const weekendTotals = Object.entries(weekMap)
    .filter(([key]) => key !== todayKey)
    .map(([, v]) => v)
    .filter(v => v > 100)

  if (weekendTotals.length < 3) return null

  const avgWeekend = weekendTotals.reduce((s, v) => s + v, 0) / weekendTotals.length
  const weekendBuffer = Math.max(velocity.dailyBudgetRemaining * 3, 0)

  if (avgWeekend > 300) {
    const lastWeekNote = lastWeekendActual > 100
      ? ` Förra helgen: ${Math.round(lastWeekendActual).toLocaleString('sv-SE')} kr.`
      : ''

    if (weekendBuffer < avgWeekend * 0.8) {
      return {
        title: 'Pulse — Fredagsprediktion',
        body: `Historiskt spenderar du ca ${Math.round(avgWeekend).toLocaleString('sv-SE')} kr i helgen. Du har bara ${Math.round(weekendBuffer).toLocaleString('sv-SE')} kr kvar i buffert.${lastWeekNote} Tajt.`,
      }
    } else {
      return {
        title: 'Pulse — Fredagsprediktion',
        body: `Det är fredag. Historiskt spenderar du ca ${Math.round(avgWeekend).toLocaleString('sv-SE')} kr i helgen.${lastWeekNote} Du har ${Math.round(weekendBuffer).toLocaleString('sv-SE')} kr kvar — ser bra ut.`,
      }
    }
  }
  return null
}

// Warn about annual subscription coming up ~5-7 days before anniversary
export async function annualSubscriptionWarning(userId: string): Promise<Notification | null> {
  const oneYearAgo = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000)
  const tenMonthsAgo = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000)

  // Transactions that happened about a year ago with no repeat since
  const oldTxs = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: oneYearAgo, lte: tenMonthsAgo }, amount: { lte: -300 } },
    select: { merchant: true, amount: true, date: true },
    orderBy: { date: 'asc' },
  })

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)

  for (const tx of oldTxs) {
    // No repeat in the last 6 months = likely annual
    const repeats = await prisma.transaction.count({
      where: { userId, merchant: tx.merchant, isIncome: false, date: { gte: sixMonthsAgo } },
    })
    if (repeats > 0) continue

    // Anniversary is coming in 4-8 days
    const anniversary = new Date(tx.date)
    anniversary.setFullYear(anniversary.getFullYear() + 1)
    const daysUntil = Math.round((anniversary.getTime() - Date.now()) / 86400000)
    if (daysUntil >= 4 && daysUntil <= 8) {
      return {
        title: 'Pulse — Årsabonnemang',
        body: `${tx.merchant} drog ${Math.abs(tx.amount).toLocaleString('sv-SE')} kr förra ${MONTH_NAMES[new Date(tx.date).getMonth()]}. Det är om ${daysUntil} dagar. Fortfarande i användning?`,
      }
    }
  }
  return null
}

// Payday behavior: day 3-5 after payday, spending rate alert
export async function paydayBehaviorWarning(
  userId: string,
  velocity: VelocityResult,
  paydayDay: number,
): Promise<Notification | null> {
  const today = new Date()
  const paydayThisMonth = new Date(today.getFullYear(), today.getMonth(), paydayDay)

  // Check if payday was 3-5 days ago
  const daysSincePayday = Math.floor((today.getTime() - paydayThisMonth.getTime()) / 86400000)
  if (daysSincePayday < 2 || daysSincePayday > 6) return null

  // Spending in the first N days after payday this month
  const daysSince = Math.max(daysSincePayday, 1)
  const postPaydayStart = new Date(paydayThisMonth)
  const spentSincePayday = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: postPaydayStart } },
    _sum: { amount: true },
  })
  const spent = Math.abs(spentSincePayday._sum.amount ?? 0)
  const dailyRate = spent / daysSince

  // Compare to baseline daily rate (monthly avg / 30)
  const baselineDaily = velocity.baselineMonthly / 30
  if (dailyRate > baselineDaily * 1.5 && spent > 500) {
    return {
      title: 'Pulse — Löningseffekten',
      body: `Du brukar spendera mer direkt efter lön. De senaste ${daysSince} dagarna: ${Math.round(spent).toLocaleString('sv-SE')} kr — ${Math.round(dailyRate).toLocaleString('sv-SE')} kr/dag mot ditt snitt på ${Math.round(baselineDaily).toLocaleString('sv-SE')} kr/dag.`,
    }
  }
  return null
}

// Cash-flow forecast: 12-16 days before payday, project remaining balance
export async function cashFlowForecast(
  userId: string,
  velocity: VelocityResult,
  monthlyRent: number,
): Promise<Notification | null> {
  const { daysUntilPayday, dailyBudgetRemaining, currentBalance } = velocity
  if (daysUntilPayday < 12 || daysUntilPayday > 18) return null
  if (dailyBudgetRemaining >= 0) return null // Only warn if tight

  const projectedAtPayday = currentBalance + dailyBudgetRemaining * daysUntilPayday
  const afterRent = projectedAtPayday - monthlyRent

  if (projectedAtPayday < 2000 || afterRent < 0) {
    return {
      title: 'Pulse — Kassaflödesprognos',
      body: `Om du fortsätter i den här takten: ca ${Math.round(Math.max(projectedAtPayday, 0)).toLocaleString('sv-SE')} kr kvar vid lön. Det ger ${Math.round(dailyBudgetRemaining)} kr/dag de närmaste ${daysUntilPayday} dagarna.`,
    }
  }
  return null
}

// ─── DETEKTIV ─────────────────────────────────────────────────────────────────

// 3-month category trend: consistently rising spending in a category
export async function categoryTrendAlert(userId: string): Promise<Notification | null> {
  const today = new Date()

  // Get last 3 full months of category spending
  const months: { year: number; month: number; start: Date; end: Date }[] = []
  for (let i = 3; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
    })
  }

  const categoryTotals: Record<string, number[]> = {}
  for (const { start, end } of months) {
    const rows = await prisma.transaction.groupBy({
      by: ['category'],
      where: { userId, isIncome: false, date: { gte: start, lte: end }, category: { not: null } },
      _sum: { amount: true },
    })
    for (const row of rows) {
      const cat = row.category!
      if (cat === 'hyra' || cat === 'inkomst') continue
      if (!categoryTotals[cat]) categoryTotals[cat] = []
      categoryTotals[cat].push(Math.abs(row._sum.amount ?? 0))
    }
  }

  for (const [cat, totals] of Object.entries(categoryTotals)) {
    if (totals.length < 3) continue
    const [m1, m2, m3] = totals
    // Rising every month and total increase > 200 kr/mån
    if (m2 > m1 * 1.1 && m3 > m2 * 1.1 && m3 - m1 > 200) {
      const increase = Math.round(m3 - m1)
      return {
        title: 'Pulse — Trend',
        body: `Tredje månaden i rad med stigande ${cat}-kostnader. +${increase.toLocaleString('sv-SE')} kr/mån jämfört med tre månader sedan. Medvetet?`,
      }
    }
  }
  return null
}

// Monthly cash withdrawal reflection
export async function cashWithdrawalReflection(userId: string): Promise<Notification | null> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const cashTxs = await prisma.transaction.findMany({
    where: {
      userId, isIncome: false, date: { gte: startOfMonth },
      OR: [
        { category: 'kontantuttag' },
        { merchant: { contains: 'uttag' } },
        { merchant: { contains: 'ATM' } },
        { merchant: { contains: 'Bankomat' } },
      ],
    },
    select: { amount: true },
  })

  if (cashTxs.length < 2) return null
  const total = cashTxs.reduce((s, t) => s + Math.abs(t.amount), 0)

  return {
    title: 'Pulse — Kontanter',
    body: `Du har tagit ut kontanter ${cashTxs.length} gånger den här månaden — ca ${Math.round(total).toLocaleString('sv-SE')} kr totalt. De pengarna kan jag inte kategorisera. Är det medvetet?`,
  }
}

// New behavior: 3+ weeks of spending in a category that wasn't there before
export async function newBehaviorDetection(userId: string): Promise<Notification | null> {
  const now = new Date()
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  // Recent spending per category (last 3 weeks)
  const recent = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, isIncome: false, date: { gte: threeWeeksAgo }, category: { not: null } },
    _sum: { amount: true },
    _count: { category: true },
  })

  for (const row of recent) {
    const cat = row.category!
    if (cat === 'hyra' || cat === 'inkomst' || cat === 'övrigt') continue
    const recentTotal = Math.abs(row._sum.amount ?? 0)
    if (recentTotal < 400 || row._count.category < 3) continue

    // Very little in this category before the 3-week window
    const prior = await prisma.transaction.aggregate({
      where: { userId, isIncome: false, category: cat, date: { gte: threeMonthsAgo, lt: threeWeeksAgo } },
      _sum: { amount: true },
    })
    const priorTotal = Math.abs(prior._sum.amount ?? 0)

    if (priorTotal < recentTotal * 0.3) {
      const weeklyRate = Math.round(recentTotal / 3)
      return {
        title: 'Pulse — Ny vana',
        body: `De senaste 3 veckorna: ca ${Math.round(recentTotal).toLocaleString('sv-SE')} kr på ${cat} — ett nytt mönster för dig. Ny vana, besök, eller tillfälligt?`,
      }
    }
  }
  return null
}

// ─── NUDGE ───────────────────────────────────────────────────────────────────

// Post-big-transaction nudge: fired after a large purchase (last 2h)
export async function postBigTransactionNudge(
  userId: string,
  categories: CategoryBreakdown[],
): Promise<Notification | null> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const recent = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: twoHoursAgo } },
    select: { merchant: true, amount: true, category: true },
    orderBy: { date: 'desc' },
    take: 5,
  })

  for (const tx of recent) {
    const amount = Math.abs(tx.amount)
    if (amount < 400) continue
    const cat = categories.find(c => c.category === tx.category)
    if (!cat || cat.amount === 0) continue

    // This transaction is a significant chunk of the month's category budget
    if (amount > cat.amount * 0.4 && cat.amount > 200) {
      return {
        title: 'Pulse — Stort köp',
        body: `${Math.round(amount).toLocaleString('sv-SE')} kr på ${tx.merchant}. Det är ${Math.round((amount / cat.amount) * 100)}% av din ${tx.category ?? 'budget'}-budget den här månaden.`,
      }
    }
  }
  return null
}

// Opportunity cost: pausing a subscription = something concrete
export async function opportunityCostNudge(
  userId: string,
  subscriptions: Subscription[],
  velocity: VelocityResult,
): Promise<Notification | null> {
  if (velocity.level === 'SAFE') return null
  if (subscriptions.length === 0) return null

  // Find a pauseable subscription (not rent, 50-300 kr/mån)
  const pauseable = subscriptions.find(s => s.amount >= 50 && s.amount <= 400 && s.monthsDetected >= 2)
  if (!pauseable) return null

  const saved = pauseable.amount
  const examples = [
    { threshold: 400, text: 'en middag ute' },
    { threshold: 300, text: 'en bio + popcorn' },
    { threshold: 200, text: 'ett träningspass' },
    { threshold: 100, text: 'en busskarta en vecka' },
  ]
  const example = examples.find(e => saved >= e.threshold) ?? { text: 'ett par kaffe' }

  // Get top food/restaurant merchant to make it concrete
  const topMerchant = await prisma.transaction.groupBy({
    by: ['merchant'],
    where: { userId, isIncome: false, date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, category: { in: ['mat', 'restaurang'] } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'asc' } },
    take: 1,
  })

  const merchantNote = topMerchant.length > 0
    ? ` + en gång mindre på ${topMerchant[0].merchant}`
    : ''

  return {
    title: 'Pulse — Alternativkostnad',
    body: `Om du pausar ${pauseable.merchant} (${Math.round(saved).toLocaleString('sv-SE')} kr)${merchantNote} sparar du tillräckligt för ${example.text} den här månaden.`,
  }
}

// Sunday evening weekly summary
export async function sundayWeeklySummary(userId: string): Promise<Notification | null> {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const rows = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, isIncome: false, date: { gte: weekStart }, category: { not: null } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'asc' } },
    take: 3,
  })

  if (rows.length === 0) return null

  const total = rows.reduce((s, r) => s + Math.abs(r._sum.amount ?? 0), 0)
  const topLines = rows
    .slice(0, 2)
    .map(r => `${r.category} ${Math.round(Math.abs(r._sum.amount ?? 0)).toLocaleString('sv-SE')} kr`)
    .join(', ')

  // Compare to last week
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const lastWeekAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: lastWeekStart, lt: weekStart } },
    _sum: { amount: true },
  })
  const lastWeekTotal = Math.abs(lastWeekAgg._sum.amount ?? 0)
  const diff = Math.round(total - lastWeekTotal)

  const comparisonText = lastWeekTotal > 0
    ? diff < -100
      ? ` — ${Math.abs(diff).toLocaleString('sv-SE')} kr under förra veckan. Bra jobbat.`
      : diff > 200
        ? ` — ${diff.toLocaleString('sv-SE')} kr över förra veckan.`
        : ' — ungefär som vanligt.'
    : '.'

  return {
    title: 'Pulse — Veckosummering',
    body: `Veckans utgifter: ${Math.round(total).toLocaleString('sv-SE')} kr. Toppar: ${topLines}${comparisonText}`,
  }
}

// Almost-there record: 3-4 days before month end, close to best month
export async function almostThereRecord(
  userId: string,
  categories: CategoryBreakdown[],
): Promise<Notification | null> {
  const today = new Date()
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  if (daysLeft > 4 || daysLeft < 1) return null

  // Check if current month total is close to lowest month in last 12 months
  const twelveMonthsAgo = new Date(today.getFullYear() - 1, today.getMonth(), 1)
  const historical = await prisma.seasonalMemory.findMany({
    where: { userId, year: { gte: twelveMonthsAgo.getFullYear() - 1 } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })

  if (historical.length < 3) return null

  const monthlyTotals = historical.map(r => r.total).sort((a, b) => a - b)
  const lowestMonth = monthlyTotals[0]
  const currentTotal = categories.reduce((s, c) => s + c.amount, 0)

  // We're within 10% of the all-time low
  if (currentTotal < lowestMonth * 1.15 && currentTotal > lowestMonth * 0.5) {
    const gap = Math.round(lowestMonth - currentTotal)
    const monthsAgo = historical.length
    if (gap > 0 && gap < 2000) {
      return {
        title: 'Pulse — Nära rekord',
        body: `Bara ${gap.toLocaleString('sv-SE')} kr från din bästa sparmånad på ${monthsAgo} månader. ${daysLeft} dagar kvar — det här kan du fixa.`,
      }
    }
  }
  return null
}

// ─── STREAK / GAME ────────────────────────────────────────────────────────────

// Streak in danger: days under budget, warn on Friday
export async function streakInDanger(userId: string, velocity: VelocityResult): Promise<Notification | null> {
  // Count consecutive days under daily budget
  const today = new Date()
  let streakDays = 0

  for (let i = 1; i <= 21; i++) {
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const daySpend = await prisma.transaction.aggregate({
      where: { userId, isIncome: false, date: { gte: dayStart, lte: dayEnd }, NOT: { category: 'hyra' } },
      _sum: { amount: true },
    })
    const spent = Math.abs(daySpend._sum.amount ?? 0)
    const dailyBaseline = velocity.baselineMonthly / 30

    if (spent < dailyBaseline * 1.1) {
      streakDays++
    } else {
      break
    }
  }

  if (streakDays >= 5) {
    return {
      title: 'Pulse — Streak',
      body: `Du är inne på dag ${streakDays} under din dagliga norm. Ikväll är statistiskt din farligaste kväll — fredag. Streaken är värd att skydda.`,
    }
  }
  return null
}

// Monthly spending record: is this the best month in N months?
export async function monthlySpendingRecord(
  userId: string,
  velocity: VelocityResult,
): Promise<Notification | null> {
  const today = new Date()
  // Only relevant last 3 days of the month
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  if (daysLeft > 3) return null

  const historical = await prisma.seasonalMemory.findMany({ where: { userId } })
  if (historical.length < 3) return null

  const sortedTotals = historical.map(r => r.total).sort((a, b) => a - b)
  const currentProjected = velocity.projectedMonthTotal

  // Is this month projected to be best or second-best?
  if (currentProjected < sortedTotals[0] || currentProjected < sortedTotals[1]) {
    const rank = currentProjected < sortedTotals[0] ? 1 : 2
    const monthsTracked = historical.length
    const diff = Math.round(sortedTotals[0] - currentProjected)
    return {
      title: 'Pulse — Rekord',
      body: rank === 1
        ? `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()} är på väg att bli din bästa sparmånad på ${monthsTracked} månader. Imponerande.`
        : `Du är ${diff.toLocaleString('sv-SE')} kr från din bästa sparmånad. ${daysLeft} dagar kvar.`,
    }
  }
  return null
}

// Year-over-year: how does this month compare to same month last year?
export async function yearOverYearInsight(userId: string): Promise<Notification | null> {
  const today = new Date()
  const currentMonthName = MONTH_NAMES[today.getMonth()]
  const lastYearRecord = await prisma.seasonalMemory.findUnique({
    where: { userId_year_month: { userId, year: today.getFullYear() - 1, month: currentMonthName } },
  })
  if (!lastYearRecord) return null

  // Get this month's spending so far, extrapolate
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const thisMonthAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: startOfMonth }, NOT: { category: 'hyra' } },
    _sum: { amount: true },
  })
  const thisMonthSoFar = Math.abs(thisMonthAgg._sum.amount ?? 0)
  const daysElapsed = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const thisMonthProjected = (thisMonthSoFar / daysElapsed) * daysInMonth

  const diff = Math.round(lastYearRecord.total - thisMonthProjected)
  const pct = Math.round(Math.abs(diff / lastYearRecord.total) * 100)

  if (Math.abs(diff) < 500 || pct < 10) return null

  if (diff > 0) {
    return {
      title: 'Pulse — År-för-år',
      body: `Du är på väg att spendera ${Math.abs(diff).toLocaleString('sv-SE')} kr mindre den här ${currentMonthName} jämfört med förra året (${Math.round(lastYearRecord.total).toLocaleString('sv-SE')} kr). ${pct}% bättre.`,
    }
  } else {
    return {
      title: 'Pulse — År-för-år',
      body: `Den här ${currentMonthName} ser dyrare ut än förra året — ca ${Math.abs(diff).toLocaleString('sv-SE')} kr mer. Förra ${currentMonthName}: ${Math.round(lastYearRecord.total).toLocaleString('sv-SE')} kr.`,
    }
  }
}

// Good weekend: no restaurant/nöje spending over the weekend
export async function goodWeekendDetection(userId: string): Promise<Notification | null> {
  // Run on Mondays — check Saturday + Sunday
  const today = new Date()
  const saturday = new Date(today)
  saturday.setDate(today.getDate() - 2)
  saturday.setHours(0, 0, 0, 0)
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - 1)
  sunday.setHours(23, 59, 59, 999)

  const weekendExpenses = await prisma.transaction.aggregate({
    where: {
      userId, isIncome: false,
      date: { gte: saturday, lte: sunday },
      category: { in: ['restaurang', 'nöje'] },
    },
    _sum: { amount: true },
  })
  const weekendTotal = Math.abs(weekendExpenses._sum.amount ?? 0)

  // Also get the average weekend spending on restaurang/nöje over last 8 weeks
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
  const historicalWeekend = await prisma.transaction.aggregate({
    where: {
      userId, isIncome: false,
      date: { gte: eightWeeksAgo },
      category: { in: ['restaurang', 'nöje'] },
    },
    _sum: { amount: true },
    _count: { id: true },
  })
  const avgWeekendRestaurant = Math.abs(historicalWeekend._sum.amount ?? 0) / 8

  if (weekendTotal === 0 && avgWeekendRestaurant > 150) {
    return {
      title: 'Pulse — Bra helg',
      body: `Du gick hela helgen utan restaurang eller nöje. ${Math.round(avgWeekendRestaurant).toLocaleString('sv-SE')} kr sparade mot ditt snitt. Händer inte så ofta.`,
    }
  }
  return null
}

// ─── SMART TIMING ─────────────────────────────────────────────────────────────

// Friday permission-giving: had a good week → spend a little tonight
export async function fridayPermissionGiving(userId: string, velocity: VelocityResult): Promise<Notification | null> {
  if (velocity.level !== 'SAFE') return null
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const thisWeekAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: weekStart }, NOT: { category: 'hyra' } },
    _sum: { amount: true },
  })
  const thisWeekTotal = Math.abs(thisWeekAgg._sum.amount ?? 0)
  const weeklyBaseline = velocity.baselineMonthly / 4.3

  if (thisWeekTotal < weeklyBaseline * 0.75 && velocity.dailyBudgetRemaining > 200) {
    const leftover = Math.round(velocity.dailyBudgetRemaining)
    return {
      title: 'Pulse — Bra vecka',
      body: `Du har hållit budgeten hela veckan och har ${leftover.toLocaleString('sv-SE')} kr kvar i dagsbuffert. Unna dig något rimligt ikväll — du har tjänat det.`,
    }
  }
  return null
}

// Swish categorization prompt: large Swish-like transfer yesterday
export async function swishCategorizationPrompt(userId: string): Promise<Notification | null> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  yesterday.setHours(0, 0, 0, 0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const swishTxs = await prisma.transaction.findMany({
    where: {
      userId, isIncome: false, date: { gte: yesterday, lt: todayStart },
      OR: [
        { merchant: { contains: 'Swish' } },
        { merchant: { contains: 'swish' } },
        { category: null },
      ],
      amount: { lte: -300 },
    },
    select: { merchant: true, amount: true },
    orderBy: { amount: 'asc' },
    take: 1,
  })

  if (swishTxs.length === 0) return null
  const tx = swishTxs[0]
  const amount = Math.abs(tx.amount)

  return {
    title: 'Pulse — Vad gick det till?',
    body: `Du swishade ${amount.toLocaleString('sv-SE')} kr igår. Jag kan inte kategorisera det automatiskt — dela nota, kontant-pool, eller något annat?`,
  }
}

// 30-day re-engagement: no push interaction or insight view in 30 days
export async function reEngagement30Days(userId: string): Promise<Notification | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentInsight = await prisma.insight.findFirst({
    where: { userId, sentAt: { gte: thirtyDaysAgo } },
    orderBy: { sentAt: 'desc' },
  })

  if (!recentInsight) {
    return {
      title: 'Pulse — Har du det bra?',
      body: `Det har gått en månad. Vill du att jag kör en snabb genomgång av vad som hänt med din ekonomi?`,
    }
  }
  return null
}

// Life event detection: unusual one-time large transaction at rare merchant
export async function lifeEventDetection(userId: string): Promise<Notification | null> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const recentLarge = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: threeDaysAgo }, amount: { lte: -1500 } },
    select: { merchant: true, amount: true, date: true },
    orderBy: { amount: 'asc' },
    take: 3,
  })

  for (const tx of recentLarge) {
    const amount = Math.abs(tx.amount)
    // Check if this merchant is rarely visited (< 3 transactions total)
    const history = await prisma.transaction.count({
      where: { userId, merchant: tx.merchant, isIncome: false },
    })
    if (history <= 2 && amount >= 1500) {
      return {
        title: 'Pulse — Ovanligt köp',
        body: `${Math.round(amount).toLocaleString('sv-SE')} kr på ${tx.merchant} — du handlar sällan där. Födelsedag, semester, eller engångsgrej? Jag kan hålla koll om det händer igen nästa år.`,
      }
    }
  }
  return null
}

// ─── NYA NOTISTYPER ───────────────────────────────────────────────────────────

// 1. Repeated merchant alert: same merchant 3+ times this week
export async function repeatedMerchantAlert(userId: string): Promise<Notification | null> {
  const monday = new Date()
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const txs = await prisma.transaction.findMany({
    where: { userId, isIncome: false, date: { gte: monday }, category: { not: 'hyra' } },
    select: { merchant: true, amount: true, category: true },
  })

  const merchantMap: Record<string, { count: number; total: number; category: string | null }> = {}
  for (const t of txs) {
    if (!t.merchant) continue
    if (!merchantMap[t.merchant]) merchantMap[t.merchant] = { count: 0, total: 0, category: t.category }
    merchantMap[t.merchant].count++
    merchantMap[t.merchant].total += Math.abs(t.amount)
  }

  // Find merchant visited 3+ times this week
  const repeated = Object.entries(merchantMap)
    .filter(([, v]) => v.count >= 3 && v.total >= 200)
    .sort(([, a], [, b]) => b.total - a.total)

  if (repeated.length === 0) return null
  const [merchant, { count, total, category }] = repeated[0]
  const catNote = category ? ` (${category})` : ''

  return {
    title: 'Pulse — Mönster den här veckan',
    body: `${merchant}${catNote} — ${count} gånger den här veckan, ${Math.round(total).toLocaleString('sv-SE')} kr totalt. Varje gång ett medvetet val?`,
  }
}

// 2. Mid-month pace alert: fires on the 14-16th, show spending pace vs usual
export async function midMonthPaceAlert(userId: string): Promise<Notification | null> {
  const today = new Date()
  if (today.getDate() < 14 || today.getDate() > 16) return null

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const daysElapsed = today.getDate()

  const thisMonthAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: startOfMonth }, NOT: { category: 'hyra' } },
    _sum: { amount: true },
  })
  const thisMonthSoFar = Math.abs(thisMonthAgg._sum.amount ?? 0)

  // Compare to historical average (seasonal memory or last 3 months)
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1)
  const historicalAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: threeMonthsAgo, lt: startOfMonth }, NOT: { category: 'hyra' } },
    _sum: { amount: true },
  })
  const historicalTotal = Math.abs(historicalAgg._sum.amount ?? 0)
  const avgMonthly = historicalTotal / 3
  if (avgMonthly < 500) return null

  const projectedMonthly = (thisMonthSoFar / daysElapsed) * 30
  const pct = Math.round(((projectedMonthly - avgMonthly) / avgMonthly) * 100)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - daysElapsed

  if (Math.abs(pct) < 8) return null // No notification if within ±8%

  if (pct > 0) {
    return {
      title: 'Pulse — Halvmånadskoll',
      body: `Halvtid. Du är ${pct}% över normalt tempo — i den här takten landar månaden på ca ${Math.round(projectedMonthly).toLocaleString('sv-SE')} kr. ${daysLeft} dagar kvar att justera.`,
    }
  } else {
    return {
      title: 'Pulse — Halvmånadskoll',
      body: `Halvtid. Du är ${Math.abs(pct)}% under normalt tempo — bra jobbat. I den här takten: ca ${Math.round(projectedMonthly).toLocaleString('sv-SE')} kr för månaden.`,
    }
  }
}

// 3. Stale subscription alert: monthly subscription not charged in 45-180 days
export async function staleSubscriptionAlert(
  userId: string,
  subscriptions: import('./subscriptions').Subscription[],
): Promise<Notification | null> {
  const now = Date.now()
  const stale = subscriptions.filter(s => {
    const daysSince = (now - new Date(s.lastCharged).getTime()) / 86400000
    return daysSince >= 45 && daysSince <= 180 && s.monthsDetected >= 2
  })

  if (stale.length === 0) return null
  // Sort by amount descending — biggest stale subscription first
  stale.sort((a, b) => b.amount - a.amount)
  const sub = stale[0]
  const daysSince = Math.round((now - new Date(sub.lastCharged).getTime()) / 86400000)

  return {
    title: 'Pulse — Prenumeration borta?',
    body: `${sub.merchant} (${sub.amount.toLocaleString('sv-SE')} kr/mån) drog senast för ${daysSince} dagar sedan. Har du avslutat den, eller kan kortet ha bytt?`,
  }
}

// 4. Savings goal celebration: net savings this month ≥ target (10% of income)
export async function savingsGoalCelebration(userId: string): Promise<Notification | null> {
  const today = new Date()
  // Only relevant last 5 days of month
  const daysLeft = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate()
  if (daysLeft > 5) return null

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, isIncome: true, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, isIncome: false, date: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ])

  const income = Math.abs(incomeAgg._sum.amount ?? 0)
  const expenses = Math.abs(expenseAgg._sum.amount ?? 0)
  if (income < 5000) return null

  const netSavings = income - expenses
  const savingsRate = netSavings / income

  if (savingsRate >= 0.1 && netSavings > 500) {
    const pct = Math.round(savingsRate * 100)
    return {
      title: 'Pulse — Sparmål nått 🎯',
      body: `Du sparar ${pct}% av inkomsten den här månaden — ${Math.round(netSavings).toLocaleString('sv-SE')} kr netto. Det är bättre än de flesta klarar. Håll det.`,
    }
  }
  return null
}

// 5. Opportunity cost monthly: biggest category spend → real-world equivalent
export async function opportunityCostMonthly(userId: string): Promise<Notification | null> {
  const today = new Date()
  // Run in the middle of the month (8th-20th)
  if (today.getDate() < 8 || today.getDate() > 20) return null

  const SKIP_CATS = ['hyra', 'inkomst', 'räkningar', 'el', 'internet', 'försäkring']
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const rows = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      userId, isIncome: false, date: { gte: startOfMonth },
      category: { notIn: SKIP_CATS, not: undefined },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'asc' } },
    take: 5,
  })

  const nonEssential = rows.filter(r => {
    if (!r.category) return false
    return !SKIP_CATS.includes(r.category.toLowerCase())
  })

  if (nonEssential.length === 0) return null
  const top = nonEssential[0]
  if (!top.category) return null
  const amount = Math.round(Math.abs(top._sum?.amount ?? 0))
  if (amount < 800) return null

  // Map to real-world equivalents
  const equivalents: { min: number; text: string }[] = [
    { min: 5000, text: 'en flygresa till södra Europa' },
    { min: 3000, text: 'en helgresa i Norden' },
    { min: 2000, text: 'tre månaders gym' },
    { min: 1500, text: 'en laddad middag för två' },
    { min: 1000, text: 'ett par månader Netflix + Spotify' },
    { min: 500,  text: 'fyra biobiljetter' },
  ]
  const equiv = equivalents.find(e => amount >= e.min) ?? { text: 'några kaffebesök' }

  // Extrapolate to annual
  const daysElapsed = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const projectedMonthly = Math.round((amount / daysElapsed) * daysInMonth)
  const annually = Math.round(projectedMonthly * 12)

  return {
    title: 'Pulse — Vad kostar det egentligen?',
    body: `${amount.toLocaleString('sv-SE')} kr på ${top.category} hittills. Projicerat: ${projectedMonthly.toLocaleString('sv-SE')} kr/mån — ${annually.toLocaleString('sv-SE')} kr/år. Det är ungefär ${equiv.text}.`,
  }
}

// 6. Annual habit converter: frequent small purchase → annual cost
export async function annualHabitConverter(userId: string): Promise<Notification | null> {
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000)

  // Fetch small transactions and aggregate in JS to avoid Prisma groupBy typing quirks
  const txs = await prisma.transaction.findMany({
    where: {
      userId, isIncome: false, date: { gte: fourWeeksAgo },
      amount: { lte: -30, gte: -500 },
    },
    select: { merchant: true, amount: true },
  })

  const merchantMap: Record<string, { count: number; total: number }> = {}
  for (const t of txs) {
    if (!t.merchant) continue
    if (!merchantMap[t.merchant]) merchantMap[t.merchant] = { count: 0, total: 0 }
    merchantMap[t.merchant].count++
    merchantMap[t.merchant].total += Math.abs(t.amount)
  }

  // Pick merchant with 4+ visits and highest annual projected cost
  let best: { merchant: string; weeklyCount: number; annual: number } | null = null
  for (const [merchant, { count, total }] of Object.entries(merchantMap)) {
    if (count < 4) continue
    const weeklyCount = count / 4
    const weeklySpend = total / 4
    const annual = Math.round(weeklySpend * 52)
    if (annual > 1000 && (!best || annual > best.annual)) {
      best = { merchant, weeklyCount, annual }
    }
  }

  if (!best) return null
  const timesPerWeek = Math.round(best.weeklyCount * 10) / 10

  return {
    title: 'Pulse — Årsomvandlaren',
    body: `${best.merchant} ca ${timesPerWeek.toLocaleString('sv-SE')}× i veckan — ${best.annual.toLocaleString('sv-SE')} kr per år. Medvetet val eller bara en vana?`,
  }
}

// 7. Payday arrival nudge: large income detected in last 24h → prompt savings
export async function paydayArrivalNudge(userId: string): Promise<Notification | null> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const recentIncome = await prisma.transaction.findMany({
    where: { userId, isIncome: true, date: { gte: yesterday }, amount: { gte: 5000 } },
    select: { amount: true, merchant: true },
    orderBy: { amount: 'desc' },
    take: 1,
  })

  if (recentIncome.length === 0) return null
  const income = Math.abs(recentIncome[0].amount)

  // Suggest saving 10% immediately
  const saveSuggestion = Math.round(income * 0.1 / 100) * 100 // round to nearest 100

  return {
    title: 'Pulse — Lönen är inne',
    body: `${income.toLocaleString('sv-SE')} kr har landat. Bästa stunden att flytta undan lite — ${saveSuggestion.toLocaleString('sv-SE')} kr (10%) nu, innan vardagen tar det.`,
  }
}

// 8. Upcoming bill warning: recurring charge expected within 3 days
export async function upcomingBillWarning(
  userId: string,
  subscriptions: import('./subscriptions').Subscription[],
  monthlyRent: number,
  paydayDay: number,
): Promise<Notification | null> {
  const today = new Date()
  const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)

  // Check rent
  const rentDay = 1
  const rentThisMonth = new Date(today.getFullYear(), today.getMonth(), rentDay)
  if (rentDay >= today.getDate() && rentDay <= in3Days.getDate() && monthlyRent > 0) {
    const daysUntil = rentDay - today.getDate()
    return {
      title: 'Pulse — Räkningspåminnelse',
      body: `Hyran på ${monthlyRent.toLocaleString('sv-SE')} kr drar om ${daysUntil === 0 ? 'idag' : `${daysUntil} dag${daysUntil > 1 ? 'ar' : ''}`}. Se till att det finns täckning.`,
    }
  }

  // Check subscriptions due soon
  for (const sub of subscriptions) {
    if (sub.amount < 30) continue
    const lastCharged = new Date(sub.lastCharged)
    const nextExpected = new Date(lastCharged.getTime() + 30 * 24 * 60 * 60 * 1000)
    const daysUntil = Math.round((nextExpected.getTime() - today.getTime()) / 86400000)

    if (daysUntil >= 0 && daysUntil <= 3) {
      return {
        title: 'Pulse — Kommande uttag',
        body: `${sub.merchant} drar troligen ${sub.amount.toLocaleString('sv-SE')} kr om ${daysUntil === 0 ? 'idag' : `${daysUntil} dag${daysUntil > 1 ? 'ar' : ''}`}. Fortfarande i användning?`,
      }
    }
  }

  return null
}

// 9. Best week record: this week is the cheapest in 12 weeks
export async function bestWeekRecord(userId: string): Promise<Notification | null> {
  const today = new Date()
  // Only calculate if we're at least Wed (enough of the week to be meaningful) or later
  if (today.getDay() < 3 && today.getDay() !== 0) return null

  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)

  const thisWeekAgg = await prisma.transaction.aggregate({
    where: { userId, isIncome: false, date: { gte: monday }, NOT: { category: 'hyra' } },
    _sum: { amount: true },
  })
  const thisWeekTotal = Math.abs(thisWeekAgg._sum.amount ?? 0)
  if (thisWeekTotal < 50) return null

  // Get spending for each of the previous 11 weeks
  const weekTotals: number[] = []
  for (let w = 1; w <= 11; w++) {
    const wStart = new Date(monday.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    const agg = await prisma.transaction.aggregate({
      where: { userId, isIncome: false, date: { gte: wStart, lte: wEnd }, NOT: { category: 'hyra' } },
      _sum: { amount: true },
    })
    const total = Math.abs(agg._sum.amount ?? 0)
    if (total > 50) weekTotals.push(total)
  }

  if (weekTotals.length < 4) return null

  const minPrevious = weekTotals.reduce((m, v) => Math.min(m, v), Infinity)
  const avgPrevious = weekTotals.reduce((s, v) => s + v, 0) / weekTotals.length

  // This week is at least 15% below the average and lower than all previous weeks
  if (thisWeekTotal < minPrevious * 0.9 && thisWeekTotal < avgPrevious * 0.85) {
    const savedVsAvg = Math.round(avgPrevious - thisWeekTotal)
    const weeks = weekTotals.length
    return {
      title: 'Pulse — Bästa veckan',
      body: `Den här veckan är din billigaste på ${weeks} veckor — ${thisWeekTotal.toLocaleString('sv-SE')} kr mot snitt ${Math.round(avgPrevious).toLocaleString('sv-SE')} kr. ${savedVsAvg.toLocaleString('sv-SE')} kr under normalt. Håll i.`,
    }
  }
  return null
}

// Unreimbursed outlay alert: utlägg tagged more than 3 days ago with no matching återbetalning
export async function unreimbursedOutlayAlert(userId: string): Promise<Notification | null> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // Find utlägg transactions older than 3 days
  const outlays = await prisma.transaction.findMany({
    where: { userId, category: 'utlägg', isIncome: false, date: { gte: thirtyDaysAgo, lte: threeDaysAgo } },
    select: { id: true, merchant: true, amount: true, date: true },
    orderBy: { date: 'desc' },
  })
  if (outlays.length === 0) return null

  // For each outlay, check if there's a matching återbetalning within ±10% amount and ±7 days after
  const unmatched: typeof outlays = []
  for (const outlay of outlays) {
    const outlayAmt = Math.abs(outlay.amount)
    const windowEnd = new Date(outlay.date.getTime() + 14 * 24 * 60 * 60 * 1000)
    const match = await prisma.transaction.findFirst({
      where: {
        userId,
        category: 'återbetalning',
        isIncome: true,
        date: { gte: outlay.date, lte: windowEnd },
        amount: { gte: outlayAmt * 0.9, lte: outlayAmt * 1.1 },
      },
    })
    if (!match) unmatched.push(outlay)
  }

  if (unmatched.length === 0) return null

  const totalUnmatched = unmatched.reduce((s, o) => s + Math.abs(o.amount), 0)

  if (unmatched.length === 1) {
    const o = unmatched[0]
    const daysAgo = Math.round((Date.now() - new Date(o.date).getTime()) / 86400000)
    return {
      title: 'Pulse — Oåterbetalt utlägg',
      body: `${Math.round(Math.abs(o.amount)).toLocaleString('sv-SE')} kr på ${o.merchant} för ${daysAgo} dagar sedan — fortfarande oåterbetalt.`,
    }
  }

  return {
    title: 'Pulse — Oåterbetalda utlägg',
    body: `Du har ${unmatched.length} oåterbetalda utlägg på totalt ${Math.round(totalUnmatched).toLocaleString('sv-SE')} kr.`,
  }
}

// Reimbursement match suggestion: incoming money matches a recent utlägg
export async function reimbursementMatchSuggestion(userId: string): Promise<Notification | null> {
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

  // Recent uncategorized or inkomst-tagged income (possible återbetalning)
  const recentIncoming = await prisma.transaction.findMany({
    where: {
      userId, isIncome: true, date: { gte: fortyEightHoursAgo },
      OR: [{ category: { in: ['inkomst', 'övrigt'] } }, { category: null }],
      amount: { lt: 15000 }, // exclude salary
    },
    select: { id: true, merchant: true, amount: true, date: true },
  })
  if (recentIncoming.length === 0) return null

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  for (const incoming of recentIncoming) {
    const incomingAmt = Math.abs(incoming.amount)
    if (incomingAmt < 50) continue

    // Look for a matching utlägg of similar amount in the last 30 days
    const matchingOutlay = await prisma.transaction.findFirst({
      where: {
        userId, category: 'utlägg', isIncome: false, date: { gte: thirtyDaysAgo },
        amount: { lte: -(incomingAmt * 0.9), gte: -(incomingAmt * 1.1) },
      },
      orderBy: { date: 'desc' },
    })

    if (matchingOutlay) {
      return {
        title: 'Pulse — Återbetalning?',
        body: `Du fick ${incomingAmt.toLocaleString('sv-SE')} kr — stämmer det med utlägget på ${Math.abs(matchingOutlay.amount).toLocaleString('sv-SE')} kr hos ${matchingOutlay.merchant}? Kategorisera som "återbetalning" om ja.`,
      }
    }
  }
  return null
}
