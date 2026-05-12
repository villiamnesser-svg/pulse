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

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  if (!sub.endpoint || !sub.keys) throw new Error('Invalid push subscription')

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { keys: JSON.stringify(sub.keys) },
    create: {
      endpoint: sub.endpoint,
      keys: JSON.stringify(sub.keys),
    },
  })
}

export async function sendPushNotification(title: string, body: string): Promise<void> {
  const MAX_DAILY = parseInt(process.env.MAX_DAILY_INSIGHTS ?? '3', 10)

  // Check how many pushes sent today
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sentToday = await prisma.insight.count({
    where: {
      sentAt: { gte: today },
    },
  })

  if (sentToday >= MAX_DAILY) {
    console.log('Max daily push notifications reached')
    return
  }

  const subscriptions = await prisma.pushSubscription.findMany()

  const payload = JSON.stringify({ title, body })

  for (const sub of subscriptions) {
    try {
      const keys = JSON.parse(sub.keys) as { p256dh: string; auth: string }
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys,
        },
        payload
      )
    } catch (err) {
      console.error(`Failed to send push to ${sub.endpoint}:`, err)
      // Remove invalid subscriptions (410 Gone)
      const error = err as { statusCode?: number }
      if (error.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } })
      }
    }
  }
}
