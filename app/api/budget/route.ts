import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const budgets = await prisma.budget.findMany({ where: { userId } })
    return NextResponse.json(budgets)
  } catch (err) {
    console.error('Budget GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const body = (await req.json()) as { category: string; amount: number }

    if (!body.category || body.amount < 0) {
      return NextResponse.json({ error: 'category and amount required' }, { status: 400 })
    }

    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId, category: body.category } },
      update: { amount: body.amount },
      create: { userId, category: body.category, amount: body.amount },
    })

    return NextResponse.json(budget)
  } catch (err) {
    console.error('Budget POST error:', err)
    return NextResponse.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

    await prisma.budget.deleteMany({ where: { userId, category } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Budget DELETE error:', err)
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
