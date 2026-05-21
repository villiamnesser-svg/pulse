import { prisma } from './db'

const MAX_AI_CALLS_PER_DAY = parseInt(process.env.MAX_AI_CALLS_PER_DAY ?? '10', 10)
const INTERNAL_TYPES = ['heartbeat-ping', 'claude-call']

export async function canCallAI(userId: string): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const count = await prisma.insight.count({
    where: { userId, type: 'claude-call', sentAt: { gte: todayStart } },
  })
  return count < MAX_AI_CALLS_PER_DAY
}

export async function recordAICall(userId: string): Promise<void> {
  await prisma.insight.create({
    data: { userId, type: 'claude-call', message: 'claude-api' },
  })
}

export { INTERNAL_TYPES }
