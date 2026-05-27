import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { createRequisition, deleteRequisition } from '@/lib/nordigen'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const { searchParams } = req.nextUrl
    const institutionId = searchParams.get('institution')
    const source = searchParams.get('source') ?? 'settings'

    if (!institutionId) {
      return NextResponse.json({ error: 'institution param required' }, { status: 400 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse-xi-umber.vercel.app'
    const redirectUri = `${baseUrl}/api/bank/callback`

    // A stable reference we can use to find the user after the callback
    const reference = `${userId}|${source}|${Date.now()}`

    const requisition = await createRequisition(institutionId, redirectUri, reference)

    // Persist the pending connection so we can look it up in the callback
    await prisma.bankConnection.upsert({
      where: { requisitionId: requisition.id },
      update: { status: 'pending', institutionId, provider: 'nordigen' },
      create: {
        userId,
        requisitionId: requisition.id,
        institutionId,
        provider: 'nordigen',
        status: 'pending',
        accountIds: '[]',
        keys: '{}',
      },
    })

    return NextResponse.json({ url: requisition.link })
  } catch (err) {
    console.error('Bank connect error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const connections = await prisma.bankConnection.findMany({ where: { userId } })

    // Tell Nordigen to revoke the requisitions (best-effort)
    for (const conn of connections) {
      if (conn.provider === 'nordigen') {
        await deleteRequisition(conn.requisitionId)
      }
    }

    await prisma.bankConnection.deleteMany({ where: { userId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
