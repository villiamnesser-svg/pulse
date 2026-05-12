import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const records = await prisma.seasonalMemory.findMany({
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    select: { year: true, month: true, total: true },
  })
  return NextResponse.json(records)
}
