# Pulse — AI Ekonomiassistent · Projektdokumentation

> Läs denna fil i början av varje ny session för fullständig kontext.

---

## Vad är Pulse?

Pulse är en **personlig AI-ekonomiapp** för Sverige byggd av Villiam Nesser. Det är en Next.js webb-app som fungerar som en mobilapp (PWA). Kärn-idén: appen håller koll på din ekonomi i bakgrunden och skickar smarta push-notiser som faktiskt hjälper dig spara pengar — utan att du behöver logga in och kolla varje dag.

**Affärsmodell:** Enda betaltjänst, 49 kr/mån. Inget gratisläge (max 7 dagars gratisvecka vid registrering, ej implementerat ännu). Push-notiserna är det primära värdet — inte AI-chatten.

**Teknikstack:**
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- Prisma 7 + Turso (libsql SQLite i molnet) — databas
- Anthropic Claude API (`claude-3-5-haiku-20241022` för ALLT — chatten, analysen, push-besluten)
- Web Push API (VAPID) — push-notiser
- Tink API (Open Banking, Sverige) — bankkoppling (ej live ännu)
- jose — JWT-sessioner

**Kör lokalt:** `npm run dev` → http://192.168.1.233:3000 (eller localhost:3000)

---

## Projektstruktur

```
pulse/
├── app/                        # Next.js App Router pages + API routes
│   ├── page.tsx                # Dashboard (startsida)
│   ├── transactions/           # Transaktionshistorik + kategori-editor
│   ├── budget/                 # Budget-hantering
│   ├── calendar/               # Kassaflödeskalender (dag-för-dag)
│   ├── chat/                   # AI-chat (premium-gated)
│   ├── report/                 # Månadsrapport med AI-analys (premium)
│   ├── upload/                 # CSV-uppladdning av transaktioner
│   ├── settings/               # Inställningar + premiumlänk
│   ├── premium/                # Premiumsida (49 kr/mån)
│   ├── onboarding/             # Onboarding-flöde
│   ├── login/ register/        # Auth
│   └── api/                    # API-routes (se nedan)
├── components/                 # React-komponenter
├── lib/                        # Business logic
├── prisma/
│   └── schema.prisma           # Databasschema
├── .env                        # Miljövariabler (se nedan)
└── PULSE_PROJECT.md            # ← den här filen
```

---

## Databas — Prisma Schema

**Provider:** SQLite via Turso (libsql) i produktion, lokal `pulse.db` i dev.

### Modeller

| Modell | Beskrivning |
|--------|-------------|
| `User` | Email + bcrypt-lösenord, cuid id |
| `Transaction` | Alla transaktioner. `userId` default `"local"` för single-user-dev |
| `Baseline` | Historiskt snitt per kategori (vecko/månadssnitt + per veckodag) |
| `Insight` | Alla AI-insikter och push-notiser sparas här (typ, meddelande, läst/ej) |
| `SeasonalMemory` | Månadssnapshotar för år-för-år-jämförelser |
| `PushSubscription` | VAPID endpoint + nycklar per enhet |
| `UserProfile` | Löndag, hyra, buffertar, `isPremium`, `premiumUntil` |
| `MerchantAlias` | Klarna-stökiga handelsnamn → läsbara namn |
| `BankConnection` | Tink/GoCardless-koppling (requisitionId, status) |
| `Budget` | Manuella budgetar per kategori |

**Viktiga fält i `UserProfile`:**
```prisma
paydayDay        Int       @default(25)      // lönedag
monthlyRent      Float     @default(8500)    // hyra
criticalBuffer   Float     @default(5000)    // kritisk buffert
warningThreshold Float     @default(1.25)    // 125% av baseline = varning
isPremium        Boolean   @default(false)
premiumUntil     DateTime?                   // null = livstid
```

**Transaction-fält:**
```prisma
id        String    // bankens id eller genererat
date      DateTime
merchant  String
amount    Float     // NEGATIVT för utgifter, POSITIVT för inkomst
balance   Float     // kontosaldo efter transaktion
category  String?   // null = okategoriserad
isIncome  Boolean
note      String?
```

---

## Miljövariabler (.env)

