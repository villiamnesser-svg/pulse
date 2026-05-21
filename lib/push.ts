import webPush from 'web-push'
import { prisma } from './db'

function initVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:villiamnesser@gmail.com'

  if (publicKey && privateKey) {
    webPush.setVapidDetails(subject, publicKey, privateKey)
  }
}

initVapid()

export async function savePushSubscription(sub: PushSubscriptionJSON, userId = 'local'): Promise<void> {
  if (!sub.endpoint || !sub.keys) throw new Error('Invalid push subscription')

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { keys: JSON.stringify(sub.keys), userId },
    create: { endpoint: sub.endpoint, keys: JSON.stringify(sub.keys), userId },
  })
}

export async function sendPushNotification(title: string, body: string, userId = 'local'): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })

  const payload = JSON.stringify({ title, body })

  for (const sub of subscriptions) {
    try {
      const keys = JSON.parse(sub.keys) as { p256dh: string; auth: string }
      await webPush.sendNotification({ endpoint: sub.endpoint, keys }, payload)
    } catch (err) {
      console.error(`Failed to send push to ${sub.endpoint}:`, err)
      const error = err as { statusCode?: number }
      if (error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } })
      }
    }
  }
}
