import Anthropic from '@anthropic-ai/sdk'
import { VelocityResult, CategoryBreakdown } from './velocity'
import { Subscription } from './subscriptions'
import { Anomaly } from './anomalies'
import { prisma } from './db'

export interface PushDecision {
  send: boolean
  title: string
  body: string
}

export function generateRuleBasedPushes(
  velocity: VelocityResult,
  anomalies: Anomaly[],
  alreadySentToday: number,
  maxPerDay: number,
): PushDecision[] {
  const decisions: PushDecision[] = []
  if (alreadySentToday >= maxPerDay) return decisions

  const now = new Date()
  const weekday = now.getDay()

  for (const anomaly of anomalies.slice(0, 1)) {
    decisions.push({ send: true, title: 'Pulse — Avvikelse', body: anomaly.context })
  }

  if (alreadySentToday + decisions.length >= maxPerDay) return decisions

  if (velocity.level === 'CRITICAL') {
    const daily = Math.round(Math.abs(velocity.dailyBudgetRemaining))
    const days = velocity.daysUntilPayday
    const isOver = velocity.dailyBudgetRemaining < 0
    decisions.push({
      send: true,
      title: 'Pulse — Varning',
      body: days <= 3
        ? `${days} dagar till lön. Kör försiktigt nu.`
        : isOver
          ? `Du spenderar ${daily} kr/dag mer än du borde. ${days} dagar kvar till lön.`
          : `Du är på väg att spräcka budgeten. ${daily} kr/dag kvar i ${days} dagar.`,
    })
  }

  if (alreadySentToday + decisions.length >= maxPerDay) return decisions

  if (weekday === 5 && velocity.level !== 'SAFE') {
    const daily = Math.round(velocity.dailyBudgetRemaining)
    decisions.push({
      send: true,
      title: 'Pulse — Fredagskoll',
      body: `Helgen kostar. Du har ${daily} kr/dag kvar till löning.`,
    })
  }

  if (weekday === 1 && velocity.level === 'SAFE') {
    const saved = Math.round(velocity.baselineMonthly - velocity.projectedMonthTotal)
    if (saved > 500) {
      decisions.push({
        send: true,
        title: 'Pulse — Bra vecka',
        body: `Ny vecka, bra start. Du ligger ${saved.toLocaleString('sv-SE')} kr under ditt snitt.`,
      })
    }
  }

  if (weekday === 0 && velocity.level === 'SAFE') {
    const balance = Math.round(velocity.currentBalance)
    const days = velocity.daysUntilPayday
    const CRITICAL_BUFFER = parseInt(process.env.CRITICAL_BUFFER ?? '5000', 10)
    if (balance > CRITICAL_BUFFER + 3000) {
      const messages = [
        `Lugn vecka ekonomiskt. Du har ${balance.toLocaleString('sv-SE')} kr kvar och ${days} dagar till löning.`,
        `Du klarar det utan att ändra något. ${balance.toLocaleString('sv-SE')} kr och ${days} dagar till lön.`,
        `Saldo ser stabilt ut. ${balance.toLocaleString('sv-SE')} kr och ${days} dagar till löning.`,
      ]
      decisions.push({ send: true, title: 'Pulse', body: messages[Math.floor(Math.random() * messages.length)] })
    }
  }

  return decisions
}


const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15000,
})

const WEEKDAY_NAMES = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag']

