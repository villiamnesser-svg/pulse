import { NextRequest, NextResponse } from 'next/server'
import { parseCSV } from '@/lib/parser'
import { categorizeBatch } from '@/lib/categorizer'
import { updateBaseline } from '@/lib/baseline'
import { calculateVelocity } from '@/lib/velocity'
import { sendPushNotification } from '@/lib/push'
import { analyzeNewTransactions } from '@/lib/habits'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId }

    if (month) {
      const [year, mon] = month.split('-').map(Number)
      const start = new Date(year, mon - 1, 1)
      const end = new Date(year, mon, 1)
      where.date = { gte: start, lt: end }
    }

    if (category) where.category = category

    if (search) {
      where.OR = [
        { merchant: { contains: search } },
        { note: { contains: search } },
      ]
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      select: { id: true, date: true, merchant: true, amount: true, balance: true, category: true, isIncome: true, note: true, createdAt: true },
    })

    return NextResponse.json(transactions)
  } catch (err) {
    console.error('Transaction fetch error:', err)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const contentType = req.headers.get('content-type') ?? ''

    let csvText = ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') ?? formData.get('csv')
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      csvText = await (file as File).text()
    } else {
      csvText = await req.text()
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'No CSV data provided' }, { status: 400 })
    }

    const { transactions: parsed, bank: detectedBank } = parseCSV(csvText)
    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Inga transaktioner hittades i filen. Kontrollera att det är en CSV-fil från din bank.' }, { status: 400 })
    }

    const categorized = await categorizeBatch(parsed, userId)

    let imported = 0
    let skipped = 0

    for (const tx of categorized) {
      try {
        await prisma.transaction.upsert({
          where: { id: tx.id },
          update: {},
          create: {
            id: tx.id, userId, date: tx.date, merchant: tx.merchant,
            amount: tx.amount, balance: tx.balance, category: tx.category, isIncome: tx.isIncome,
          },
        })
        imported++
      } catch {
        skipped++
      }
    }

    if (imported > 0) {
      ;(async () => {
        try {
          updateBaseline(userId).catch(() => {})
          const velocity = await calculateVelocity(userId)
          const newExpenses = categorized.filter(t => !t.isIncome)
          const observation = await analyzeNewTransactions(newExpenses)

          const pushTitle = observation ? 'Pulse — Nytt köp'
            : velocity.level === 'CRITICAL' ? 'Pulse — Varning'
            : velocity.level === 'WARNING' ? 'Pulse — Notering'
            : 'Pulse — Importerat'
          const pushBody = observation ?? `${imported} nya transaktioner. ${velocity.message}`

          await prisma.insight.create({
            data: {
              userId,
              type: observation ? 'anomaly' : (velocity.level === 'SAFE' ? 'positive' : 'velocity'),
              message: pushBody,
              data: JSON.stringify({ level: velocity.level, imported }),
            },
          })
          await sendPushNotification(pushTitle, pushBody, userId)
        } catch (err) {
          console.error('Post-import analysis error:', err)
        }
      })()
    }

    return NextResponse.json({ imported, skipped, bank: detectedBank })
  } catch (err) {
    console.error('Transaction import error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
