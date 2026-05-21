import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'
import { isPremiumUser } from '@/lib/subscription'

// Use Haiku — 80% cheaper than Sonnet, still excellent for financial Q&A
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20000 })

const MAX_CHAT_PER_DAY = parseInt(process.env.MAX_CHAT_PER_DAY ?? '15', 10)
const MAX_CHAT_PER_MONTH = parseInt(process.env.MAX_CHAT_PER_MONTH ?? '150', 10)

async function getChatUsage(userId: string): Promise<{ today: number; month: number }> {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const [today, month] = await Promise.all([
    prisma.insight.count({ where: { userId, type: 'claude-chat', sentAt: { gte: todayStart } } }),
    prisma.insight.count({ where: { userId, type: 'claude-chat', sentAt: { gte: monthStart } } }),
  ])
  return { today, month }
}

async function recordChat(userId: string): Promise<void> {
  await prisma.insight.create({ data: { userId, type: 'claude-chat', message: 'chat' } })
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)

    // Premium gate — chat is a premium feature
    const premium = await isPremiumUser(userId)
    if (!premium) {
      return NextResponse.json(
        { error: 'Chat kräver ett aktivt Pulse Premium-abonnemang.', requiresPremium: true },
        { status: 403 }
      )
    }

    // Rate limits
    const usage = await getChatUsage(userId)
    if (usage.today >= MAX_CHAT_PER_DAY) {
      return NextResponse.json(
        { error: `Du har nått dagens gräns (${MAX_CHAT_PER_DAY} meddelanden). Försök igen imorgon.` },
        { status: 429 }
      )
    }
    if (usage.month >= MAX_CHAT_PER_MONTH) {
      return NextResponse.json(
        { error: `Du har nått månadens gräns (${MAX_CHAT_PER_MONTH} meddelanden). Återställs 1:a varje månad.` },
        { status: 429 }
      )
    }

    const body = (await req.json()) as {
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
    }
    const { message, history } = body
    if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

    const [profile, aliases, velocity, categories] = await Promise.all([
      prisma.userProfile.findFirst({ where: { userId } }),
      prisma.merchantAlias.findMany({ where: { userId } }),
      calculateVelocity(userId).catch(() => null),
      getCategoryBreakdown(userId).catch(() => []),
    ])

    // Last 30 days, max 60 transactions — leaner than before (was 200 × 60 days)
    const since = new Date(); since.setDate(since.getDate() - 30)
    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 60,
      select: { date: true, merchant: true, amount: true, category: true, note: true, isIncome: true },
    })

    const txLines = transactions.map((t) => {
      const dateStr = t.date.toISOString().slice(0, 10)
      const sign = t.isIncome ? '+' : '-'
      const noteStr = t.note ? ` (${t.note})` : ''
      return `${dateStr} | ${t.merchant} | ${sign}${Math.abs(t.amount).toLocaleString('sv-SE')} kr | ${t.category ?? 'övrigt'}${noteStr}`
    }).join('\n')

    const aliasLines = aliases.filter((a) => a.explanation)
      .map((a) => `${a.merchant} = "${a.displayName}": ${a.explanation}`).join('\n')

    const catSummary = categories.slice(0, 8)
      .map((c) => `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr`).join(', ')

    const velocityLine = velocity
      ? `Takt: ${velocity.level} — projicerat ${Math.round(velocity.projectedMonthTotal).toLocaleString('sv-SE')} kr/mån. Saldo: ${Math.round(velocity.currentBalance).toLocaleString('sv-SE')} kr.`
      : ''

    const systemPrompt = `Du är Pulse — personlig AI-ekonomiassistent för ${profile?.name ?? 'användaren'}. Ålder: ${profile?.age ?? '?'}, ${profile?.occupation ?? '?'}. Mål: ${profile?.financialGoal ?? 'ej angivet'}. Sparmål: ${profile?.savingsTarget ? profile.savingsTarget.toLocaleString('sv-SE') + ' kr/mån' : 'ej angivet'}.

${velocityLine}
Kategoriöversikt: ${catSummary}

Transaktioner (senaste 30 dagarna):
${txLines || 'Inga transaktioner.'}
${aliasLines ? `\nHandlare:\n${aliasLines}` : ''}

Svara alltid på svenska. Var konkret — använd SEK-belopp. Max 4 meningar om inte mer efterfrågas. Smart kompis-ton.`

    await recordChat(userId)

    // Prompt caching: mark system prompt as cacheable — saves ~80% on repeated messages
    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ],
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readableStream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
