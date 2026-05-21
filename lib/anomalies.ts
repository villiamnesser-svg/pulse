import { prisma } from './db'

export interface Anomaly {
  merchant: string
  amount: number
  date: Date
  reason: 'new_merchant' | 'unusually_large' | 'multiple_same_day'
  context: string
}

export async function detectAnomalies(userId = 'local'): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = []
  const since3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const recentTx = await prisma.transaction.findMany({
    where: { userId, date: { gte: since3d }, isIncome: false },
    orderBy: { date: 'desc' },
  })
  if (recentTx.length === 0) return []

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const historicalTx = await prisma.transaction.findMany({
    where: { userId, date: { gte: since90d, lt: since3d }, isIncome: false },
    select: { merchant: true, amount: true },
  })

  const merchantHistory = new Map<string, { total: number; count: number }>()
  for (const tx of historicalTx) {
    const existing = merchantHistory.get(tx.merchant) ?? { total: 0, count: 0 }
    merchantHistory.set(tx.merchant, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
  }

  const historicalMerchants = new Set(historicalTx.map((t) => t.merchant))

  for (const tx of recentTx) {
    const amount = Math.abs(tx.amount)
    if (amount < 100) continue
    const history = merchantHistory.get(tx.merchant)

    if (!historicalMerchants.has(tx.merchant) && amount >= 300) {
      anomalies.push({ merchant: tx.merchant, amount, date: tx.date, reason: 'new_merchant',
        context: `Ovanlig transaktion: ${amount.toLocaleString('sv-SE')} kr hos ${tx.merchant} — du har aldrig handlat där innan. Var det du?` })
      continue
    }
    if (history && history.count >= 2) {
      const avg = history.total / history.count
      if (amount > avg * 2 && amount > 300) {
        const mult = Math.round((amount / avg) * 10) / 10
        anomalies.push({ merchant: tx.merchant, amount, date: tx.date, reason: 'unusually_large',
          context: `${tx.merchant}: ${amount.toLocaleString('sv-SE')} kr — ditt snitt är ${Math.round(avg).toLocaleString('sv-SE')} kr (${mult}x normalt)` })
      }
    }
  }

  const sameDayGroups = new Map<string, typeof recentTx>()
  for (const tx of recentTx) {
    const key = `${tx.merchant}_${tx.date.toISOString().slice(0, 10)}`
    const group = sameDayGroups.get(key) ?? []
    group.push(tx)
    sameDayGroups.set(key, group)
  }

  for (const [, group] of sameDayGroups.entries()) {
    if (group.length >= 3) {
      const total = group.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      if (total >= 500) {
        anomalies.push({ merchant: group[0].merchant, amount: total, date: group[0].date, reason: 'multiple_same_day',
          context: `${group[0].merchant}: ${group.length} transaktioner på en dag, totalt ${Math.round(total).toLocaleString('sv-SE')} kr` })
      }
    }
  }

  const seen = new Set<string>()
  return anomalies.filter((a) => { if (seen.has(a.merchant)) return false; seen.add(a.merchant); return true })
}