```env
# Databas
DATABASE_URL="file:./pulse.db"               # lokal SQLite (dev fallback)
TURSO_DATABASE_URL=libsql://...              # Turso cloud URL
TURSO_AUTH_TOKEN=eyJ...                      # Turso JWT

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...          # Claude API

# Auth
JWT_SECRET="Cecx3BTb..."                     # JWT-signering

# Push-notiser (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPFo199H-...
VAPID_PRIVATE_KEY=R3pN...
VAPID_SUBJECT=mailto:villiamnesser@gmail.com

# Bank (Tink)
TINK_CLIENT_ID=f042080d...
TINK_CLIENT_SECRET=9e18d7ea...

# App
NEXT_PUBLIC_APP_URL=http://192.168.1.233:3000

# Begränsningar & konfiguration
PAYDAY_DAY=25
MONTHLY_RENT=8500
CRITICAL_BUFFER=5000
WARNING_THRESHOLD=1.25
MAX_DAILY_INSIGHTS=3          # max push/dag (ökas till 12 i heartbeat-koden)
MAX_AI_CALLS_PER_DAY=10
MAX_CHAT_PER_DAY=15
MAX_CHAT_PER_MONTH=150
HEARTBEAT_COOLDOWN_MINUTES=90

# Admin
ADMIN_SECRET=pulse-admin-2026
```

---

## API-routes

### Auth
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/auth/register` | POST | Registrera, skapar User + UserProfile |
| `/api/auth/login` | POST | JWT-cookie `pulse_session` |
| `/api/auth/logout` | POST | Rensar cookie |
| `/api/auth/me` | GET | Returnerar inloggad user |

### Transaktioner
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/transactions` | GET/POST | Hämta/skapa transaktioner |
| `/api/transactions/[id]` | PATCH/DELETE | Uppdatera kategori/notat |
| `/api/upload` (via page) | - | CSV-parser via `lib/parser.ts` |
| `/api/recategorize` | POST | AI-rekategorisering (Haiku) |
| `/api/merchants` | GET | Alla unika handlare |

### Dashboard & Analys
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/spending` | GET | Daglig/kategoriserad spending |
| `/api/analyze` | POST | AI-råd (Haiku, 8s timeout) |
| `/api/forecast` | GET | Kassaflödesprognos till löndag |
| `/api/health-score` | GET | Hälsopoäng 0–100 (4 delscore) |
| `/api/calendar` | GET | 30-dagarsvy med dagliga totaler |
| `/api/compare` | GET | Jämför månader |
| `/api/patterns` | GET | Vanor och mönster |
| `/api/seasonal` | GET | Årstidsminne |

### Budget & Rapport
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/budget` | GET/POST | Hämta/spara budgetar |
| `/api/budget/suggest` | POST | AI-budgetförslag **(premium)** |
| `/api/report/ai` | POST | Djup månadsanalys **(premium)** |

### Push & Heartbeat
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/push` | POST | Registrera push-subscription |
| `/api/push/test` | POST | Testa push-notis |
| `/api/heartbeat` | GET | Kör notis-motor för alla premium-users (90 min cooldown) |

### Bank (Tink/Open Banking)
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/bank/connect` | POST | Starta Tink-flöde |
| `/api/bank/callback` | GET | OAuth callback |
| `/api/bank/status` | GET | Kopplingstatus |
| `/api/bank/sync` | POST | Synka transaktioner (ej live) |

### AI Chat & Admin
| Route | Metod | Beskrivning |
|-------|-------|-------------|
| `/api/chat` | POST | AI-chat **(premium)**, Haiku, prompt caching |
| `/api/insights` | GET/PATCH | Hämta/markera insikter som lästa |
| `/api/profile` | GET/PUT | UserProfile CRUD |
| `/api/share-import` | POST | Dela data mellan users |
| `/api/admin/premium` | POST | Aktivera/avaktivera premium manuellt |

---

## Lib-moduler

### `lib/velocity.ts` — Spending velocity
Beräknar hur fort pengarna försvinner. Returnerar `VelocityResult`:
- `level`: `SAFE | WARNING | CRITICAL`
- `projectedMonthTotal`: extrapolerad månadskostnad
- `baselineMonthly`: historiskt snitt
- `daysUntilPayday`, `dailyBudgetRemaining`, `currentBalance`

### `lib/notifications.ts` — Alla push-notistyper (1031 rader)
**Befintliga (19 st):**
- `fridaySpendingPrediction` — fredagsprediktion med förra helgens faktiska kostnad
- `annualSubscriptionWarning` — årsabonnemang om ~1 vecka
- `paydayBehaviorWarning` — löningseffekten dag 3–5 efter lön
- `cashFlowForecast` — kassaflöde 12–18 dagar före lön
- `categoryTrendAlert` — 3 månaders stigande trend i kategori
- `cashWithdrawalReflection` — kontantuttag denna månad
- `newBehaviorDetection` — ny vana senaste 3 veckorna
- `postBigTransactionNudge` — stort köp inom 2h
- `opportunityCostNudge` — pausa prenumeration = konkret exempel
- `sundayWeeklySummary` — söndagssummering
- `almostThereRecord` — nära bästa månaden
- `streakInDanger` — streak i fara på fredag
- `monthlySpendingRecord` — bästa månaden på N månader
- `yearOverYearInsight` — år-för-år-jämförelse
- `goodWeekendDetection` — ingen restaurang/nöje i helgen
- `fridayPermissionGiving` — bra vecka → "unna dig något"
- `swishCategorizationPrompt` — okategoriserad Swish
- `reEngagement30Days` — ingen aktivitet på 30 dagar
- `lifeEventDetection` — stort ovanligt köp

