import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') ?? 'csv'
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: Record<string, unknown> = { userId }
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        date: true,
        merchant: true,
        amount: true,
        category: true,
        isIncome: true,
        note: true,
      },
    })

    if (format === 'csv') {
      const rows = [
        ['Datum', 'Mottagare/Avsändare', 'Belopp (kr)', 'Kategori', 'Typ', 'Anteckning'],
        ...transactions.map(t => [
          new Date(t.date).toLocaleDateString('sv-SE'),
          `"${t.merchant.replace(/"/g, '""')}"`,
          (t.amount).toFixed(2).replace('.', ','),
          t.category ?? 'övrigt',
          t.isIncome ? 'Inkomst' : 'Utgift',
          t.note ? `"${t.note.replace(/"/g, '""')}"` : '',
        ]),
      ]
      const csv = rows.map(r => r.join(';')).join('\n')
      const bom = '﻿' // UTF-8 BOM for Excel compatibility
      return new NextResponse(bom + csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="pulse-transaktioner-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      })
    }

    // JSON fallback
    return NextResponse.json({ transactions })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
