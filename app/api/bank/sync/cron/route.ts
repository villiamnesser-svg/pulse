import { NextRequest, NextResponse } from 'next/server'
import { getRequisition, getAccountTransactions, txToLocal } from '@/lib/nordigen'
import { categorizeBatch } from '@/lib/categorizer'
import { prisma } from '@/lib/db'

export const maxDuration = 300 // 5 min — syncs all users

function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function syncNordigenUser(conn: {
  id: string
  userId: string
  requisitionId: string
  accountIds: string
  lastSyncedAt: Date | null
}): Promise<{ imported: number; skipped: number; error?: string }> {
  // Verify requisition is still linked
  let accountIds: string[] = JSON.parse(conn.accountIds || '[]')

  try {
    const requisition = await getRequisition(conn.requisitionId)
    if (requisition.status !== 'LN') {
      await prisma.bankConnection.update({
        where: { id: conn.id },
        data: { status: 'needs_reauth' },
      }).catch(() => null)
      return { imported: 0, skipped: 0, error: `Requisition status: ${requisition.status}` }
    }
    if (requisition.accounts.length > 0) {
      accountIds = requisition.accounts
      await prisma.bankConnection.update({
        where: { id: conn.id },
        data: { accountIds: JSON.stringify(accountIds) },
      }).catch(() => null)
    }
  } catch (err) {
    const msg = String(err)
    if (msg.includes('404')) {
      await prisma.bankConnection.update({
        where: { id: conn.id },
        data: { status: 'needs_reauth' },
      }).catch(() => null)
      return { imported: 0, skipped: 0, error: 'Requisition not found — needs re-auth' }
    }
    // Nordigen might be temporarily unavailable — skip this user
    return { imported: 0, skipped: 0, error: `getRequisition failed: ${msg}` }
  }

  if (accountIds.length === 0) {
    return { imported: 0, skipped: 0, error: 'No account IDs' }
  }

  // Fetch with 3-day overlap to avoid gaps at midnight
  const dateFrom = conn.lastSyncedAt
    ? new Date(conn.lastSyncedAt.getTime() - 86400 * 1000 * 3).toISOString().slice(0, 10)
    : new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)

  const rawTxs: ReturnType<typeof txToLocal>[] = []

  for (const accountId of accountIds) {
    try {
      const nordigenTxs = await getAccountTransactions(accountId, dateFrom)
      for (let i = 0; i < nordigenTxs.length; i++) {
        const tx = nordigenTxs[i]
        const fallbackId = `ng-${accountId.slice(-6)}-${tx.bookingDate}-${i}`
        rawTxs.push(txToLocal(tx, fallbackId))
      }
    } catch (err) {
      console.error(`[cron] getAccountTransactions ${accountId}:`, err)
    }
  }

  if (rawTxs.length === 0) {
    await prisma.bankConnection.update({
      where: { id: conn.id },
      data: { lastSyncedAt: new Date() },
    }).catch(() => null)
    return { imported: 0, skipped: 0 }
  }

  const toCategorize = rawTxs.map(t => ({ ...t, balance: 0 }))
  const categorized = await categorizeBatch(toCategorize, conn.userId)

  let imported = 0
  let skipped = 0

  for (const tx of categorized) {
    try {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        update: {},
        create: {
          id: tx.id,
          userId: conn.userId,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          balance: 0,
          isIncome: tx.isIncome,
          category: tx.category,
        },
      })
      imported++
    } catch {
      skipped++
    }
  }

  await prisma.bankConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date() },
  }).catch(() => null)

  return { imported, skipped }
}

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connections = await prisma.bankConnection.findMany({
    where: { status: 'linked', provider: 'nordigen' },
    select: { id: true, userId: true, requisitionId: true, accountIds: true, lastSyncedAt: true },
  })

  if (connections.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'No linked Nordigen connections' })
  }

  const results: Record<string, { imported: number; skipped: number; error?: string }> = {}

  for (const conn of connections) {
    try {
      results[conn.userId] = await syncNordigenUser(conn)
    } catch (err) {
      results[conn.userId] = { imported: 0, skipped: 0, error: String(err) }
    }
  }

  const totalImported = Object.values(results).reduce((s, r) => s + r.imported, 0)
  const totalErrors = Object.values(results).filter(r => r.error).length

  console.log(`[cron-sync] ${connections.length} users — ${totalImported} new txs, ${totalErrors} errors`)

  return NextResponse.json({ ok: true, synced: connections.length, totalImported, results })
}
