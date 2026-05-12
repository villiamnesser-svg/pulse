import { NextRequest, NextResponse } from 'next/server'
import { parseSwedbank } from '@/lib/parser'
import { categorizeBatch } from '@/lib/categorizer'
import { updateBaseline } from '@/lib/baseline'
import { calculateVelocity } from '@/lib/velocity'
import { sendPushNotification } from '@/lib/push'
import { analyzeNewTransactions } from '@/lib/habits'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // e.g. "2026-05"
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}

    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const start = new Date(year, mon - 1, 1)
      const end = new Date(year, mon, 1)
      where.date = { gte: start, lt: end }
    }

    if (category) {
      where.category = category
    }

    if (search) {
      where.OR = [
        { merchant: { contains: search } },
        { note: { contains: search } },
      ]
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        merchant: true,
        amount: true,
        balance: true,
        category: true,
        isIncome: true,
        note: true,
        createdAt: true,
      },
    })

    return NextResponse.json(transactions)
  } catch (err) {
    console.error('Transaction fetch error:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const csvText = await req.text()
    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })
    }

    const parsed = parseSwedbank(csvText)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No transactions found in CSV' }, { status: 400 })
    }

    const categorized = await categorizeBatch(parsed)

    let imported = 0
    let duplicates = 0

    for (const tx of categorized) {
      try {
        await prisma.transaction.create({
          data: {
            id: tx.id,
            date: tx.date,
            merchant: tx.merchant,
            amount: tx.amount,
            balance: tx.balance,
            category: tx.category,
            isIncome: tx.isIncome,
          },
        })
        imported++
      } catch {
        // Unique constraint violation = duplicate
        duplicates++
      }
    }

    // After successful import: smart analysis in background — don't block response
    if (imported > 0) {
      ;(async () => {
        try {
          updateBaseline().catch(() => {})
          const velocity = await calculateVelocity()

          // Check the new transactions for interesting observations
          const newExpenses = categorized.filter(t => !t.isIncome)
          const observation = await analyzeNewTransactions(newExpenses)

          let pushTitle: string
          let pushBody: string

          if (observation) {
            // Lead with the interesting finding
            pushTitle = 'Pulse — Nytt köp'
            pushBody = observation
          } else {
            // Fall back to velocity summary
            pushTitle = velocity.level === 'CRITICAL'
              ? 'Pulse — Varning'
              : velocity.level === 'WARNING'
              ? 'Pulse — Notering'
              : 'Pulse — Importerat'
            pushBody = `${imported} nya transaktioner. ${velocity.message}`
          }

          await prisma.insight.create({
            data: {
              type: observation ? 'anomaly' : (velocity.level === 'SAFE' ? 'positive' : 'velocity'),
              message: pushBody,
              data: JSON.stringify({ level: velocity.level, imported }),
            },
          })
          await sendPushNotification(pushTitle, pushBody)
        } catch (err) {
          console.error('Post-import analysis error:', err)
        }
      })()
    }

    return NextResponse.json({ imported, duplicates })
  } catch (err) {
    console.error('Transaction import error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
