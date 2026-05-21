import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'E-post och lösenord krävs' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Fel e-post eller lösenord' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'Fel e-post eller lösenord' }, { status: 401 })
    }

    const token = await signToken({ userId: user.id, email: user.email })
    const res = NextResponse.json({ ok: true, name: user.name })
    res.cookies.set(sessionCookieOptions(token))
    return res
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Inloggning misslyckades' }, { status: 500 })
  }
}
