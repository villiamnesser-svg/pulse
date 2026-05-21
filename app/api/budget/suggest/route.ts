import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canCallAI, recordAICall } from '@/lib/ai-budget'
import { isPremiumUser } from '@/lib/subscription'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20000 })

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)

    if (!(await isPremiumUser(userId))) {
      return NextResponse.json({ error: 'Kräver Pulse Premium.', requiresPremium: true }, { status: 403 })
    }

    if (!(await canCallAI(userId))) {
      return NextResponse.json(
        { error: 'AI-budget slut för idag.' },
        { status: 429 }
      )
    }

    // Get last 3 months of spending
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const transactions = await prisma.transaction.findMany({
      where: { userId, isIncome: false, date: { gte: threeMonthsAgo }, category: { not: null } },
      select: { category: true, amount: true, date: true },
    })

    if (transactions.length < 10) {
      return NextResponse.json({ error: 'Inte tillräckligt med data ännu (behöver minst 3 månaders transaktioner).' }, { status: 400 })
    }

    // Get existing budgets
    const existingBudgets = await prisma.budget.findMany({ where: { userId } })
    const existingMap = new Map(existingBudgets.map(b => [b.category, b.amount]))

    // Get profile
    const profile = await prisma.userProfile.findFirst({ where: { userId } })

    // Calculate average monthly spend per category
    const catMap = new Map<string, number[]>()
    const monthSet = new Set<string>()

    for (const tx of transactions) {
      const cat = tx.category!
      const monthKey = `${tx.date.getFullYear()}-${tx.date.getMonth()}`
      monthSet.add(monthKey)

      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)!.push(Math.abs(tx.amount))
    }

    const numMonths = Math.max(monthSet.size, 1)

    const catSummary = [...catMap.entries()]
      .filter(([cat]) => cat !== 'inkomst')
      .map(([cat, amounts]) => {
        const total = amounts.reduce((s, a) => s + a, 0)
        const monthlyAvg = Math.round(total / numMonths)
        const existing = existingMap.get(cat)
        return { cat, monthlyAvg, existing }
      })
      .sort((a, b) => b.monthlyAvg - a.monthlyAvg)
      .filter(c => c.monthlyAvg > 0)

    const summaryText = catSummary
      .map(c => `${c.cat}: ${c.monthlyAvg.toLocaleString('sv-SE')} kr/mån snitt${c.existing ? ` (befintlig budget: ${c.existing.toLocaleString('sv-SE')} kr)` : ''}`)
      .join('\n')

    const prompt = `Du är en ekonomicoach. Baserat på denna persons faktiska genomsnittliga månadsutgifter de senaste ${numMonths} månaderna, föreslå realistiska månadsbudgetar.

UTGIFTER PER KATEGORI (${numMonths} månaders snitt):
${summaryText}

PROFIL:
Inkomst: ${profile?.savingsTarget ? 'Vill spara ' + profile.savingsTarget.toLocaleString('sv-SE') + ' kr/mån' : 'okänd'}
Mål: ${profile?.financialGoal ?? 'ej angivet'}
Hyra: ${profile?.monthlyRent?.toLocaleString('sv-SE') ?? '?'} kr/mån

Svara ENBART med en JSON-array. Inga förklaringar, ingen text utanför JSON:
[
  { "category": "mat", "amount": 3500, "reason": "Max 1 mening varför" },
  ...
]

Regler:
- Inkludera bara kategorier med faktisk spend
- Sätt budgeten 10-20% under snittet för kategorier som verkar för höga
- Sätt budgeten nära snittet för nödvändiga kategorier (hyra, mat)
- Inkludera INTE "inkomst" eller "hyra" (hyra är fast kostnad)
- Max 8 kategorier
- Belopp i hela kronor`

    await recordAICall(userId)

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    const match = text.match(/\[[\s\S]*\]/)

    if (!match) return NextResponse.json({ suggestions: [] })

    const suggestions = JSON.parse(match[0]) as { category: string; amount: number; reason: string }[]

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('Budget suggest error:', err)
    return NextResponse.json({ error: 'Kunde inte generera förslag' }, { status: 500 })
  }
}
