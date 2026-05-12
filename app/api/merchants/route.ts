import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const aliases = await prisma.merchantAlias.findMany({
      orderBy: { merchant: 'asc' },
    })
    return NextResponse.json(aliases)
  } catch (err) {
    console.error('Merchants GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch merchants' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      merchant: string
      displayName: string
      explanation?: string
    }

    if (!body.merchant || !body.displayName) {
      return NextResponse.json({ error: 'merchant and displayName are required' }, { status: 400 })
    }

    const alias = await prisma.merchantAlias.upsert({
      where: { merchant: body.merchant },
      update: {
        displayName: body.displayName,
        ...(body.explanation !== undefined && { explanation: body.explanation }),
      },
      create: {
        merchant: body.merchant,
        displayName: body.displayName,
        explanation: body.explanation,
      },
    })

    return NextResponse.json(alias)
  } catch (err) {
    console.error('Merchants POST error:', err)
    return NextResponse.json({ error: 'Failed to save merchant alias' }, { status: 500 })
  }
}
