import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const connection = await prisma.bankConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, lastSyncedAt: true, institutionId: true, createdAt: true },
    })
    return NextResponse.json({ connection })
  } catch {
    return NextResponse.json({ connection: null })
  }
}
