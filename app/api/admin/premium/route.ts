import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { activatePremium, deactivatePremium } from '@/lib/subscription'

// Simple admin secret — set ADMIN_SECRET in .env
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? ''

export async function POST(req: NextRequest) {
  try {
    const { secret, action, days } = (await req.json()) as {
      secret: string
      action: 'activate' | 'deactivate'
      days?: number
    }

    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = await getUserId(req)

    if (action === 'activate') {
      await activatePremium(userId, days ?? null)
      return NextResponse.json({ ok: true, message: `Premium aktiverat${days ? ` i ${days} dagar` : ' (livstid)'}` })
    }

    if (action === 'deactivate') {
      await deactivatePremium(userId)
      return NextResponse.json({ ok: true, message: 'Premium avaktiverat' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Admin premium error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
