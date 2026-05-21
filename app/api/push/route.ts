import { NextRequest, NextResponse } from 'next/server'
import { savePushSubscription } from '@/lib/push'
import { getUserId } from '@/lib/auth'

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null
  return NextResponse.json({ publicKey })
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const sub = (await req.json()) as PushSubscriptionJSON
    await savePushSubscription(sub, userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Push subscription error:', err)
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }
}
