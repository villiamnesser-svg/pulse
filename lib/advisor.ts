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
  const weekday = now.getDay() // 0=sun, 5=fri, 6=sat

  // Anomalies — always highest priority
  for (const anomaly of anomalies.slice(0, 1)) {
    decisions.push({ send: true, title: 'Pulse — Avvikelse', body: anomaly.context })
  }

  if (alreadySentToday + decisions.length >= maxPerDay) return decisions

  // CRITICAL velocity
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

  // Friday budget nudge
  if (weekday === 5 && velocity.level !== 'SAFE') {
    const daily = Math.round(velocity.dailyBudgetRemaining)
    decisions.push({
      send: true,
      title: 'Pulse — Fredagskoll',
      body: `Helgen kostar. Du har ${daily} kr/dag kvar till löning. Kul helg!`,
    })
  }

  // Monday positive check
  if (weekday === 1 && velocity.level === 'SAFE') {
    const saved = Math.round(velocity.baselineMonthly - velocity.projectedMonthTotal)
    if (saved > 500) {
      decisions.push({
        send: true,
        title: 'Pulse — Bra vecka',
        body: `Ny vecka, bra start. Du ligger ${saved.toLocaleString('sv-SE')} kr under ditt snitt den här månaden.`,
      })
    }
  }

  // Sunday calm notification — the push banks never send
  if (weekday === 0 && velocity.level === 'SAFE') {
    const balance = Math.round(velocity.currentBalance)
    const days = velocity.daysUntilPayday
    const CRITICAL_BUFFER = parseInt(process.env.CRITICAL_BUFFER ?? '5000', 10)
    if (balance > CRITICAL_BUFFER + 3000) {
      const messages = [
        `Lugn vecka ekonomiskt. Du har ${balance.toLocaleString('sv-SE')} kr kvar och ${days} dagar till löning. Inget att oroa dig för.`,
        `Du klarar det utan att ändra något. ${balance.toLocaleString('sv-SE')} kr kvar och ${days} dagar till lön. Bra jobbat.`,
        `Saldo ser stabilt ut inför nästa vecka. ${balance.toLocaleString('sv-SE')} kr och ${days} dagar till löning. Fortsätt som du gör.`,
      ]
      const pick = messages[Math.floor(Math.random() * messages.length)]
      decisions.push({ send: true, title: 'Pulse', body: pick })
    }
  }

  return decisions
}


const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 10000,
})

const WEEKDAY_NAMES = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag']

