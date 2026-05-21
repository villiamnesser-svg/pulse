import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  const records = await prisma.seasonalMemory.findMany({
    where: { userId },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
    select: { year: true, month: true, total: true },
  })
  return NextResponse.json(records)
}
