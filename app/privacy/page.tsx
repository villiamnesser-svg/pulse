import Link from 'next/link'
import { Activity } from 'lucide-react'

export const metadata = {
  title: 'Integritetspolicy — Pulse',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] pb-16">
      <header className="border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-black tracking-widest text-white uppercase">PULSE</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8 text-zinc-300">
        <h1 className="text-2xl font-bold text-zinc-100">Integritetspolicy</h1>
        <p className="text-sm text-zinc-500">Senast uppdaterad: maj 2026</p>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">1. Vilka uppgifter samlar vi in?</h2>
          <p className="text-sm leading-relaxed">
            Pulse samlar in de transaktionsdata du väljer att importera från din bank (via CSV-fil eller bankintegration), din e-postadress och lösenord för inloggning, samt eventuell profilinformation du anger (namn, ålder, ekonomiska mål).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">2. Hur används uppgifterna?</h2>
          <p className="text-sm leading-relaxed">
            Dina transaktionsdata används uteslutande för att ge dig ekonomisk analys, insikter och budgetstöd inom appen. Vi delar aldrig dina finansiella uppgifter med tredje part för reklamändamål.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">3. AI-behandling</h2>
          <p className="text-sm leading-relaxed">
            Pulse använder Anthropic Claude (AI) för att analysera dina utgiftsmönster och generera personliga insikter. Transaktionstdata skickas till Anthropics API för denna bearbetning. Anthropics integritetspolicy gäller för denna behandling.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">4. Datalagring</h2>
          <p className="text-sm leading-relaxed">
            Dina uppgifter lagras i en krypterad databas. Du kan när som helst begära att ditt konto och alla tillhörande data raderas genom att kontakta oss.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">5. Push-notiser</h2>
          <p className="text-sm leading-relaxed">
            Om du aktiverar push-notiser lagrar vi din notisprenumeration lokalt. Du kan när som helst avaktivera notiser i din enhets inställningar.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">6. Dina rättigheter</h2>
          <p className="text-sm leading-relaxed">
            Enligt GDPR har du rätt att: begära tillgång till dina personuppgifter, begära rättelse eller radering, invända mot behandling, och begära dataportabilitet. Kontakta oss för att utöva dessa rättigheter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100">7. Kontakt</h2>
          <p className="text-sm leading-relaxed">
            Frågor om integritet? Kontakta oss på{' '}
            <span className="text-emerald-500">villiamnesser@gmail.com</span>
          </p>
        </section>
      </main>
    </div>
  )
}
