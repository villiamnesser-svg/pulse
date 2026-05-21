import Anthropic from '@anthropic-ai/sdk'
import { ParsedTransaction } from './parser'
import { prisma } from './db'

export type Category =
  | 'mat'
  | 'restaurang'
  | 'transport'
  | 'prenumeration'
  | 'hyra'
  | 'nöje'
  | 'hälsa'
  | 'kläder'
  | 'elektronik'
  | 'kontantuttag'
  | 'inkomst'
  | 'träning'
  | 'resor'
  | 'skönhet'
  | 'hem'
  | 'tjänster'
  | 'övrigt'
  | 'utlägg'
  | 'återbetalning'

export interface CategorizedTransaction extends ParsedTransaction {
  category: Category
}

const merchantCache = new Map<string, Category>()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 15000,
})

async function categorizeMerchants(merchants: string[]): Promise<Category[]> {
  const prompt = `Du är en transaktionskategoriserare för svenska banktransaktioner.
Kategorisera varje transaktion i EN av dessa kategorier: mat, restaurang, transport, prenumeration, hyra, nöje, hälsa, kläder, elektronik, kontantuttag, inkomst, träning, resor, skönhet, hem, tjänster, övrigt.

Riktlinjer:
- mat: mataffärer (ICA, Coop, Willys, Lidl, Hemköp, Netto, Saluhallen)
- restaurang: restauranger, caféer, barer, McDonalds, Max, Subway, Espresso House, Wayne's, Starbucks
- transport: SL, Uber, Bolt, Taxi, parkering, bensin, Circle K, OKQ8, Preem, biluthyrning
- prenumeration: Spotify, Netflix, HBO, Disney+, YouTube, Apple, Microsoft, Dropbox, Adobe, Tele2, Telia, Tre, Comviq, 3, Telenor
- hyra: hyra, bostadsrättsavgift, el, vatten, hemförsäkring, bredband
- nöje: bio, teater, konserter, spel, Steam, gaming
- hälsa: apotek, tandläkare, läkare, sjukvård, medicin, Apoteket, Kronans Apotek
- kläder: H&M, Zara, Weekday, Asos, NA-KD, kläder, skor
- elektronik: Elgiganten, Webhallen, Apple Store, datorer, telefoner
- träning: gym, SATS, Actic, Nordic Wellness, löparskor, träningsutrustning, Intersport
- resor: flyg, hotell, SJ, Booking, Airbnb, semester
- skönhet: frisör, naglar, spa, kosmetika, Kicks, LYKO
- hem: IKEA, Clas Ohlson, Jula, byggmaterial, Biltema, hemredskap
- tjänster: försäkringar, banker, avgifter, Kivra, Swish-avgifter, administrativa tjänster
- kontantuttag: Bankomat, Uttag
- inkomst: lön, bidrag, swish-inkomst (positiva belopp)
- utlägg: pengar du lagt ut åt någon annan (ska betalas tillbaka)
- återbetalning: inkommande pengar som är återbetalning av utlägg (inte riktig inkomst)

Transaktioner (JSON-array med merchant-namn):
${JSON.stringify(merchants)}

Svara ENBART med en JSON-array av kategorier i samma ordning. Exempel: ["mat","restaurang","transport"]`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return merchants.map(() => 'övrigt' as Category)

  try {
    const categories = JSON.parse(match[0]) as string[]
    return categories.map((c) => (c as Category) || 'övrigt')
  } catch {
    return merchants.map(() => 'övrigt' as Category)
  }
}

export async function categorizeBatch(
  transactions: ParsedTransaction[],
  userId = 'local'
): Promise<CategorizedTransaction[]> {
  const BATCH_SIZE = 20

  const uncachedMerchants: string[] = []

  for (let i = 0; i < transactions.length; i++) {
    const { merchant, isIncome } = transactions[i]
    if (isIncome) {
      // Only set inkomst if not already cached as återbetalning
      if (!merchantCache.has(merchant)) {
        merchantCache.set(merchant, 'inkomst')
      }
    } else if (!merchantCache.has(merchant)) {
      uncachedMerchants.push(merchant)
    }
  }

  const uniqueUncached = [...new Set(uncachedMerchants)]

  if (uniqueUncached.length > 0) {
    const existingTx = await prisma.transaction.findMany({
      where: { userId, merchant: { in: uniqueUncached }, category: { not: null } },
      select: { merchant: true, category: true },
      distinct: ['merchant'],
    })
    existingTx.forEach((tx) => {
      if (tx.category && tx.category !== 'övrigt') merchantCache.set(tx.merchant, tx.category as Category)
    })
  }

  // Only call API for merchants STILL not in cache
  const stillUncached = uniqueUncached.filter((m) => !merchantCache.has(m))

  for (let i = 0; i < stillUncached.length; i += BATCH_SIZE) {
    const batch = stillUncached.slice(i, i + BATCH_SIZE)
    try {
      const categories = await categorizeMerchants(batch)
      batch.forEach((merchant, idx) => {
        merchantCache.set(merchant, categories[idx] ?? 'övrigt')
      })
    } catch (err) {
      console.error('Categorization error:', err)
      batch.forEach((merchant) => merchantCache.set(merchant, 'övrigt'))
    }
  }

  return transactions.map((t) => ({
    ...t,
    category: merchantCache.get(t.merchant) ?? 'övrigt',
  }))
}
