import Link from 'next/link'
import { Activity, Zap, Bell, BarChart3, MessageCircle, Shield, ArrowRight, Check, RefreshCw, Target } from 'lucide-react'

export const metadata = {
  title: 'Pulse — AI Ekonomiassistent',
  description: 'Din personliga AI som håller koll på ekonomin åt dig. Smarta notiser, automatisk kategorisering och insikter baserade på dina verkliga vanor.',
}

const FEATURES = [
  {
    icon: Bell,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Smarta push-notiser',
    desc: 'Pulse varnar dig innan du spenderar för mycket — inte efteråt. Personliga alerts baserade på just dina vanor.',
  },
  {
    icon: RefreshCw,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: 'Automatisk banksynk',
    desc: 'Koppla din svenska bank via Open Banking. Transaktioner hämtas automatiskt varje dag — ingen CSV-import behövs.',
  },
  {
    icon: BarChart3,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'AI-insikter',
    desc: 'Djup analys av dina utgiftsmönster. Pulse spottar trender, ovanliga köp och möjligheter att spara.',
  },
  {
    icon: MessageCircle,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: 'AI-chat',
    desc: 'Ställ frågor om din ekonomi på vanlig svenska. "Vad spenderade jag på mat i april?" — Pulse svarar direkt.',
  },
  {
    icon: Target,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    title: 'Sparmål',
    desc: 'Sätt långsiktiga mål och följ din progress automatiskt. Semesterresan, bufferten, bostaden — allt samlat.',
  },
  {
    icon: Shield,
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    title: 'Säkert & privat',
    desc: 'Läsbehörighet via Tink/PSD2. Vi ser aldrig ditt lösenord, kan inte flytta pengar och säljer aldrig din data.',
  },
]

const FREE_FEATURES = [
  'Ladda upp & visa transaktioner',
  'Dashboard med spending-analys',
  'Budgetverktyg',
  'Kassaflödeskalender',
  'Hälsopoäng & prognos',
  'Sparmål-tracker',
]

const PREMIUM_FEATURES = [
  'Personliga AI-notiser',
  'Anomali-varningar i realtid',
  'AI-chat om din ekonomi',
  'Djup månadsanalys med AI',
  'AI-budgetförslag',
  'Automatisk banksynkronisering',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* ── Nav ── */}
      <nav className="border-b border-white/[0.06] px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-black tracking-[0.15em] uppercase">PULSE</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Logga in
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl transition-colors"
          >
            Kom igång gratis
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-6">
          <Zap className="w-3 h-3 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">AI-driven ekonomiassistent</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-6 leading-[1.05]">
          Din ekonomi på
          <br />
          <span className="text-emerald-400">autopilot</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed mb-10">
          Pulse kopplar till din bank, analyserar dina vanor och skickar smarta notiser
          innan du spenderar för mycket — inte efteråt.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/register"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3.5 rounded-2xl transition-all text-sm w-full sm:w-auto justify-center"
          >
            Prova gratis i 7 dagar
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors px-4 py-3.5"
          >
            Har du redan ett konto? Logga in →
          </Link>
        </div>

        <p className="text-xs text-zinc-600 mt-4">
          Inget kreditkort krävs · 7 dagars gratis provperiod · Avsluta när som helst
        </p>
      </section>

      {/* ── Mockup / stats ── */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-6 grid grid-cols-3 gap-4">
          {[
            { label: 'Snitt sparade per användare', value: '1 240 kr', sub: 'per månad' },
            { label: 'Notiser skickade', value: '24', sub: 'typer av smarta alerts' },
            { label: 'Stödda svenska banker', value: '100+', sub: 'via Open Banking' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="text-center">
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">{value}</p>
              <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{sub}</p>
              <p className="text-[10px] text-zinc-700 mt-0.5 leading-snug hidden sm:block">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Allt du behöver. Inget du inte behöver.</h2>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Pulse är byggt för att vara smart i bakgrunden — inte för att du ska behöva öppna appen varje dag.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5 space-y-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="font-semibold text-zinc-100 text-sm">{title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="max-w-3xl mx-auto px-4 pb-24">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black mb-3">Enkel prissättning</h2>
          <p className="text-zinc-500 text-sm">Börja gratis — uppgradera när du är redo.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Free */}
          <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-6">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-2">Gratis</p>
            <div className="flex items-baseline gap-1 mb-5">
              <span className="text-3xl font-black">0</span>
              <span className="text-zinc-500">kr/mån</span>
            </div>
            <ul className="space-y-2.5">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-400">
                  <Check className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-6 block text-center text-sm font-semibold border border-white/[0.1] hover:border-white/[0.2] text-zinc-300 py-3 rounded-xl transition-all"
            >
              Skapa konto gratis
            </Link>
          </div>

          {/* Premium */}
          <div className="bg-gradient-to-b from-amber-950/40 to-[#0f0f0f] border border-amber-500/30 rounded-2xl p-6 relative">
            <div className="absolute top-4 right-4 bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
              Populär
            </div>
            <p className="text-xs text-amber-500 font-semibold uppercase tracking-widest mb-2">Premium</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-black">49</span>
              <span className="text-zinc-400">kr/mån</span>
            </div>
            <p className="text-xs text-zinc-600 mb-5">7 dagars gratis provperiod</p>
            <ul className="space-y-2.5">
              {PREMIUM_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-6 block text-center text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl transition-all"
            >
              Prova gratis i 7 dagar
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-2xl mx-auto px-4 pb-24 text-center">
        <div className="bg-gradient-to-b from-emerald-950/30 to-[#0f0f0f] border border-emerald-500/20 rounded-3xl p-10">
          <Activity className="w-8 h-8 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-3">Redo att ta kontroll?</h2>
          <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
            Skapa ett gratis konto på 30 sekunder. Ingen kreditkort krävs.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 rounded-2xl transition-all text-sm"
          >
            Kom igång gratis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-8 max-w-5xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-black tracking-widest uppercase text-zinc-600">PULSE</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-600">
            <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Integritetspolicy</Link>
            <Link href="/premium" className="hover:text-zinc-400 transition-colors">Premium</Link>
            <Link href="/login" className="hover:text-zinc-400 transition-colors">Logga in</Link>
          </div>
          <p className="text-xs text-zinc-700">© 2026 Pulse · AI Ekonomiassistent</p>
        </div>
      </footer>
    </div>
  )
}
