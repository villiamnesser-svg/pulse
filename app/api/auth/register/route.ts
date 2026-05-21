import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json() as { email: string; password: string; name?: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'E-post och lösenord krävs' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Lösenordet måste vara minst 8 tecken' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'E-postadressen används redan' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password: hashed, name },
    })

    // Migrate "local" data to this new user if this is the first real user
    const localCount = await prisma.transaction.count({ where: { userId: 'local' } })
    if (localCount > 0) {
      await Promise.all([
        prisma.transaction.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.baseline.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.insight.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.seasonalMemory.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.pushSubscription.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.userProfile.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.merchantAlias.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.bankConnection.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
        prisma.budget.updateMany({ where: { userId: 'local' }, data: { userId: user.id } }),
      ])
    }

    // Give every new user a 7-day free trial
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { isPremium: true, premiumUntil: trialEnds },
      create: { userId: user.id, isPremium: true, premiumUntil: trialEnds },
    })

    const token = await signToken({ userId: user.id, email: user.email })
    const res = NextResponse.json({ ok: true, name: user.name, trialDays: 7 })
    res.cookies.set(sessionCookieOptions(token))
    return res
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Register error:', msg)
    return NextResponse.json({ error: `Registrering misslyckades: ${msg}` }, { status: 500 })
  }
}
