import { NextRequest, NextResponse } from 'next/server'
import { fetchTransactions, fetchAccounts, refreshUserToken, tinkAmountToFloat } from '@/lib/tink'
import { categorizeBatch } from '@/lib/categorizer'
import { prisma } from '@/lib/db'
import { getUserId } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)

    const connection = await prisma.bankConnection.findFirst({
      where: { userId, status: 'linked' },
      orderBy: { createdAt: 'desc' },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Ingen aktiv bankkoppling' }, { status: 404 })
    }

    const { access_token, refresh_token } = JSON.parse(connection.keys || '{}') as {
      access_token: string
      refresh_token: string
    }

    // Refresh token to ensure it's valid
    let activeToken = access_token
    try {
      const refreshed = await refreshUserToken(refresh_token)
      activeToken = refreshed.access_token
      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: { keys: JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token }) },
      })
    } catch {
      // Refresh failed — existing token may still work, but if not we'll catch it below
      console.warn('Token refresh failed, trying existing token')
    }

    let accountIds: string[] = JSON.parse(connection.accountIds || '[]')
    if (accountIds.length === 0) {
      const accounts = await fetchAccounts(activeToken)
      accountIds = accounts.map(a => a.id)
      await prisma.bankConnection.update({
        where: { id: connection.id },
        data: { accountIds: JSON.stringify(accountIds) },
      })
    }

    // Collect all raw transactions first
    const rawTxs: { id: string; merchant: string; amount: number; date: Date; isIncome: boolean }[] = []
    let pageToken: string | undefined

    do {
      const { transactions, nextPageToken } = await fetchTransactions(activeToken, accountIds, pageToken)
      pageToken = nextPageToken

      for (const tx of transactions) {
        if (tx.status !== 'BOOKED') continue
        const amount = tinkAmountToFloat(tx.amount)
        const merchant = tx.descriptions.display || tx.descriptions.original || 'Okänd'
        rawTxs.push({ id: tx.id, merchant, amount, date: new Date(tx.dates.booked), isIncome: amount > 0 })
      }
    } while (pageToken)

    // Categorize in batch
    const toCategorize = rawTxs.map(t => ({ id: t.id, date: t.date, merchant: t.merchant, amount: t.amount, balance: 0, isIncome: t.isIncome }))
    const categorized = await categorizeBatch(toCategorize, userId)

    // Upsert all transactions
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
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    })

    return NextResponse.json({ ok: true, imported, skipped })
  } catch (err) {
    const errMsg = String(err)
    console.error('Bank sync error:', err)
    // If it's an auth error, mark connection as needing re-auth
    if (errMsg.includes('401') || errMsg.includes('UNAUTHORIZED') || errMsg.includes('token')) {
      const userId = await getUserId(req).catch(() => null)
      if (userId) {
        await prisma.bankConnection.updateMany({
          where: { userId, status: 'linked' },
          data: { status: 'needs_reauth' },
        }).catch(() => null)
      }
      return NextResponse.json({ error: 'Bankkopplingen har gått ut — koppla om din bank i Inställningar.' }, { status: 401 })
    }
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return POST(req)
}
