'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, Loader2, Building2, Check, Zap, TrendingUp, Bell, ChevronRight, ArrowRight } from 'lucide-react'

interface ProfileData {
  name: string
  age: string
  occupation: string
  financialGoal: string
  savingsTarget: string
  paydayDay: string
  monthlyRent: string
}

const TOTAL_STEPS = 6
const LS_KEY = 'pulse_onboarding_draft'

const inputClass =
  'bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'

const labelClass = 'text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block'

const primaryBtn =
  'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2 active:scale-[0.98]'

const backBtn =
  'text-zinc-600 hover:text-zinc-400 text-sm transition-colors px-4 py-3 rounded-xl'

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bankParam = searchParams.get('bank')

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankConnected, setBankConnected] = useState(false)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [animating, setAnimating] = useState(false)

  const [data, setData] = useState<ProfileData>({
    name: '',
    age: '',
    occupation: '',
    financialGoal: '',
    savingsTarget: '',
    paydayDay: '25',
    monthlyRent: '8500',
  })

  // Restore draft from localStorage and handle bank callback
  useEffect(() => {
    const draft = localStorage.getItem(LS_KEY)
    if (draft) {
      try { setData(JSON.parse(draft) as ProfileData) } catch { /* ignore */ }
    }
    if (bankParam === 'connected') {
      setBankConnected(true)
      goToStep(6, 'forward')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(field: keyof ProfileData, value: string) {
    setData((prev) => {
      const next = { ...prev, [field]: value }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  function goToStep(next: number, dir: 'forward' | 'back') {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setStep(next)
      setAnimating(false)
    }, 200)
  }

  function next() { if (step < TOTAL_STEPS) goToStep(step + 1, 'forward') }
  function back() { if (step > 1) goToStep(step - 1, 'back') }

  async function connectBank() {
    setBankLoading(true)
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    try {
      const res = await fetch('/api/bank/connect?source=onboarding')
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) { setBankLoading(false); return }
      window.location.href = json.url
    } catch {
      setBankLoading(false)
    }
  }

  async function finish() {
    setSaving(true)
    try {
      const payload = {
        name: data.name || undefined,
        age: data.age ? parseInt(data.age, 10) : undefined,
        occupation: data.occupation || undefined,
        financialGoal: data.financialGoal || undefined,
        savingsTarget: data.savingsTarget ? parseFloat(data.savingsTarget) : undefined,
        paydayDay: data.paydayDay ? parseInt(data.paydayDay, 10) : 25,
        monthlyRent: data.monthlyRent ? parseFloat(data.monthlyRent) : 8500,
      }
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      document.cookie = 'pulse_profile_done=1; path=/; max-age=31536000'
      localStorage.removeItem(LS_KEY)

      // Trigger bank sync in background if bank was connected
      if (bankConnected) {
        fetch('/api/bank/sync', { method: 'POST' }).catch(() => null)
      }

      router.push('/')
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaving(false)
    }
  }

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-6'
      : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0'

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#080808]">
      <div className="w-full max-w-md">
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-black tracking-widest text-white uppercase">PULSE</span>
          </div>

          {/* Progress */}
          <div className="mb-1">
            <div className="h-0.5 bg-[#161616] rounded-full overflow-hidden">
              <div
                className="h-0.5 bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="flex justify-end mb-6">
            <span className="text-xs text-zinc-600">{step} / {TOTAL_STEPS}</span>
          </div>

          {/* Step content */}
          <div className={`transition-all duration-200 ease-out ${slideClass}`}>
            {step === 1 && (
              <Step1
                name={data.name}
                onNameChange={(v) => update('name', v)}
                onNext={next}
                inputClass={inputClass}
                labelClass={labelClass}
                primaryBtn={primaryBtn}
              />
            )}
            {step === 2 && (
              <Step2
                age={data.age}
                occupation={data.occupation}
                onAgeChange={(v) => update('age', v)}
                onOccupationChange={(v) => update('occupation', v)}
                onNext={next}
                onBack={back}
                inputClass={inputClass}
                labelClass={labelClass}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
            {step === 3 && (
              <Step3
                financialGoal={data.financialGoal}
                savingsTarget={data.savingsTarget}
                onGoalChange={(v) => update('financialGoal', v)}
                onTargetChange={(v) => update('savingsTarget', v)}
                onNext={next}
                onBack={back}
                inputClass={inputClass}
                labelClass={labelClass}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
            {step === 4 && (
              <Step4
                paydayDay={data.paydayDay}
                monthlyRent={data.monthlyRent}
                onPaydayChange={(v) => update('paydayDay', v)}
                onRentChange={(v) => update('monthlyRent', v)}
                onNext={next}
                onBack={back}
                inputClass={inputClass}
                labelClass={labelClass}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
            {step === 5 && (
              <Step5
                onConnect={connectBank}
                onSkip={next}
                onBack={back}
                loading={bankLoading}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
            {step === 6 && (
              <Step6
                bankConnected={bankConnected}
                name={data.name}
                onFinish={() => void finish()}
                saving={saving}
                primaryBtn={primaryBtn}
              />
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-700 text-center">
          All data lagras säkert och delas aldrig med tredje part
        </p>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  )
}

/* ── Step 1: Welcome ── */
function Step1({
  name,
  onNameChange,
  onNext,
  inputClass,
  labelClass,
  primaryBtn,
}: {
  name: string
  onNameChange: (v: string) => void
  onNext: () => void
  inputClass: string
  labelClass: string
  primaryBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Activity className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Hej! Jag är Pulse.</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Din personliga ekonomiassistent. Jag hjälper dig hålla koll på pengarna, spotta mönster och fatta bättre beslut — automatiskt.
        </p>
      </div>
      <div>
        <label className={labelClass}>Vad heter du?</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onNext() }}
          placeholder="Ditt namn"
          className={inputClass}
        />
      </div>
      <button onClick={onNext} disabled={!name.trim()} className={primaryBtn}>
        Kom igång <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ── Step 2: About you ── */
function Step2({
  age,
  occupation,
  onAgeChange,
  onOccupationChange,
  onNext,
  onBack,
  inputClass,
  labelClass,
  primaryBtn,
  backBtn,
}: {
  age: string
  occupation: string
  onAgeChange: (v: string) => void
  onOccupationChange: (v: string) => void
  onNext: () => void
  onBack: () => void
  inputClass: string
  labelClass: string
  primaryBtn: string
  backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Lite om dig</h2>
        <p className="text-sm text-zinc-500">
          Hjälper mig ge mer relevanta råd utifrån din situation.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Hur gammal är du?</label>
          <input
            autoFocus
            type="number"
            value={age}
            onChange={(e) => onAgeChange(e.target.value)}
            placeholder="t.ex. 28"
            min={1}
            max={120}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Vad jobbar du med?</label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => onOccupationChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onNext() }}
            placeholder="t.ex. student, ingenjör, egenföretagare"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>
          Nästa <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/* ── Step 3: Goals ── */
function Step3({
  financialGoal,
  savingsTarget,
  onGoalChange,
  onTargetChange,
  onNext,
  onBack,
  inputClass,
  labelClass,
  primaryBtn,
  backBtn,
}: {
  financialGoal: string
  savingsTarget: string
  onGoalChange: (v: string) => void
  onTargetChange: (v: string) => void
  onNext: () => void
  onBack: () => void
  inputClass: string
  labelClass: string
  primaryBtn: string
  backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Vad vill du uppnå?</h2>
        <p className="text-sm text-zinc-500">
          Dina mål hjälper mig prioritera råden och hålla dig motiverad.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Ditt ekonomiska mål</label>
          <textarea
            autoFocus
            value={financialGoal}
            onChange={(e) => onGoalChange(e.target.value)}
            rows={3}
            placeholder="t.ex. spara till lägenhet, bli skuldfri, bygga en buffert"
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass}>Sparmål per månad</label>
          <div className="relative">
            <input
              type="number"
              value={savingsTarget}
              onChange={(e) => onTargetChange(e.target.value)}
              placeholder="t.ex. 2000"
              min={0}
              className={`${inputClass} pr-10`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">kr</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>
          Nästa <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/* ── Step 4: Finances ── */
function Step4({
  paydayDay,
  monthlyRent,
  onPaydayChange,
  onRentChange,
  onNext,
  onBack,
  inputClass,
  labelClass,
  primaryBtn,
  backBtn,
}: {
  paydayDay: string
  monthlyRent: string
  onPaydayChange: (v: string) => void
  onRentChange: (v: string) => void
  onNext: () => void
  onBack: () => void
  inputClass: string
  labelClass: string
  primaryBtn: string
  backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Din månadsekonomi</h2>
        <p className="text-sm text-zinc-500">
          Hjälper mig förstå dina fasta utgifter och veta när du fått lön.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Vilken dag får du lön?</label>
          <input
            autoFocus
            type="number"
            value={paydayDay}
            onChange={(e) => onPaydayChange(e.target.value)}
            min={1}
            max={31}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Boendekostnad per månad</label>
          <div className="relative">
            <input
              type="number"
              value={monthlyRent}
              onChange={(e) => onRentChange(e.target.value)}
              min={0}
              className={`${inputClass} pr-10`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">kr</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>
          Nästa <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/* ── Step 5: Bank connection ── */
function Step5({
  onConnect,
  onSkip,
  onBack,
  loading,
  primaryBtn,
  backBtn,
}: {
  onConnect: () => void
  onSkip: () => void
  onBack: () => void
  loading: boolean
  primaryBtn: string
  backBtn: string
}) {
  const benefits = [
    { icon: Zap, label: 'Automatisk synk', desc: 'Transaktioner hämtas direkt från din bank' },
    { icon: TrendingUp, label: 'Smarta insikter', desc: 'AI-analys baserat på dina verkliga utgifter' },
    { icon: Bell, label: 'Personliga notiser', desc: 'Varningar när du spenderar mer än vanligt' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <Building2 className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Koppla din bank</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Anslut din bank via Tink — säker öppen bankstandard (PSD2). Pulse kan aldrig flytta pengar, bara läsa transaktioner.
        </p>
      </div>

      <div className="space-y-2">
        {benefits.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={onConnect}
          disabled={loading}
          className={primaryBtn.replace('flex-1', 'w-full')}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Öppnar bank...</>
          ) : (
            <><Building2 className="w-4 h-4" /> Koppla din bank</>
          )}
        </button>

        <div className="flex gap-3">
          <button onClick={onBack} className={backBtn}>Tillbaka</button>
          <button
            onClick={onSkip}
            className="flex-1 text-center text-sm text-zinc-600 hover:text-zinc-400 transition-colors py-3 rounded-xl"
          >
            Hoppa över för nu
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-700 text-center">
        Drivs av Tink (ägt av Visa) · Krypterad anslutning · Aldrig delat
      </p>
    </div>
  )
}

/* ── Step 6: Done ── */
function Step6({
  bankConnected,
  name,
  onFinish,
  saving,
  primaryBtn,
}: {
  bankConnected: boolean
  name: string
  onFinish: () => void
  saving: boolean
  primaryBtn: string
}) {
  const firstName = name.split(' ')[0] || 'du'

  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">
          Allt klart, {firstName}!
        </h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {bankConnected
            ? 'Din bank är kopplad och Pulse börjar analysera dina transaktioner direkt.'
            : 'Profilen är sparad. Du kan koppla din bank när som helst via Inställningar.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-sm text-zinc-400">Profil konfigurerad</span>
        </div>
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${bankConnected ? 'bg-[#141414] border-white/[0.04]' : 'bg-[#0f0f0f] border-white/[0.04] opacity-50'}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${bankConnected ? 'bg-emerald-500/20' : 'bg-zinc-800'}`}>
            {bankConnected
              ? <Check className="w-3 h-3 text-emerald-400" />
              : <div className="w-2 h-2 rounded-full bg-zinc-600" />}
          </div>
          <span className="text-sm text-zinc-400">
            {bankConnected ? 'Bank kopplad · synkar transaktioner' : 'Bank ej kopplad (valfritt)'}
          </span>
        </div>
      </div>

      <button
        onClick={onFinish}
        disabled={saving}
        className={primaryBtn.replace('flex-1', 'w-full')}
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Startar...</>
        ) : (
          <>Öppna Pulse <ArrowRight className="w-4 h-4" /></>
        )}
      </button>
    </div>
  )
}
