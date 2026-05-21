import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const aliases = await prisma.merchantAlias.findMany({
      where: { userId },
      orderBy: { merchant: 'asc' },
    })
    return NextResponse.json(aliases)
  } catch (err) {
    console.error('Merchants GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const body = (await req.json()) as { merchant: string; displayName: string; explanation?: string }

    if (!body.merchant || !body.displayName) {
      return NextResponse.json({ error: 'merchant and displayName are required' }, { status: 400 })
    }

    const alias = await prisma.merchantAlias.upsert({
      where: { userId_merchant: { userId, merchant: body.merchant } },
      update: {
        displayName: body.displayName,
        ...(body.explanation !== undefined && { explanation: body.explanation }),
      },
      create: { userId, merchant: body.merchant, displayName: body.displayName, explanation: body.explanation },
    })

    return NextResponse.json(alias)
  } catch (err) {
    console.error('Merchants POST error:', err)
    return NextResponse.json({ error: 'Failed to save merchant alias' }, { status: 500 })
  }
}
