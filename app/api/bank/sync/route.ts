import { NextRequest, NextResponse } from 'next/server'
import { getRequisition, getAccountTransactions, getAccountBalance, txToLocal } from '@/lib/nordigen'
import { categorizeBatch } from '@/lib/categorizer'
import { prisma } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)

    const connection = await prisma.bankConnection.findFirst({
      where: { userId, status: 'linked', provider: 'nordigen' },
      orderBy: { createdAt: 'desc' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Ingen aktiv Nordigen-koppling', ok: false }, { status: 404 })
    }

    // Verify requisition is still active
    let accountIds: string[] = JSON.parse(connection.accountIds || '[]')
    try {
      const req2 = await getRequisition(connection.requisitionId)
      if (req2.status !== 'LN') {
        await prisma.bankConnection.update({
          where: { id: connection.id },
          data: { status: 'needs_reauth' },
        })
        return NextResponse.json({ ok: false, error: 'Bankkopplingen har gått ut — koppla om din bank.' }, { status: 401 })
      }
      // Refresh account IDs from requisition in case they changed
      if (req2.accounts.length > 0) {
        accountIds = req2.accounts
        await prisma.bankConnection.update({
          where: { id: connection.id },
          data: { accountIds: JSON.stringify(accountIds) },
        })
      }
    } catch (err) {
      const msg = String(err)
      if (msg.includes('404') || msg.includes('not_found')) {
        await prisma.bankConnection.update({
          where: { id: connection.id },
          data: { status: 'needs_reauth' },
        })
        return NextResponse.json({ ok: false, error: 'Bankkopplingen hittades inte — koppla om.' }, { status: 401 })
      }
      // Nordigen might be temporarily down — continue with stored account IDs
      console.warn('Could not verify requisition, using cached account IDs:', err)
    }

    if (accountIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Inga konton kopplade' }, { status: 400 })
    }

    // Fetch from last sync date (or 90 days back)
    const dateFrom = connection.lastSyncedAt
      ? new Date(connection.lastSyncedAt.getTime() - 86400 * 1000 * 3).toISOString().slice(0, 10)  // 3-day overlap
      : new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10)

    const rawTxs: ReturnType<typeof txToLocal>[] = []

    for (const accountId of accountIds) {
      const nordigenTxs = await getAccountTransactions(accountId, dateFrom)
      for (let i = 0; i < nordigenTxs.length; i++) {
        const tx = nordigenTxs[i]
        const fallbackId = `ng-${accountId.slice(-6)}-${tx.bookingDate}-${i}`
        rawTxs.push(txToLocal(tx, fallbackId))
      }
    }

    // Get balance from first account
    let balance = 0
    if (accountIds.length > 0) {
      balance = await getAccountBalance(accountIds[0])
    }

    // Categorize
    const toCategorize = rawTxs.map(t => ({ ...t, balance: 0 }))
    const categorized = await categorizeBatch(toCategorize, userId)

    let imported = 0
    let skipped = 0

    for (const tx of categorized) {
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
            balance,
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
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    })

    return NextResponse.json({ ok: true, imported, skipped })
  } catch (err) {
    const msg = String(err)
    console.error('Bank sync error:', err)
    if (msg.includes('401') || msg.toLowerCase().includes('unauthorized')) {
      const userId = await getUserId(req).catch(() => null)
      if (userId) {
        await prisma.bankConnection.updateMany({
          where: { userId, status: 'linked' },
          data: { status: 'needs_reauth' },
        }).catch(() => null)
      }
      return NextResponse.json({ ok: false, error: 'Bankkopplingen har gått ut — koppla om din bank.' }, { status: 401 })
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
