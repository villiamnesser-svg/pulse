'use client'

import Link from 'next/link'
import { ArrowLeft, Bell, MessageCircle, BarChart3, Lightbulb, Target, Check, Zap } from 'lucide-react'

const FEATURES_FREE = [
  'Ladda upp & visa transaktioner',
  'Dashboard med spending-analys',
  'Budgetverktyg (manuell)',
  'Kassaflödeskalender',
  'Hälsopoäng & prognos',
]

const FEATURES_PREMIUM = [
  { icon: Bell,         text: 'Personliga AI-notiser — smarta pushnotiser om dina utgifter' },
  { icon: Zap,          text: 'Anomali-varningar — vi flaggar ovanliga köp direkt' },
  { icon: MessageCircle,text: 'AI-chat — fråga Pulse vad som helst om din ekonomi' },
  { icon: BarChart3,    text: 'Månadsanalys — djup AI-genomgång av varje månad' },
  { icon: Lightbulb,    text: 'AI-insikter — automatiska mönster och trendanalyser' },
  { icon: Target,       text: 'AI-budgetförslag — optimerade budgetar baserat på dina vanor' },
]

export default function PremiumPage() {
  return (
    <div className="min-h-screen bg-[#080808] pb-24">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-sm font-bold text-white">Pulse Premium</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-black text-white">Pulse Premium</h2>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
            Appen som faktiskt håller koll åt dig — med AI-notiser som varnar innan det händer.
          </p>
        </div>

        {/* Pricing card */}
        <div className="bg-gradient-to-b from-amber-950/40 to-[#0f0f0f] border border-amber-500/30 rounded-2xl p-6 text-center">
          <p className="text-[11px] text-amber-500 font-semibold uppercase tracking-widest mb-2">Månadsabonnemang</p>
          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-4xl font-black text-white">49</span>
            <span className="text-xl text-zinc-400">kr</span>
            <span className="text-sm text-zinc-600">/mån</span>
          </div>
          <p className="text-xs text-zinc-600 mb-5">7 dagars gratis provperiod · Avsluta när som helst</p>
          <button
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-2xl transition-colors text-sm"
            onClick={() => alert('Betalning kommer snart — kontakta support för att aktivera.')}
          >
            Prova gratis i 7 dagar
          </button>
          <p className="text-[10px] text-zinc-700 mt-3">Sedan 49 kr/mån · Betalning via App Store</p>
        </div>

        {/* Premium features */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-3">Ingår i Premium</p>
          {FEATURES_PREMIUM.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3 bg-[#0f0f0f] border border-white/[0.06] rounded-xl p-3.5">
              <div className="w-7 h-7 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-sm text-zinc-300 leading-snug">{text}</p>
            </div>
          ))}
        </div>

        {/* Free features */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-3">Alltid gratis</p>
          <div className="space-y-2">
            {FEATURES_FREE.map(f => (
              <div key={f} className="flex items-center gap-3">
                <Check className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-sm text-zinc-500">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-5 space-y-4">
          <p className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">Vanliga frågor</p>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-300">Hur avbryter jag?</p>
              <p className="text-xs text-zinc-600 mt-0.5">Via App Store → Prenumerationer. Inget bindningstid.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">Vad händer när jag avbryter?</p>
              <p className="text-xs text-zinc-600 mt-0.5">Du får behålla premium till periodens slut. Ingen automatisk debitering.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">Är mina bankdata säkra?</p>
              <p className="text-xs text-zinc-600 mt-0.5">Ja. Vi lagrar aldrig inloggningsuppgifter. Tink/Open Banking-koppling är skrivskyddad.</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  )
}
