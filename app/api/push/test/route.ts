import { NextRequest, NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/push'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })

  if (subs.length === 0) {
    return NextResponse.json({ error: 'Ingen push-prenumeration registrerad för ditt konto' }, { status: 400 })
  }

  try {
    await sendPushNotification('Pulse — Test 🔔', 'Push-notiser fungerar!', userId)
    return NextResponse.json({ ok: true, subscriptions: subs.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
