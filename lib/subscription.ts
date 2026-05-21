import { prisma } from './db'

/**
 * Returns true if the user has an active premium subscription.
 * Premium is active if isPremium=true AND (premiumUntil is null OR premiumUntil > now).
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const profile = await prisma.userProfile.findFirst({
    where: { userId },
    select: { isPremium: true, premiumUntil: true },
  })
  if (!profile?.isPremium) return false
  if (!profile.premiumUntil) return true // lifetime / never expires
  return profile.premiumUntil > new Date()
}

/**
 * Activate premium for a user.
 * daysFromNow: null = lifetime, number = expires after N days
 */
export async function activatePremium(userId: string, daysFromNow: number | null = null): Promise<void> {
  const premiumUntil = daysFromNow
    ? new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
    : null

  await prisma.userProfile.upsert({
    where: { userId },
    update: { isPremium: true, premiumUntil },
    create: { userId, isPremium: true, premiumUntil },
  })
}

export async function deactivatePremium(userId: string): Promise<void> {
  await prisma.userProfile.updateMany({
    where: { userId },
    data: { isPremium: false, premiumUntil: null },
  })
}
