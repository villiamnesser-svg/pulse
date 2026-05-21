import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const profile = await prisma.userProfile.findFirst({ where: { userId } })
    return NextResponse.json(profile ?? null)
  } catch (err) {
    console.error('Profile GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const body = (await req.json()) as {
      name?: string; age?: number; occupation?: string
      financialGoal?: string; savingsTarget?: number; paydayDay?: number; monthlyRent?: number
    }

    const existing = await prisma.userProfile.findFirst({ where: { userId } })

    if (existing) {
      const updated = await prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.age !== undefined && { age: body.age }),
          ...(body.occupation !== undefined && { occupation: body.occupation }),
          ...(body.financialGoal !== undefined && { financialGoal: body.financialGoal }),
          ...(body.savingsTarget !== undefined && { savingsTarget: body.savingsTarget }),
          ...(body.paydayDay !== undefined && { paydayDay: body.paydayDay }),
          ...(body.monthlyRent !== undefined && { monthlyRent: body.monthlyRent }),
        },
      })
      return NextResponse.json(updated)
    } else {
      const created = await prisma.userProfile.create({
        data: {
          userId,
          name: body.name,
          age: body.age,
          occupation: body.occupation,
          financialGoal: body.financialGoal,
          savingsTarget: body.savingsTarget,
          paydayDay: body.paydayDay ?? 25,
          monthlyRent: body.monthlyRent ?? 8500,
        },
      })
      return NextResponse.json(created)
    }
  } catch (err) {
    console.error('Profile POST error:', err)
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    const body = (await req.json()) as Record<string, unknown>
    const profile = await prisma.userProfile.findFirst({ where: { userId } })
    if (profile) {
      await prisma.userProfile.update({ where: { id: profile.id }, data: body })
    } else {
      await prisma.userProfile.create({ data: { userId, ...(body as object) } as Parameters<typeof prisma.userProfile.create>[0]['data'] })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Profile PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