export async function generateAdvice(
  velocity: VelocityResult,
  categories: CategoryBreakdown[]
): Promise<string> {
  const today = new Date()
  const jsDay = today.getDay() // 0=Sunday
  const weekday = WEEKDAY_NAMES[jsDay === 0 ? 6 : jsDay - 1]

  // Find anomalies — categories significantly over baseline
  const anomalies = categories
    .filter((c) => c.baseline > 0 && c.amount > c.baseline * 1.3)
    .map(
      (c) =>
        `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr (snitt ${Math.round(c.baseline).toLocaleString('sv-SE')} kr)`
    )

  const topCategories = categories
    .slice(0, 3)
    .map((c) => `${c.category}: ${Math.round(c.amount).toLocaleString('sv-SE')} kr`)
    .join(', ')

  // Fetch recent transactions that have notes
  const notedTransactions = await prisma.transaction.findMany({
    where: { note: { not: null } },
    orderBy: { date: 'desc' },
    take: 20,
    select: { merchant: true, note: true },
  })

  const notesContext =
    notedTransactions.length > 0
      ? `\nAnvändaren har förklarat dessa transaktioner:\n${notedTransactions
          .map((t) => `- ${t.merchant}: ${t.note}`)
          .join('\n')}`
      : ''

  // Fetch user profile
  const profile = await prisma.userProfile.findFirst()

  // Fetch merchant aliases for context
  const aliases = await prisma.merchantAlias.findMany()
  const aliasContext = aliases
    .filter((a) => a.explanation)
    .map((a) => `${a.merchant} = "${a.displayName}": ${a.explanation}`)
    .join('\n')

  const profileContext = profile
    ? `\nAnvändarprofil:\n- Namn: ${profile.name ?? 'okänt'}\n- Ålder: ${profile.age ?? 'okänt'}\n- Yrke: ${profile.occupation ?? 'okänt'}\n- Ekonomiskt mål: ${profile.financialGoal ?? 'ej angivet'}\n- Sparmål per månad: ${profile.savingsTarget ? profile.savingsTarget + ' kr' : 'ej angivet'}`
    : ''

  const merchantContext = aliasContext
    ? `\nFörklarade handlare:\n${aliasContext}`
    : ''

  const prompt = `Du är Pulse — en personlig AI-ekonomiassistent.

Transaktionsdata:
- Spending velocity: ${velocity.level}
- Topp-kategorier denna månad: ${topCategories}
- Avvikelser: ${anomalies.length > 0 ? anomalies.join(', ') : 'inga'}
- Dag i veckan: ${weekday}${notesContext}${profileContext}${merchantContext}

Ge ETT konkret råd baserat på denna data. Max 3 meningar. Alltid SEK-belopp, aldrig generiska tips. Svenska. Smart kompis-ton.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.trim()
}

export async function generatePushDecisions(
  velocity: VelocityResult,
  categories: CategoryBreakdown[],
  subscriptions: Subscription[],
  alreadySentToday: number,
  maxPerDay = 3,
  anomalies: Anomaly[] = []
): Promise<PushDecision[]> {
  const remaining = maxPerDay - alreadySentToday
  if (remaining <= 0) return []

  const today = new Date()
  const jsDay = today.getDay()
  const weekday = WEEKDAY_NAMES[jsDay === 0 ? 6 : jsDay - 1]
  const hour = today.getHours()

  const profile = await prisma.userProfile.findFirst()
  const aliases = await prisma.merchantAlias.findMany({ where: { explanation: { not: null } } })

  // Last 7 days of transactions for context
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentTx = await prisma.transaction.findMany({
    where: { date: { gte: since7d }, isIncome: false },
    orderBy: { date: 'desc' },
    take: 50,
    select: { date: true, merchant: true, amount: true, category: true },
  })

  const txLines = recentTx
    .map((t) => {
      const d = t.date.toISOString().slice(0, 10)
      return `${d} ${t.merchant} -${Math.abs(t.amount).toLocaleString('sv-SE')} kr (${t.category ?? 'övrigt'})`
    })
    .join('\n')

  const subLines = subscriptions.length > 0
    ? subscriptions.map((s) => `${s.merchant} ${s.amount} kr/mån, senast ${s.lastCharged instanceof Date ? s.lastCharged.toISOString().slice(0, 10) : String(s.lastCharged).slice(0, 10)}, ${s.monthsDetected} månader`).join('\n')
    : 'inga'

  const aliasLines = aliases.map((a) => `${a.merchant} = "${a.displayName}": ${a.explanation}`).join('\n')
  const profileLine = profile
    ? `${profile.name ?? ''}, ${profile.age ?? '?'} år, ${profile.occupation ?? '?'}. Mål: ${profile.financialGoal ?? '?'}. Sparmål: ${profile.savingsTarget ? profile.savingsTarget + ' kr/mån' : '?'}.`
    : 'Ingen profil satt'

  const topCats = categories.slice(0, 5).map((c) => `${c.category} ${Math.round(c.amount).toLocaleString('sv-SE')} kr`).join(', ')
  const anomalyLines = anomalies.length > 0
    ? anomalies.map((a) => `[AVVIKELSE] ${a.context}`).join('\n')
    : ''

  const prompt = `Du är Pulse — en personlig AI-ekonomiassistent. Det är ${weekday} kl ${hour}:00.

Användarprofil: ${profileLine}

Spending velocity: ${velocity.level}
Projicerat denna månad: ${Math.round(velocity.projectedMonthTotal).toLocaleString('sv-SE')} kr (snitt ${Math.round(velocity.baselineMonthly).toLocaleString('sv-SE')} kr)
Saldo: ${Math.round(velocity.currentBalance).toLocaleString('sv-SE')} kr
Dagar till lön: ${velocity.daysUntilPayday}
Dagbudget kvar: ${Math.round(velocity.dailyBudgetRemaining).toLocaleString('sv-SE')} kr/dag

Kategorier denna månad: ${topCats}

Prenumerationer: ${subLines}

Senaste 7 dagars transaktioner:
${txLines || 'inga'}

${aliasLines ? `Förklarade handlare:\n${aliasLines}` : ''}
${anomalyLines ? `\nAvvikelser upptäckta:\n${anomalyLines}` : ''}

Du får skicka MAX ${remaining} push-notis(er) just nu (${alreadySentToday} av ${maxPerDay} skickade idag).

Bestäm om du ska skicka en push-notis och vad den ska säga. Skicka bara om det är genuint relevant just nu — inte bara för att du kan.

Prioritet (högst till lägst):
1. Avvikelse/okänd transaktion på stor summa — "Okej, vad hände på [dag]? [belopp] kr på [ställe] du aldrig varit på."
2. CRITICAL velocity — "Om du fortsätter i den här takten har du [X] kr kvar när hyran drar."
3. WARNING velocity — "Du är på väg mot [X] kr den här månaden. Bromsa lite den här veckan."
4. Fredagskväll — påminn om helgen om du spenderat mer än normalt den här veckan
5. Måndag morgon — motiverande med dagbudget om tight
6. Bra vecka att hylla — om spending klart under snitt

Svara ENBART med giltig JSON (ingen markdown, ingen förklarande text runt om):
[
  { "send": true/false, "title": "kort titel max 40 tecken", "body": "en mening max 100 tecken, smart kompis-ton, SEK-belopp" }
]

Svara på svenska. Returnera exakt 1 objekt i arrayen.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const decisions = JSON.parse(match[0]) as PushDecision[]
    return decisions.filter((d) => d.send)
  } catch {
    return []
  }
}
