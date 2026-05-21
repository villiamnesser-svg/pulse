import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const insights = await prisma.insight.findMany({
      where: { userId, NOT: { type: { in: ['heartbeat-ping', 'claude-call', 'claude-chat'] } } },
      orderBy: { sentAt: 'desc' },
    })
    return NextResponse.json(insights)
  } catch (err) {
    console.error('Insights fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string }
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    await prisma.insight.update({ where: { id }, data: { read: true } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Mark read error:', err)
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 })
  }
}