**Nya (10 st, tillagda 2026-05-19):**
- `repeatedMerchantAlert` — samma handlare 3×+ denna vecka
- `midMonthPaceAlert` — halvmånadsstatus (14–16:e)
- `staleSubscriptionAlert` — månadsabb ej dragen på 45–180 dagar
- `savingsGoalCelebration` — sparrate ≥10% sista 5 dagarna i månaden
- `opportunityCostMonthly` — kategori-spend → vad det faktiskt är (resa etc.)
- `annualHabitConverter` — "X kr/vecka = Y kr/år"
- `paydayArrivalNudge` — stor inkomst senaste 24h → spara 10% nu
- `upcomingBillWarning` — hyra eller prenumeration om 3 dagar
- `bestWeekRecord` — billigaste veckan på 12 veckor

### `lib/advisor.ts` — Claude-drivna push-beslut
`generatePushDecisions()` — skickar velocity + kategorier till Haiku, får JSON med `{ send, title, body }`.
`generateRuleBasedPushes()` — fallback utan AI.

### `lib/subscription.ts` — Premium-hantering
```typescript
isPremiumUser(userId): Promise<boolean>
activatePremium(userId, daysFromNow | null): Promise<void>  // null = livstid
deactivatePremium(userId): Promise<void>
```

### `lib/subscriptions.ts` — Prenumerationsdetektering
`detectSubscriptions(userId)` — hittar återkommande månadsbetalningar via transaktionshistorik.
```typescript
interface Subscription {
  merchant: string
  amount: number
  lastCharged: Date
  monthsDetected: number
  isKnown: boolean
}
```

### `lib/ai-budget.ts` — AI-kostnadstak
`canCallAI(userId)` — kollar om MAX_AI_CALLS_PER_DAY är nådd.
`recordAICall(userId)` — registrerar ett AI-anrop.

### `lib/push.ts` — Web Push
`sendPushNotification(title, body, userId)` — skickar till alla registrerade enheter för userId.

### `lib/auth.ts` — JWT-auth
`signToken(payload)`, `verifyToken(token)`, `getSession()`, `getUserId(req)`.

### `lib/velocity.ts`, `lib/categorizer.ts`, `lib/parser.ts`, `lib/anomalies.ts`, `lib/habits.ts`, `lib/seasonal.ts`, `lib/baseline.ts`
Stödfiler för beräkningar. `parser.ts` hanterar SEB/Swedbank/Nordea CSV-format.

---

## Heartbeat — Push-motor

**Route:** `GET /api/heartbeat`
**Cooldown:** 90 min per user
**Kör:** Loopas av klienten i bakgrunden (eller Vercel Cron i produktion)

**Flödet:**
1. Kolla premium → hoppa över om ej premium
2. Kolla nattimmar (23–07) → hoppa över
3. Kolla 90 min cooldown
4. Kör velocity + kategorier + prenumerationer + anomalier parallellt
5. Sparar månadssnapshotar på 1:a varje månad
6. Kör igenom ~24 notistyper i prioritetsordning
7. `maybePush()` — skickar bara om inte redan skickat idag med samma typ
8. Avslutar med Claude-genererade contextual push om quota finns

**MAX_DAILY:** 12 (inuti koden, inte env-variabeln MAX_DAILY_INSIGHTS=3)

---

## Premium-system

**Aktivera manuellt (admin):**
```bash
curl -X POST http://localhost:3000/api/admin/premium \
  -H "Content-Type: application/json" \
  -d '{"secret":"pulse-admin-2026","action":"activate","days":30}'
# days: null = livstid
```

**Premium-gated features:**
- AI-chat (`/api/chat`) → 403 med `{ requiresPremium: true }`
- AI-budgetförslag (`/api/budget/suggest`) → 403
- Månadsrapport AI (`/api/report/ai`) → 403
- Alla push-notiser (heartbeat) → skippas om ej premium

**Frontend premium wall:**
- `chat/page.tsx` — visar Lock-ikon + länk till /premium om 403
- `settings/page.tsx` — Zap-ikon länk till /premium med "49 kr/mån →"
- `premium/page.tsx` — full premiumsida med pricing, features, FAQ

