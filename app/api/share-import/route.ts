import { NextRequest, NextResponse } from 'next/server'
import { parseSwedbank as parseCSV } from '@/lib/parser'
import { categorizeBatch } from '@/lib/categorizer'
import { prisma } from '@/lib/db'
import { analyzeNewTransactions } from '@/lib/habits'
import { sendPushNotification } from '@/lib/push'
import { getUserId } from '@/lib/auth'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const contentType = req.headers.get('content-type') ?? ''

    let csvText = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('csv') ?? formData.get('file') ?? formData.get('files')
      if (!file || typeof file === 'string') {
        return NextResponse.redirect(new URL('/upload?error=no-file', req.url))
      }
      csvText = await (file as File).text()
    } else {
      csvText = await req.text()
    }

    if (!csvText.trim()) return NextResponse.redirect(new URL('/upload?error=empty', req.url))

    const parsed = parseCSV(csvText)
    if (parsed.length === 0) return NextResponse.redirect(new URL('/upload?error=parse', req.url))

    const categorized = await categorizeBatch(parsed, userId)

    let imported = 0
    let skipped = 0
    const newOnes = []

    for (const tx of categorized) {
      try {
        const result = await prisma.transaction.upsert({
          where: { id: tx.id },
          update: {},
          create: { id: tx.id, userId, date: tx.date, merchant: tx.merchant, amount: tx.amount, balance: tx.balance, category: tx.category, isIncome: tx.isIncome },
        })
        imported++
        newOnes.push(result)
      } catch {
        skipped++
      }
    }

    if (imported > 0) {
      try {
        const observation = await analyzeNewTransactions(newOnes as Parameters<typeof analyzeNewTransactions>[0], userId)
        if (observation) {
          await sendPushNotification('Pulse — Import klar', observation, userId)
        }
      } catch {}
    }

    return NextResponse.redirect(new URL(`/?imported=${imported}`, req.url))
  } catch (err) {
    console.error('Share import error:', err)
    return NextResponse.redirect(new URL('/upload?error=failed', req.url))
  }
}
