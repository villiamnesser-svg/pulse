'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Loader2 } from 'lucide-react'

interface ProfileData {
  name: string
  age: string
  occupation: string
  financialGoal: string
  savingsTarget: string
  paydayDay: string
  monthlyRent: string
}

const TOTAL_STEPS = 4

const inputClass =
  'bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'

const labelClass = 'text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block'

const primaryBtn =
  'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2'

const backBtn =
  'text-zinc-600 hover:text-zinc-400 text-sm transition-colors px-4 py-3 rounded-xl'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
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

  function update(field: keyof ProfileData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  function goToStep(next: number, dir: 'forward' | 'back') {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setStep(next)
      setAnimating(false)
    }, 220)
  }

  function next() {
    if (step < TOTAL_STEPS) goToStep(step + 1, 'forward')
  }

  function back() {
    if (step > 1) goToStep(step - 1, 'back')
  }

  async function submit() {
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
      router.push('/')
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaving(false)
    }
  }

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 -translate-x-8'
    : 'opacity-100 translate-x-0'

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#080808]">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-8">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-black tracking-widest text-white uppercase">PULSE</span>
          </div>

          {/* Progress bar */}
          <div className="mb-1">
            <div className="h-0.5 bg-[#161616] rounded-full overflow-hidden">
              <div
                className="h-0.5 bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Step indicator */}
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
                onSubmit={() => void submit()}
                onBack={back}
                saving={saving}
                inputClass={inputClass}
                labelClass={labelClass}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-700 text-center">
          All data lagras lokalt på din enhet
        </p>
      </div>
    </div>
  )
}

/* ── Step 1 ── */
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
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Hej! Jag är Pulse.</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Din personliga ekonomiassistent. Låt mig lära känna dig lite — det tar bara 2 minuter.
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
      <button
        onClick={onNext}
        disabled={!name.trim()}
        className={primaryBtn}
      >
        Kom igång
      </button>
    </div>
  )
}

/* ── Step 2 ── */
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
          Hjälper mig ge mer relevanta råd.
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
        <button onClick={onBack} className={backBtn}>
          Tillbaka
        </button>
        <button onClick={onNext} className={primaryBtn}>
          Nästa
        </button>
      </div>
    </div>
  )
}

/* ── Step 3 ── */
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
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Vad vill du uppnå?</h2>
        <p className="text-sm text-zinc-500">
          Dina mål hjälper mig prioritera råden rätt.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Beskriv ditt ekonomiska mål</label>
          <textarea
            autoFocus
            value={financialGoal}
            onChange={(e) => onGoalChange(e.target.value)}
            rows={3}
            placeholder="t.ex. spara till lägenhet, bli skuldfri, bygga en buffert på 50 000 kr"
            className={`${inputClass} resize-none`}
          />
        </div>
        <div>
          <label className={labelClass}>Hur mycket vill du spara per månad?</label>
          <div className="relative">
            <input
              type="number"
              value={savingsTarget}
              onChange={(e) => onTargetChange(e.target.value)}
              placeholder="t.ex. 2000"
              min={0}
              className={`${inputClass} pr-10`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
              kr
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>
          Tillbaka
        </button>
        <button onClick={onNext} className={primaryBtn}>
          Nästa
        </button>
      </div>
    </div>
  )
}

/* ── Step 4 ── */
function Step4({
  paydayDay,
  monthlyRent,
  onPaydayChange,
  onRentChange,
  onSubmit,
  onBack,
  saving,
  inputClass,
  labelClass,
  primaryBtn,
  backBtn,
}: {
  paydayDay: string
  monthlyRent: string
  onPaydayChange: (v: string) => void
  onRentChange: (v: string) => void
  onSubmit: () => void
  onBack: () => void
  saving: boolean
  inputClass: string
  labelClass: string
  primaryBtn: string
  backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Sista biten</h2>
        <p className="text-sm text-zinc-500">
          Hjälper mig förstå din månadsekonomi.
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
          <label className={labelClass}>Vad betalar du i hyra/boendekostnad?</label>
          <div className="relative">
            <input
              type="number"
              value={monthlyRent}
              onChange={(e) => onRentChange(e.target.value)}
              min={0}
              className={`${inputClass} pr-10`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
              kr
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} disabled={saving} className={backBtn}>
          Tillbaka
        </button>
        <button
          onClick={onSubmit}
          disabled={saving}
          className={primaryBtn}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sparar...
            </>
          ) : (
            'Klar — ta mig till Pulse'
          )}
        </button>
      </div>
    </div>
  )
}