---

## AI-kostnadskontroll

**Problem:** Claude Sonnet + stora prompts kostade 100 kr på 5 dagar.

**Lösningar implementerade:**
1. Modell: `claude-3-5-haiku-20241022` (10× billigare än Sonnet) för ALLT
2. Chat: 60 transaktioner × 30 dagar (ned från 200 × 60)
3. Prompt caching: system-prompt använder `cache_control: { type: "ephemeral" }` (~80% kostnadsreduktion på repeat-meddelanden)
4. Max tokens: 400 i chat (ned från 512)
5. `recordAICall` körs EFTER lyckat svar (inte innan)
6. Dagligt tak: `MAX_AI_CALLS_PER_DAY=10` för analyze-endpoint
7. Chat-tak: 15/dag, 150/mån

---

## Komponenter

| Komponent | Beskrivning |
|-----------|-------------|
| `PaydayForecast` | Färgkodad prognos till löndag med progress-bar |
| `HealthScore` | SVG ring-chart, betyg A–F, 4 delscore |
| `VelocityCard` | Spending velocity-kort |
| `InsightFeed` | Insikts-feed med markera-som-läst |
| `SpendingChart` | Recharts bar chart för daglig spending |
| `CategoryBreakdown` | Kategori-breakdown lista |
| `SubscriptionRadar` | Prenumerationsöversikt med aliasMap |
| `MonthSummary` | Månadssammanfattning |
| `MonthComparison` | Jämför månader |
| `PositiveStreak` | Streak-display |
| `SavingsGoal` | Sparmål med progress |
| `MobileNav` | Bottom nav med aktiv sida-indikator |
| `PushSetup` | Registrera push-notiser |
| `UploadCSV` | CSV-uppladdning |

---

## Kategorier (svenska)

Systemet använder dessa svenska kategorinamn:
`mat`, `restaurang`, `kaffe`, `nöje`, `transport`, `hälsa`, `shopping`, `prenumerationer`, `hyra`, `räkningar`, `spel`, `resor`, `kontantuttag`, `övrigt`, `inkomst`

---

## Kända begränsningar & nästa steg

### Ej klart / TODO
- **7-dagars gratisvecka** vid registrering — ej implementerat
- **Vercel-deployment** — appen kör bara lokalt, behöver deployas
- **Live Tink-bankkoppling** — transaktioner laddas upp manuellt via CSV just nu; live sync skulle dramatiskt förbättra notis-kvaliteten
- **Nightly Vercel Cron** för banksynkronisering
- **App Store** — planeras som PWA-wrapper

### Tekniska noter
- Single-user-dev: userId default `"local"` i hela databasen
- Proxy: `proxy.ts` finns för att proxya lokal dev-server
- `prisma.config.ts` — Prisma 7 config med libsql-adapter, `@ts-ignore` på migrate-fältet (valid runtime men inte i typerna)
- TypeScript är strikt, 0 fel i projektet (kontrollera med `npx tsc --noEmit`)

---

## Vanliga kommandon

```bash
# Kör lokalt
npm run dev

# TypeScript-check
npx tsc --noEmit

# Prisma
npx prisma studio          # DB-browser
npx prisma db push         # Synka schema → DB
npx prisma generate        # Generera client-typer
npx prisma db execute --stdin <<< "SELECT * FROM UserProfile;"

# Aktivera premium manuellt
curl -X POST http://localhost:3000/api/admin/premium \
  -H "Content-Type: application/json" \
  -H "Cookie: pulse_session=<din-session-cookie>" \
  -d '{"secret":"pulse-admin-2026","action":"activate"}'

# Testa heartbeat (push-motor)
curl http://localhost:3000/api/heartbeat

# Build
npx next build
```

---

## Historik — Stora förändringar

| Datum | Ändring |
|-------|---------|
| 2026-05 | Buggfixar i 8 filer (SpendingChart, transactions, calendar, page, InsightFeed, MobileNav, SubscriptionRadar, analyze) |
| 2026-05 | Lade till `PaydayForecast` + `HealthScore` komponenter |
| 2026-05 | Bytte modell → Haiku, lade till prompt caching, sänkte token-budget |
| 2026-05 | Lade till premium-system (`isPremium`, `premiumUntil` i DB) |
| 2026-05 | Gated chat, budget/suggest, report/ai bakom premium |
| 2026-05 | Lade till 10 nya notistyper i `lib/notifications.ts` |
| 2026-05 | Fixade alla TypeScript-fel (0 fel totalt) |
