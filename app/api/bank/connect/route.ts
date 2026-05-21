import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { createAuthUrl } from '@/lib/tink'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const source = req.nextUrl.searchParams.get('source') ?? 'settings'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const redirectUri = `${baseUrl}/api/bank/callback`
    // Encode source in state so callback knows where to redirect
    const stateParam = source === 'onboarding' ? `${userId}|onboarding` : userId
    const url = createAuthUrl(stateParam, redirectUri)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('Bank connect error:', err)
    return NextResponse.json({ error: 'Kunde inte skapa banklänk' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    await prisma.bankConnection.deleteMany({ where: { userId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
