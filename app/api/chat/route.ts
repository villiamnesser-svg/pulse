import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { calculateVelocity, getCategoryBreakdown } from '@/lib/velocity'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 20000,
})

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      message: string
      history: { role: 'user' | 'assistant'; content: string }[]
    }

    const { message, history } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Load context
    const [profile, aliases, velocity, categories] = await Promise.all([
      prisma.userProfile.findFirst(),
      prisma.merchantAlias.findMany(),
      calculateVelocity().catch(() => null),
      getCategoryBreakdown().catch(() => []),
    ])

    // Last 60 days of transactions
    const since = new Date()
    since.setDate(since.getDate() - 60)
    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 200,
      select: { date: true, merchant: true, amount: true, category: true, note: true, isIncome: true },
    })

    const txLines = transactions
      .map((t) => {
        const dateStr = t.date.toISOString().slice(0, 10)
        const sign = t.isIncome ? '+' : '-'
        const cat = t.category ?? 'övrigt'
        const noteStr = t.note ? ` (${t.note})` : ''
        return `${dateStr} | ${t.merchant} | ${sign}${Math.abs(t.amount).toLocaleString('sv-SE')} kr | ${cat}${noteStr}`
      })
      .join('\n')

    const aliasLines = aliases
      .filter((a) => a.explanation)
      .map((a) => `${a.merchant} = "${a.displayName}": ${a.explanation}`)
      .join('\n')

    const catSummary = categories
      .slice(0, 8)
      .map((c) => `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr`)
      .join(', ')

    const profileName = profile?.name ?? 'användaren'
    const profileAge = profile?.age ? `${profile.age} år` : 'okänd ålder'
    const profileOccupation = profile?.occupation ?? 'okänt yrke'
    const profileGoal = profile?.financialGoal ?? 'ej angivet'
    const profileSavings = profile?.savingsTarget
      ? `${profile.savingsTarget.toLocaleString('sv-SE')} kr/mån`
      : 'ej angivet'

    const velocityLine = velocity
      ? `Nuvarande takt: ${velocity.level} — projicerat ${Math.round(velocity.projectedMonthTotal).toLocaleString('sv-SE')} kr denna månad. Saldo: ${Math.round(velocity.currentBalance).toLocaleString('sv-SE')} kr.`
      : ''

    const systemPrompt = `Du är Pulse — en personlig AI-ekonomiassistent för ${profileName}. Du har tillgång till alla deras banktransaktioner och kan svara på frågor om deras ekonomi.

Profil: ${profileAge}, ${profileOccupation}. Mål: ${profileGoal}. Sparmål: ${profileSavings}.

${velocityLine}

Kategoriöversikt denna månad: ${catSummary}

Transaktionsöversikt (senaste 60 dagarna):
${txLines || 'Inga transaktioner tillgängliga.'}

${aliasLines ? `Förklarade handlare:\n${aliasLines}` : ''}

Svara alltid på svenska. Var konkret — använd alltid SEK-belopp. Max 4 meningar per svar om inte användaren ber om mer. Smart kompis-ton.`

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ],
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readableStream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
