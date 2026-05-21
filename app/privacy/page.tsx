import Link from 'next/link'
import { Activity } from 'lucide-react'

export const metadata = {
  title: 'Integritetspolicy — Pulse',
  description: 'Hur Pulse samlar in, använder och skyddar dina personuppgifter.',
}

const sections = [
  {
    id: '1',
    title: 'Om Pulse och den här policyn',
    content: `Pulse är en AI-driven personlig ekonomiassistent som hjälper dig förstå och förbättra din privatekonomi. Appen läser dina banktransaktioner, analyserar mönster och skickar smarta notiser — allt i syfte att ge dig bättre kontroll över din ekonomi.

Den här integritetspolicyn beskriver vilka personuppgifter vi samlar in, varför vi gör det, hur länge vi lagrar dem och vilka rättigheter du har. Vi följer EU:s dataskyddsförordning (GDPR) samt tillämplig svensk lagstiftning.

Ansvarig för behandlingen av dina personuppgifter är Pulse (kontakt: villiamnesser@gmail.com).`,
  },
  {
    id: '2',
    title: 'Vilka uppgifter samlar vi in?',
    content: `Vi samlar in följande kategorier av uppgifter:

**Kontouppgifter**
E-postadress och krypterat lösenord när du skapar ett konto.

**Profilinformation (frivillig)**
Namn, ålder, yrke, ekonomiska mål, månadshyra, löndag och sparmålssättningar — information du själv anger för att personalisera appen.

**Banktransaktioner**
Transaktionsdata hämtas antingen via manuell CSV-import eller automatiskt via Tink (Open Banking / PSD2). Vi hämtar: belopp, datum, mottagare/avsändare och transaktionsbeskrivning. Vi hämtar aldrig kontonummer, personnummer, inloggningsuppgifter till din bank eller saldohistorik.

**Teknisk data**
Push-notisprenumeration (om du aktiverar notiser), tidsstämplar för synkronisering och grundläggande felloggar för att hålla tjänsten stabil.`,
  },
  {
    id: '3',
    title: 'Bankintegration via Tink (Open Banking)',
    content: `För automatisk banksynkronisering använder Pulse Tink AB (org.nr 556898-0205), en licensierad tredjepartstjänst för Open Banking reglerad under PSD2. Tink agerar som teknisk mellanhand och autentiserar dig mot din bank via BankID.

Pulse får aldrig tillgång till dina bankuppgifter, lösenord eller personnummer. Vi tar emot ett tidsbegränsat lästoken från Tink med enbart läsbehörighet — vi kan aldrig initiera betalningar eller överföringar.

Tink lagrar ditt samtycke och hanterar kopplingen till banken. Du kan återkalla din bankbehörighet när som helst i Inställningar → Bankkoppling → Koppla bort. Tinks egen integritetspolicy finns på tink.com/privacy.

Banktransaktioner synkroniseras automatiskt två gånger per dag (05:00 och 18:00). Endast nya, bokförda transaktioner hämtas — befintliga transaktioner uppdateras inte.`,
  },
  {
    id: '4',
    title: 'AI-analys via Anthropic Claude',
    content: `Pulse använder Anthropic Claude (AI-modell) för att kategorisera transaktioner, generera ekonomiska insikter, svara på frågor i AI-chatten och skapa personliga budgetförslag.

När du använder dessa funktioner skickas relevanta delar av din transaktionsdata till Anthropics API för bearbetning. Inga personidentifierande uppgifter (som ditt namn eller e-post) skickas tillsammans med transaktionsdata. Anthropic behandlar data enligt sin integritetspolicy (anthropic.com/privacy) och används inte för att träna deras modeller.

Vi skickar aldrig mer data än nödvändigt för den specifika analysen.`,
  },
  {
    id: '5',
    title: 'Hur används uppgifterna?',
    content: `Vi använder dina uppgifter uteslutande för att:

- Visa din ekonomiska översikt, utgiftsmönster och budget
- Generera AI-drivna insikter och rekommendationer
- Skicka smarta push-notiser om din ekonomi (om du aktiverat detta)
- Förbättra kategorisering av dina transaktioner
- Hålla din session aktiv och säker

Vi säljer, hyr ut eller delar aldrig dina personuppgifter eller finansiella data med annonsörer, datahandlare eller andra tredje parter i kommersiellt syfte.`,
  },
  {
    id: '6',
    title: 'Hur länge sparas uppgifterna?',
    content: `Dina uppgifter sparas så länge ditt konto är aktivt. Specifikt:

- **Transaktionsdata:** Sparas i upp till 24 månader för att möjliggöra trendanalyser
- **Profilinformation:** Sparas tills du redigerar eller raderar den
- **Push-prenumeration:** Sparas tills du avaktiverar notiser eller raderar kontot
- **Banktoken (Tink):** Sparas krypterat, används för nattlig synkronisering, och raderas vid bortkoppling

När du raderar ditt konto tas alla dina personuppgifter och transaktioner bort inom 30 dagar.`,
  },
  {
    id: '7',
    title: 'Säkerhet och lagring',
    content: `Dina uppgifter lagras i en krypterad molndatabas (Turso/libSQL) med säkerhetskopiering. All kommunikation sker via HTTPS/TLS. Lösenord lagras aldrig i klartext — vi använder bcrypt-hashning med hög kostnadsfaktor.

Banktoken från Tink lagras krypterat och används enbart för automatisk synkronisering. Inga betalkortsuppgifter eller personnummer lagras någonsin av Pulse.

Vi genomför regelbundna säkerhetsgranskningar och följer branschstandard för webbapplikationssäkerhet.`,
  },
  {
    id: '8',
    title: 'Dina rättigheter (GDPR)',
    content: `Enligt GDPR har du följande rättigheter:

**Rätt till tillgång** — Du kan begära en kopia av alla personuppgifter vi har om dig.

**Rätt till rättelse** — Du kan korrigera felaktig information direkt i appen under Inställningar.

**Rätt till radering** — Du kan begära att vi raderar ditt konto och all tillhörande data. Kontakta oss eller använd "Radera konto"-funktionen i appen.

**Rätt till dataportabilitet** — Du kan begära dina transaktioner i maskinläsbart format (JSON/CSV).

**Rätt att invända** — Du kan invända mot viss behandling, t.ex. push-notiser, som du stänger av i enhetsinställningarna.

**Rätt att lämna klagomål** — Du har rätt att lämna klagomål till Integritetsskyddsmyndigheten (IMY) på imy.se.

För att utöva dina rättigheter, kontakta oss på villiamnesser@gmail.com. Vi svarar inom 30 dagar.`,
  },
  {
    id: '9',
    title: 'Cookies och lokal lagring',
    content: `Pulse använder en krypterad sessions-cookie enbart för inloggningshantering. Vi använder inga spårningscookies, reklamcookies eller tredjepartscookies.

Push-notisprenumerationer lagras lokalt i din webbläsare och i vår databas — enbart för att kunna skicka notiser till rätt enhet.`,
  },
  {
    id: '10',
    title: 'Barn',
    content: `Pulse är inte avsedd för personer under 18 år. Vi samlar inte medvetet in uppgifter från minderåriga. Om du tror att ett barn har skapat ett konto, kontakta oss så raderar vi det omgående.`,
  },
  {
    id: '11',
    title: 'Ändringar i policyn',
    content: `Vi kan komma att uppdatera den här policyn. Vid väsentliga ändringar informerar vi dig via e-post eller notis i appen minst 14 dagar innan ändringen träder i kraft. Aktuell version finns alltid på pulse-xi-umber.vercel.app/privacy.`,
  },
  {
    id: '12',
    title: 'Kontakt',
    content: `Frågor, rättelsebegäran eller klagomål? Kontakta oss:

E-post: villiamnesser@gmail.com
Webbplats: pulse-xi-umber.vercel.app

Vi svarar normalt inom 2 arbetsdagar.`,
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] pb-16">
      <header className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 bg-[#080808]/80 backdrop-blur-xl z-10">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-black tracking-widest text-white uppercase">PULSE</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">Integritetspolicy</h1>
        <p className="text-sm text-zinc-500 mb-8">Senast uppdaterad: maj 2026 · Gäller för Pulse webb-app och mobilapp</p>

        {/* Table of contents */}
        <nav className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5 mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Innehåll</p>
          <ol className="space-y-1.5">
            {sections.map(s => (
              <li key={s.id}>
                <a
                  href={`#section-${s.id}`}
                  className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {s.id}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map(s => (
            <section key={s.id} id={`section-${s.id}`} className="space-y-3 scroll-mt-16">
              <h2 className="text-base font-semibold text-zinc-100">
                {s.id}. {s.title}
              </h2>
              <div className="text-sm leading-relaxed text-zinc-400 space-y-3">
                {s.content.split('\n\n').map((para, i) => {
                  if (para.startsWith('**') || para.includes('\n- ') || para.includes('\n**')) {
                    // Render as formatted block
                    const lines = para.split('\n')
                    return (
                      <div key={i} className="space-y-1.5">
                        {lines.map((line, j) => {
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return (
                              <p key={j} className="font-semibold text-zinc-300 mt-3 first:mt-0">
                                {line.replace(/\*\*/g, '')}
                              </p>
                            )
                          }
                          if (line.startsWith('- ')) {
                            return (
                              <p key={j} className="pl-3 border-l border-white/[0.06]">
                                {line.slice(2)}
                              </p>
                            )
                          }
                          // inline bold
                          const parts = line.split(/\*\*(.*?)\*\*/g)
                          return (
                            <p key={j}>
                              {parts.map((part, k) =>
                                k % 2 === 1
                                  ? <span key={k} className="font-semibold text-zinc-300">{part}</span>
                                  : part
                              )}
                            </p>
                          )
                        })}
                      </div>
                    )
                  }
                  return <p key={i}>{para}</p>
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="pt-8 border-t border-white/[0.06]">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            ← Tillbaka till Pulse
          </Link>
        </div>
      </main>
    </div>
  )
}
