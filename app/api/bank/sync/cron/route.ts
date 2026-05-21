import { NextRequest, NextResponse } from 'next/server'
import { fetchTransactions, fetchAccounts, refreshUserToken, tinkAmountToFloat } from '@/lib/tink'
import { categorizeBatch } from '@/lib/categorizer'
import { prisma } from '@/lib/db'

export const maxDuration = 300 // 5 min — we sync all users

// Vercel cron calls this endpoint. Verify via CRON_SECRET to block spoofed requests.
function isCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // No secret configured → allow (dev mode)
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

async function syncUser(userId: string, connectionId: string, keys: string, accountIds: string[]): Promise<{ imported: number; skipped: number; error?: string }> {
  const { access_token, refresh_token } = JSON.parse(keys) as {
    access_token: string
    refresh_token: string
  }

  let activeToken = access_token
  let newKeys = keys

  try {
    const refreshed = await refreshUserToken(refresh_token)
    activeToken = refreshed.access_token
    newKeys = JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token })
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: { keys: newKeys },
    })
  } catch {
    console.warn(`[cron-sync] Token refresh failed for connection ${connectionId}, trying existing token`)
  }

  // Fetch account IDs if not stored
  let ids = accountIds
  if (ids.length === 0) {
    try {
      const accounts = await fetchAccounts(activeToken)
      ids = accounts.map(a => a.id)
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: { accountIds: JSON.stringify(ids) },
      })
    } catch (err) {
      return { imported: 0, skipped: 0, error: `fetchAccounts failed: ${String(err)}` }
    }
  }

  // Collect all BOOKED transactions via pagination
  const rawTxs: { id: string; merchant: string; amount: number; date: Date; isIncome: boolean }[] = []
  let pageToken: string | undefined

  try {
    do {
      const { transactions, nextPageToken } = await fetchTransactions(activeToken, ids, pageToken)
      pageToken = nextPageToken

      for (const tx of transactions) {
        if (tx.status !== 'BOOKED') continue
        const amount = tinkAmountToFloat(tx.amount)
        const merchant = tx.descriptions.display || tx.descriptions.original || 'Okänd'
        rawTxs.push({ id: tx.id, merchant, amount, date: new Date(tx.dates.booked), isIncome: amount > 0 })
      }
    } while (pageToken)
  } catch (err) {
    // If token invalid, mark for re-auth
    const errMsg = String(err)
    if (errMsg.includes('401') || errMsg.toLowerCase().includes('unauthorized') || errMsg.includes('token')) {
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: { status: 'needs_reauth' },
      }).catch(() => null)
      return { imported: 0, skipped: 0, error: 'Token invalid — needs re-auth' }
    }
    return { imported: 0, skipped: 0, error: `fetchTransactions failed: ${errMsg}` }
  }

  if (rawTxs.length === 0) {
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    })
    return { imported: 0, skipped: 0 }
  }

  // Categorize in batch
  const toCategorize = rawTxs.map(t => ({
    id: t.id, date: t.date, merchant: t.merchant, amount: t.amount, balance: 0, isIncome: t.isIncome,
  }))
  const categorized = await categorizeBatch(toCategorize, userId)

  let imported = 0
  let skipped = 0

  for (let i = 0; i < rawTxs.length; i++) {
    const tx = rawTxs[i]
    const category = categorized[i]?.category ?? 'övrigt'

    try {
      await prisma.transaction.upsert({
        where: { id: tx.id },
        update: {},
        create: {
          id: tx.id,
          userId,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          balance: 0,
          isIncome: tx.isIncome,
          category,
        },
      })
      imported++
    } catch {
      skipped++
    }
  }

  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() },
  })

  return { imported, skipped }
}

export async function GET(req: NextRequest) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connections = await prisma.bankConnection.findMany({
    where: { status: 'linked' },
    select: { id: true, userId: true, keys: true, accountIds: true },
  })

  if (connections.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'No linked connections' })
  }

  const results: Record<string, { imported: number; skipped: number; error?: string }> = {}

  for (const conn of connections) {
    const accountIds: string[] = JSON.parse(conn.accountIds || '[]')
    try {
      results[conn.userId] = await syncUser(conn.userId, conn.id, conn.keys || '{}', accountIds)
    } catch (err) {
      results[conn.userId] = { imported: 0, skipped: 0, error: String(err) }
    }
  }

  const totalImported = Object.values(results).reduce((s, r) => s + r.imported, 0)
  const totalErrors = Object.values(results).filter(r => r.error).length

  console.log(`[cron-sync] Synced ${connections.length} users — ${totalImported} new txs, ${totalErrors} errors`)

  return NextResponse.json({ ok: true, synced: connections.length, totalImported, results })
}