export async function generateAdvice(
  velocity: VelocityResult,
  categories: CategoryBreakdown[],
  userId = 'local'
): Promise<string> {
  const today = new Date()
  const weekday = WEEKDAY_NAMES[today.getDay()]

  const anomalies = categories
    .filter((c) => c.baseline > 0 && c.amount > c.baseline * 1.3)
    .map((c) => `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr (snitt ${Math.round(c.baseline).toLocaleString('sv-SE')} kr)`)

  const topCategories = categories
    .slice(0, 3)
    .map((c) => `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr`)
    .join(', ')

  const notedTransactions = await prisma.transaction.findMany({
    where: { userId, note: { not: null } },
    orderBy: { date: 'desc' },
    take: 20,
    select: { merchant: true, note: true },
  })

  const profile = await prisma.userProfile.findFirst({ where: { userId } })
  const aliases = await prisma.merchantAlias.findMany({ where: { userId } })

  const notesContext = notedTransactions.length > 0
    ? `\nFörklarade transaktioner:\n${notedTransactions.map((t) => `- ${t.merchant}: ${t.note}`).join('\n')}`
    : ''

  const aliasContext = aliases.filter((a) => a.explanation)
    .map((a) => `${a.merchant} = "${a.displayName}": ${a.explanation}`).join('\n')

  const profileContext = profile
    ? `\nProfil: ${profile.name ?? ''}, ${profile.age ?? '?'} år, ${profile.occupation ?? '?'}. Mål: ${profile.financialGoal ?? '?'}. Sparmål: ${profile.savingsTarget ? profile.savingsTarget + ' kr/mån' : '?'}.`
    : ''

  const prompt = `Du är Pulse — en personlig AI-ekonomiassistent. Det är ${weekday}.

Velocity: ${velocity.level}
Saldo: ${Math.round(velocity.currentBalance).toLocaleString('sv-SE')} kr | Dagar till lön: ${velocity.daysUntilPayday} | Budget/dag: ${Math.round(velocity.dailyBudgetRemaining).toLocaleString('sv-SE')} kr
Topp-kategorier: ${topCategories}
Avvikelser: ${anomalies.length > 0 ? anomalies.join(', ') : 'inga'}${profileContext}${notesContext}${aliasContext ? `\nHandlare: ${aliasContext}` : ''}

Ge ETT konkret råd. Max 2 meningar. Alltid SEK-belopp, aldrig generiska tips. Svenska. Smart kompis-ton.`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}

