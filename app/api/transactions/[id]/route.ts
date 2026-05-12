import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await req.json()) as { note?: string; category?: string }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        ...(body.note !== undefined && { note: body.note }),
        ...(body.category !== undefined && { category: body.category }),
      },
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

    return NextResponse.json(updated)
  } catch (err) {
    console.error('Transaction update error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
