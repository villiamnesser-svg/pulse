import { prisma } from './db'

export interface Subscription {
  merchant: string
  amount: number
  lastCharged: Date
  monthsDetected: number
  isKnown: boolean
}

const KNOWN_SUBSCRIPTIONS = [
  'Spotify', 'Netflix', 'HBO', 'Adobe', 'Apple', 'Google', 'Microsoft',
  'Disney', 'Viaplay', 'C More', 'Storytel', 'Headspace', 'LinkedIn',
  'Dropbox', 'iCloud', 'YouTube',
]

function isSimilarAmount(a: number, b: number): boolean {
  return Math.abs(a - b) < 5 // within 5 SEK
}

function daysDiff(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
}

function isKnownSubscription(merchant: string): boolean {
  return KNOWN_SUBSCRIPTIONS.some((name) =>
    merchant.toLowerCase().includes(name.toLowerCase())
  )
}

export async function detectSubscriptions(): Promise<Subscription[]> {
  // Only look at last 6 months to keep this fast
  const since = new Date()
  since.setMonth(since.getMonth() - 6)
  const transactions = await prisma.transaction.findMany({
    where: { isIncome: false, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: { merchant: true, amount: true, date: true },
  })

  // Group by merchant
  const merchantMap = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    const existing = merchantMap.get(tx.merchant) ?? []
    existing.push(tx)
    merchantMap.set(tx.merchant, existing)
  }

  const subscriptions: Subscription[] = []

  for (const [merchant, txList] of merchantMap.entries()) {
    if (txList.length < 2) continue

    // Check for ~30-day recurring pattern
    let recurringCount = 0
    let lastAmount = txList[txList.length - 1].amount

    for (let i = 1; i < txList.length; i++) {
      const diff = daysDiff(txList[i].date, txList[i - 1].date)
      if (diff >= 25 && diff <= 35 && isSimilarAmount(txList[i].amount, txList[i - 1].amount)) {
        recurringCount++
        lastAmount = txList[i].amount
      }
    }

    if (recurringCount >= 1) {
      subscriptions.push({
        merchant,
        amount: Math.abs(lastAmount),
        lastCharged: txList[txList.length - 1].date,
        monthsDetected: recurringCount + 1,
        isKnown: isKnownSubscription(merchant),
      })
    }
  }

  return subscriptions.sort((a, b) => b.amount - a.amount)
}

// Returns subscriptions that were charged in the last 24 hours
export async function getChargedToday(): Promise<Subscription[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recentTx = await prisma.transaction.findMany({
    where: { date: { gte: since }, isIncome: false },
    orderBy: { date: 'desc' },
  })

  const all = await detectSubscriptions()
  const recentMerchants = new Set(recentTx.map((t) => t.merchant))
  return all.filter((s) => recentMerchants.has(s.merchant))
}
