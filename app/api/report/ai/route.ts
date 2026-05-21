import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getUserId } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canCallAI, recordAICall } from '@/lib/ai-budget'
import { isPremiumUser } from '@/lib/subscription'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30000 })

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req)

    if (!(await isPremiumUser(userId))) {
      return NextResponse.json({ error: 'Kräver Pulse Premium.', requiresPremium: true }, { status: 403 })
    }

    if (!(await canCallAI(userId))) {
      return NextResponse.json(
        { error: 'Dagsbudgeten för AI-analys är slut. Försök igen imorgon.' },
        { status: 429 }
      )
    }

    const { month } = (await req.json()) as { month: string } // YYYY-MM

    const [year, monthNum] = month.split('-').map(Number)
    const start = new Date(year, monthNum - 1, 1)
    const end = new Date(year, monthNum, 1)

    // Get current month transactions
    const transactions = await prisma.transaction.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    })

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'Inga transaktioner denna månad' }, { status: 404 })
    }

    // Get previous month for comparison
    const prevStart = new Date(year, monthNum - 2, 1)
    const prevEnd = new Date(year, monthNum - 1, 1)
    const prevTxs = await prisma.transaction.findMany({
      where: { userId, date: { gte: prevStart, lt: prevEnd } },
    })

    // Get profile
    const profile = await prisma.userProfile.findFirst({ where: { userId } })

    // Get merchant aliases
    const aliases = await prisma.merchantAlias.findMany({ where: { userId } })
    const aliasMap = new Map(aliases.map(a => [a.merchant, a.displayName]))

    // Build summaries
    const expenses = transactions.filter(t => !t.isIncome)
    const income = transactions.filter(t => t.isIncome)
    const totalExpenses = Math.abs(expenses.reduce((s, t) => s + t.amount, 0))
    const totalIncome = income.reduce((s, t) => s + t.amount, 0)

    const prevExpenses = Math.abs(prevTxs.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0))

    // Category breakdown
    const catMap = new Map<string, number>()
    for (const tx of expenses) {
      const cat = tx.category ?? 'övrigt'
      catMap.set(cat, (catMap.get(cat) ?? 0) + Math.abs(tx.amount))
    }
    const catBreakdown = [...catMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat}: ${Math.round(amt).toLocaleString('sv-SE')} kr`)
      .join('\n')

    // Top 5 biggest expenses
    const top5 = expenses
      .sort((a, b) => a.amount - b.amount) // most negative = largest expense
      .slice(0, 5)
      .map(t => `${aliasMap.get(t.merchant) ?? t.merchant}: ${Math.abs(t.amount).toLocaleString('sv-SE')} kr (${t.category ?? 'övrigt'})`)
      .join('\n')

    // Recurring-ish purchases (same merchant 3+ times)
    const merchantCount = new Map<string, number>()
    for (const tx of expenses) {
      const name = aliasMap.get(tx.merchant) ?? tx.merchant
      merchantCount.set(name, (merchantCount.get(name) ?? 0) + 1)
    }
    const recurring = [...merchantCount.entries()]
      .filter(([, count]) => count >= 3)
      .map(([name, count]) => `${name} (${count} gånger)`)
      .join(', ')

    const monthName = start.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
    const diffPct = prevExpenses > 0
      ? Math.round(((totalExpenses - prevExpenses) / prevExpenses) * 100)
      : 0

    const prompt = `Du är Pulse — en personlig AI-ekonomicoach. Analysera den här personens ekonomi för ${monthName}.

PROFIL:
Namn: ${profile?.name ?? 'Användaren'}
Ålder: ${profile?.age ?? '?'} år, ${profile?.occupation ?? 'okänd yrke'}
Ekonomiskt mål: ${profile?.financialGoal ?? 'ej angivet'}
Sparmål: ${profile?.savingsTarget ? profile.savingsTarget.toLocaleString('sv-SE') + ' kr/mån' : 'ej angivet'}

MÅNADENS SIFFROR:
Inkomst: ${Math.round(totalIncome).toLocaleString('sv-SE')} kr
Utgifter: ${Math.round(totalExpenses).toLocaleString('sv-SE')} kr
Netto: ${Math.round(totalIncome - totalExpenses).toLocaleString('sv-SE')} kr
Jämfört med förra månaden: ${diffPct > 0 ? '+' : ''}${diffPct}% i utgifter

KATEGORIFÖRDELNING:
${catBreakdown}

TOPP 5 STÖRSTA KÖPEN:
${top5}

ÅTERKOMMANDE KÖPARE (3+ gånger):
${recurring || 'inga'}

Skriv en PERSONLIG MÅNADSANALYS på svenska. Strukturera exakt så här (använd dessa headers):

**Sammanfattning**
2-3 meningar om hur månaden gick. Konkret, personlig, med belopp. Nämn om det var bra eller dåligt jämfört med förra månaden.

**Vad sticker ut**
3 punkter med de mest intressanta/oväntade mönstren du ser. Var specifik med belopp och händelser.

**Sparmöjligheter**
2-3 konkreta saker de kan göra annorlunda nästa månad, med faktiska kronbelopp. Inte generiska råd.

**Coachens råd**
1-2 meningar personlig uppmuntran eller utmaning baserat på deras mål. Känns som en smart kompis, inte en bank.

Max 300 ord totalt. Alltid SEK. Direkt tilltal (du/din). Inga onödiga floskler.`

    await recordAICall(userId)

    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const analysis = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    return NextResponse.json({ analysis, month })
  } catch (err) {
    console.error('Report AI error:', err)
    return NextResponse.json({ error: 'Kunde inte generera analys' }, { status: 500 })
  }
}