export async function generatePushDecisions(
  velocity: VelocityResult,
  categories: CategoryBreakdown[],
  subscriptions: Subscription[],
  alreadySentToday: number,
  maxPerDay = 3,
  anomalies: Anomaly[] = [],
  userId = 'local'
): Promise<PushDecision[]> {
  const remaining = maxPerDay - alreadySentToday
  if (remaining <= 0) return []

  const today = new Date()
  const weekday = WEEKDAY_NAMES[today.getDay()]
  const hour = today.getHours()

  // Time of day context
  const timeOfDay = hour < 10 ? 'morgon' : hour < 13 ? 'förmiddag' : hour < 17 ? 'eftermiddag' : hour < 20 ? 'kväll' : 'sen kväll'

  const [profile, aliases, recentTx, lastInsights, weekAgoPeriod, monthTx] = await Promise.all([
    prisma.userProfile.findFirst({ where: { userId } }),
    prisma.merchantAlias.findMany({ where: { userId, explanation: { not: null } } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, isIncome: false },
      orderBy: { date: 'desc' },
      take: 40,
      select: { date: true, merchant: true, amount: true, category: true },
    }),
    prisma.insight.findMany({
      where: { userId, type: { in: ['velocity', 'insight', 'subscription', 'anomaly', 'positive'] } },
      orderBy: { sentAt: 'desc' },
      take: 5,
      select: { type: true, message: true, sentAt: true },
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        isIncome: false,
      },
      _sum: { amount: true },
    }),
    // This month's transactions for merchant breakdown per category
    prisma.transaction.findMany({
      where: { userId, date: { gte: new Date(today.getFullYear(), today.getMonth(), 1) }, isIncome: false },
      select: { merchant: true, amount: true, category: true },
    }),
  ])

  // This week's spending
  const thisWeekTx = recentTx.filter(t => new Date(t.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const thisWeekTotal = Math.abs(thisWeekTx.reduce((s, t) => s + t.amount, 0))
  const lastWeekTotal = Math.abs(weekAgoPeriod._sum.amount ?? 0)

  // Merchant frequency this week
  const merchantCount: Record<string, number> = {}
  for (const t of thisWeekTx) {
    merchantCount[t.merchant] = (merchantCount[t.merchant] ?? 0) + 1
  }
  const frequentMerchants = Object.entries(merchantCount)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, count]) => `${m} (${count}x)`)

  // Merchant breakdown per category this month
  const catMerchants: Record<string, { merchant: string; total: number }[]> = {}
  for (const t of monthTx) {
    const cat = t.category ?? 'övrigt'
    if (!catMerchants[cat]) catMerchants[cat] = []
    const existing = catMerchants[cat].find(m => m.merchant === t.merchant)
    if (existing) existing.total += Math.abs(t.amount)
    else catMerchants[cat].push({ merchant: t.merchant, total: Math.abs(t.amount) })
  }

  const txLines = recentTx.slice(0, 20)
    .map(t => {
      const d = new Date(t.date).toLocaleDateString('sv-SE', { weekday: 'short', month: 'numeric', day: 'numeric' })
      return `${d}: ${t.merchant} -${Math.abs(t.amount).toLocaleString('sv-SE')} kr (${t.category ?? 'övrigt'})`
    })
    .join('\n')

  const subLines = subscriptions.length > 0
    ? subscriptions.slice(0, 5).map(s => {
        const last = new Date(s.lastCharged as unknown as string)
        const nextDate = new Date(last.getTime() + 30 * 24 * 60 * 60 * 1000)
        const daysUntil = Math.round((nextDate.getTime() - Date.now()) / 86400000)
        return `${s.merchant} ${s.amount} kr/mån${daysUntil <= 7 ? ` (drar om ${daysUntil} dagar!)` : ''}`
      }).join('\n')
    : 'inga'

  const lastInsightLines = lastInsights.length > 0
    ? lastInsights.map(i => {
        const ago = Math.round((Date.now() - new Date(i.sentAt).getTime()) / 3600000)
        return `[${ago}h sedan] ${i.message}`
      }).join('\n')
    : 'inga skickade ännu idag'

  const profileLine = profile
    ? `${profile.name ?? 'Användaren'}, ${profile.age ?? '?'} år, ${profile.occupation ?? '?'}. Mål: ${profile.financialGoal ?? '?'}. Sparmål: ${profile.savingsTarget ? profile.savingsTarget + ' kr/mån' : 'ej satt'}.`
    : 'Ingen profil'

  // Savings tracking
  const savingsLine = profile?.savingsTarget && velocity.currentBalance > 0
    ? `Sparmål: ${profile.savingsTarget.toLocaleString('sv-SE')} kr/mån. Nuvarande nettosparande denna månad: ${Math.round(velocity.currentBalance - (profile.criticalBuffer ?? 5000)).toLocaleString('sv-SE')} kr.`
    : ''

  const weekComparison = lastWeekTotal > 0
    ? thisWeekTotal > lastWeekTotal * 1.2
      ? `Denna vecka: ${Math.round(thisWeekTotal).toLocaleString('sv-SE')} kr (${Math.round((thisWeekTotal / lastWeekTotal - 1) * 100)}% mer än förra veckan)`
      : thisWeekTotal < lastWeekTotal * 0.8
        ? `Denna vecka: ${Math.round(thisWeekTotal).toLocaleString('sv-SE')} kr (${Math.round((1 - thisWeekTotal / lastWeekTotal) * 100)}% mindre än förra veckan — bra!)`
        : `Denna vecka: ${Math.round(thisWeekTotal).toLocaleString('sv-SE')} kr (liknande förra veckan)`
    : `Denna vecka: ${Math.round(thisWeekTotal).toLocaleString('sv-SE')} kr`

  // Category lines with merchant breakdown and over/under baseline flags
  const categoryLines = categories.slice(0, 7).map(c => {
    const merchants = (catMerchants[c.category] ?? [])
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(m => `${m.merchant} ${Math.round(m.total).toLocaleString('sv-SE')} kr`)
    const flag = c.baseline > 0
      ? c.amount > c.baseline * 1.5 ? ' ⚠ ÖVER snitt'
      : c.amount < c.baseline * 0.5 ? ' ✓ UNDER snitt'
      : ''
      : ''
    return `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr (snitt ${Math.round(c.baseline).toLocaleString('sv-SE')} kr)${flag}${merchants.length > 0 ? ` — ${merchants.join(', ')}` : ''}`
  }).join('\n')

  const prompt = `Du är Pulse — en personlig AI-ekonomiassistent som känner användaren väl. Det är ${weekday} ${timeOfDay} (kl ${hour}:00).

ANVÄNDARE: ${profileLine}
${savingsLine ? savingsLine : ''}

EKONOMISK STATUS:
- Velocity: ${velocity.level}
- Saldo: ${Math.round(velocity.currentBalance).toLocaleString('sv-SE')} kr
- Dagar till lön (den ${velocity.daysUntilPayday > 0 ? new Date(Date.now() + velocity.daysUntilPayday * 86400000).getDate() + ':e' : 'snart'}): ${velocity.daysUntilPayday} dagar
- Budget kvar/dag: ${Math.round(velocity.dailyBudgetRemaining).toLocaleString('sv-SE')} kr
- Projicerat denna månad: ${Math.round(velocity.projectedMonthTotal).toLocaleString('sv-SE')} kr (snitt: ${Math.round(velocity.baselineMonthly).toLocaleString('sv-SE')} kr)
- ${weekComparison}
${frequentMerchants.length > 0 ? `- Återkommande handlare denna vecka: ${frequentMerchants.join(', ')}` : ''}

KATEGORIER DENNA MÅNAD (med merchant-breakdown):
${categoryLines}

PRENUMERATIONER:
${subLines}

${anomalies.length > 0 ? `AVVIKELSER:\n${anomalies.map(a => `⚠ ${a.context}`).join('\n')}\n` : ''}
SENASTE TRANSAKTIONER (14 dagar):
${txLines || 'inga'}

${aliases.length > 0 ? `KÄNDA HANDLARE:\n${aliases.map(a => `${a.merchant} = ${a.displayName}: ${a.explanation}`).join('\n')}\n` : ''}
NOTISER REDAN SKICKADE (undvik att upprepa):
${lastInsightLines}

---

Du får skicka MAX ${remaining} notis(er) nu (${alreadySentToday}/${maxPerDay} skickade idag).

Din uppgift: Bestäm om det finns något genuint värt att säga just nu — och vad.

Tänk som en smart vän som följer ekonomin noga: ibland är det bästa att INTE skicka något. Skicka bara om du har något specifikt och relevant att säga baserat på datan ovan.

Bra notiser:
- Refererar till specifika köp, belopp eller handlare från datan
- Är tidsenliga (morgon = planering, kväll = reflektion)
- Känns personliga, inte generiska
- Är korta och slagkraftiga (max 120 tecken i body)
- Varierar — kolla senaste notiserna och undvik samma tema

Dåliga notiser:
- "Kom ihåg att hålla koll på din budget" (generiskt)
- Upprepar något som redan skickades nyligen
- Skickas bara för att kvoten tillåter det

Svara ENBART med giltig JSON — ingen markdown, ingen text runt om:
[{ "send": true, "title": "max 35 tecken", "body": "max 120 tecken, personlig ton, SEK-belopp, svenska" }]

Om inget är värt att skicka: [{ "send": false, "title": "", "body": "" }]`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const match = raw.match(/\[[\s\S]*?\]/)
  if (!match) return []

  try {
    const decisions = JSON.parse(match[0]) as PushDecision[]
    return decisions.filter(d => d.send && d.body.length > 0)
  } catch {
    return []
  }
}
