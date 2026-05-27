'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity, Loader2, Building2, Check, Zap, TrendingUp, Bell,
  ChevronRight, ArrowRight, Upload, CheckCircle2, AlertCircle, X,
} from 'lucide-react'

interface ProfileData {
  name: string
  age: string
  occupation: string
  financialGoal: string
  savingsTarget: string
  paydayDay: string
  monthlyRent: string
}

interface BankInstitution {
  id: string
  name: string
  logo: string
  days: string
}

const TOTAL_STEPS = 6
const LS_KEY = 'pulse_onboarding_draft'

const inputClass =
  'bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'
const labelClass = 'text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block'
const primaryBtn =
  'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2 active:scale-[0.98]'
const backBtn = 'text-zinc-600 hover:text-zinc-400 text-sm transition-colors px-4 py-3 rounded-xl'

// ─── Bank picker overlay ───────────────────────────────────────────────────────

function BankPickerOverlay({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const [institutions, setInstitutions] = useState<BankInstitution[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/bank/institutions')
      .then(r => r.json())
      .then((d: { institutions: BankInstitution[] }) => setInstitutions(d.institutions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = institutions.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl w-full max-w-sm max-h-[75vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-zinc-100">Välj din bank</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök bank..."
            className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none transition-colors"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            </div>
          ) : (
            <ul className="py-2">
              {filtered.map(bank => (
                <li key={bank.id}>
                  <button
                    onClick={() => onSelect(bank.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors text-left"
                  >
                    {bank.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bank.logo} alt={bank.name} className="w-7 h-7 rounded-lg object-contain bg-white/[0.06] p-0.5" />
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <Building2 className="w-3.5 h-3.5 text-zinc-500" />
                      </div>
                    )}
                    <p className="text-sm text-zinc-200 flex-1">{bank.name}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[10px] text-zinc-700 text-center px-4 py-3 border-t border-white/[0.04]">
          Via GoCardless Open Banking · Läsbehörighet · Vi ser aldrig lösenord
        </p>
      </div>
    </div>
  )
}

// ─── Main onboarding ───────────────────────────────────────────────────────────

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bankParam = searchParams.get('bank')

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankConnected, setBankConnected] = useState(false)
  const [showBankPicker, setShowBankPicker] = useState(false)
  const [csvImported, setCsvImported] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [animating, setAnimating] = useState(false)

  const [data, setData] = useState<ProfileData>({
    name: '', age: '', occupation: '', financialGoal: '',
    savingsTarget: '', paydayDay: '25', monthlyRent: '8500',
  })

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
    setData(prev => {
      const next = { ...prev, [field]: value }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  function goToStep(next: number, dir: 'forward' | 'back') {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => { setStep(next); setAnimating(false) }, 200)
  }

  function next() { if (step < TOTAL_STEPS) goToStep(step + 1, 'forward') }
  function back() { if (step > 1) goToStep(step - 1, 'back') }

  async function handleBankSelect(institutionId: string) {
    setShowBankPicker(false)
    setBankLoading(true)
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    try {
      const res = await fetch(`/api/bank/connect?institution=${encodeURIComponent(institutionId)}&source=onboarding`)
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

      if (bankConnected) {
        fetch('/api/bank/sync', { method: 'POST' }).catch(() => null)
      }

      router.push('/dashboard')
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaving(false)
    }
  }

  const slideClass = animating
    ? direction === 'forward' ? 'opacity-0 translate-x-6' : 'opacity-0 -translate-x-6'
    : 'opacity-100 translate-x-0'

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#080808]">
      {showBankPicker && (
        <BankPickerOverlay
          onClose={() => setShowBankPicker(false)}
          onSelect={handleBankSelect}
        />
      )}

      <div className="w-full max-w-md">
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-black tracking-widest text-white uppercase">PULSE</span>
          </div>

          <div className="mb-1">
            <div className="h-0.5 bg-[#161616] rounded-full overflow-hidden">
              <div className="h-0.5 bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="flex justify-end mb-6">
            <span className="text-xs text-zinc-600">{step} / {TOTAL_STEPS}</span>
          </div>

          <div className={`transition-all duration-200 ease-out ${slideClass}`}>
            {step === 1 && <Step1 name={data.name} onNameChange={v => update('name', v)} onNext={next} inputClass={inputClass} labelClass={labelClass} primaryBtn={primaryBtn} />}
            {step === 2 && <Step2 age={data.age} occupation={data.occupation} onAgeChange={v => update('age', v)} onOccupationChange={v => update('occupation', v)} onNext={next} onBack={back} inputClass={inputClass} labelClass={labelClass} primaryBtn={primaryBtn} backBtn={backBtn} />}
            {step === 3 && <Step3 financialGoal={data.financialGoal} savingsTarget={data.savingsTarget} onGoalChange={v => update('financialGoal', v)} onTargetChange={v => update('savingsTarget', v)} onNext={next} onBack={back} inputClass={inputClass} labelClass={labelClass} primaryBtn={primaryBtn} backBtn={backBtn} />}
            {step === 4 && <Step4 paydayDay={data.paydayDay} monthlyRent={data.monthlyRent} onPaydayChange={v => update('paydayDay', v)} onRentChange={v => update('monthlyRent', v)} onNext={next} onBack={back} inputClass={inputClass} labelClass={labelClass} primaryBtn={primaryBtn} backBtn={backBtn} />}
            {step === 5 && (
              <Step5
                onBankConnect={() => setShowBankPicker(true)}
                onSkip={next}
                onBack={back}
                onCsvImported={(count) => { setCsvImported(count); goToStep(6, 'forward') }}
                loading={bankLoading}
                primaryBtn={primaryBtn}
                backBtn={backBtn}
              />
            )}
            {step === 6 && (
              <Step6
                bankConnected={bankConnected}
                csvImported={csvImported}
                name={data.name}
                onFinish={() => void finish()}
                saving={saving}
                primaryBtn={primaryBtn}
              />
            )}
          </div>
        </div>
        <p className="mt-6 text-xs text-zinc-700 text-center">All data lagras säkert och delas aldrig med tredje part</p>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return <Suspense><OnboardingContent /></Suspense>
}

/* ── Step 1: Welcome ── */
function Step1({ name, onNameChange, onNext, inputClass, labelClass, primaryBtn }: {
  name: string; onNameChange: (v: string) => void; onNext: () => void
  inputClass: string; labelClass: string; primaryBtn: string
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
          autoFocus type="text" value={name}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onNext() }}
          placeholder="Ditt namn" className={inputClass}
        />
      </div>
      <button onClick={onNext} disabled={!name.trim()} className={primaryBtn}>
        Kom igång <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}

/* ── Step 2: About you ── */
function Step2({ age, occupation, onAgeChange, onOccupationChange, onNext, onBack, inputClass, labelClass, primaryBtn, backBtn }: {
  age: string; occupation: string; onAgeChange: (v: string) => void; onOccupationChange: (v: string) => void
  onNext: () => void; onBack: () => void; inputClass: string; labelClass: string; primaryBtn: string; backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Lite om dig</h2>
        <p className="text-sm text-zinc-500">Hjälper mig ge mer relevanta råd utifrån din situation.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Hur gammal är du?</label>
          <input autoFocus type="number" value={age} onChange={e => onAgeChange(e.target.value)} placeholder="t.ex. 28" min={1} max={120} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Vad jobbar du med?</label>
          <input type="text" value={occupation} onChange={e => onOccupationChange(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onNext() }} placeholder="t.ex. student, ingenjör, egenföretagare" className={inputClass} />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>Nästa <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

/* ── Step 3: Goals ── */
function Step3({ financialGoal, savingsTarget, onGoalChange, onTargetChange, onNext, onBack, inputClass, labelClass, primaryBtn, backBtn }: {
  financialGoal: string; savingsTarget: string; onGoalChange: (v: string) => void; onTargetChange: (v: string) => void
  onNext: () => void; onBack: () => void; inputClass: string; labelClass: string; primaryBtn: string; backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Vad vill du uppnå?</h2>
        <p className="text-sm text-zinc-500">Dina mål hjälper mig prioritera råden och hålla dig motiverad.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Ditt ekonomiska mål</label>
          <textarea autoFocus value={financialGoal} onChange={e => onGoalChange(e.target.value)} rows={3} placeholder="t.ex. spara till lägenhet, bli skuldfri, bygga en buffert" className={`${inputClass} resize-none`} />
        </div>
        <div>
          <label className={labelClass}>Sparmål per månad</label>
          <div className="relative">
            <input type="number" value={savingsTarget} onChange={e => onTargetChange(e.target.value)} placeholder="t.ex. 2000" min={0} className={`${inputClass} pr-10`} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">kr</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>Nästa <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

/* ── Step 4: Finances ── */
function Step4({ paydayDay, monthlyRent, onPaydayChange, onRentChange, onNext, onBack, inputClass, labelClass, primaryBtn, backBtn }: {
  paydayDay: string; monthlyRent: string; onPaydayChange: (v: string) => void; onRentChange: (v: string) => void
  onNext: () => void; onBack: () => void; inputClass: string; labelClass: string; primaryBtn: string; backBtn: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Din månadsekonomi</h2>
        <p className="text-sm text-zinc-500">Hjälper mig förstå dina fasta utgifter och veta när du fått lön.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Vilken dag får du lön?</label>
          <input autoFocus type="number" value={paydayDay} onChange={e => onPaydayChange(e.target.value)} min={1} max={31} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Boendekostnad per månad</label>
          <div className="relative">
            <input type="number" value={monthlyRent} onChange={e => onRentChange(e.target.value)} min={0} className={`${inputClass} pr-10`} />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">kr</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onNext} className={primaryBtn}>Nästa <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

/* ── Step 5: Import transactions ── */
function Step5({
  onBankConnect, onSkip, onBack, onCsvImported, loading, primaryBtn, backBtn,
}: {
  onBankConnect: () => void
  onSkip: () => void
  onBack: () => void
  onCsvImported: (count: number) => void
  loading: boolean
  primaryBtn: string
  backBtn: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setUploadError('Välj en CSV-fil från din bank.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/transactions', { method: 'POST', body: formData })
      const data = await res.json() as { imported?: number; error?: string }
      if (data.error) { setUploadError(data.error); return }
      onCsvImported(data.imported ?? 0)
    } catch {
      setUploadError('Uppladdning misslyckades. Försök igen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Importera transaktioner</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Ladda upp en CSV-fil från din bank för att börja analysera dina utgifter direkt.
          Alla svenska banker stöds.
        </p>
      </div>

      {/* CSV drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-7 flex flex-col items-center gap-2.5 cursor-pointer transition-colors ${
          dragging ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-white/[0.08] hover:border-white/[0.16] bg-[#141414]'
        }`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <p className="text-sm text-zinc-400">Importerar...</p>
          </>
        ) : (
          <>
            <Upload className="w-7 h-7 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">Tryck eller dra hit CSV-filen</p>
            <p className="text-xs text-zinc-600">Exportera från Swedbank, SEB, Nordea, Handelsbanken m.fl.</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />

      {uploadError && (
        <div className="flex items-center gap-2 bg-red-950/30 border border-red-500/20 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{uploadError}</p>
        </div>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 text-zinc-700 text-xs">
        <div className="flex-1 h-px bg-white/[0.05]" />
        eller
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>

      {/* Bank connect */}
      <button
        onClick={onBankConnect}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-[#141414] hover:bg-[#1a1a1a] border border-white/[0.08] hover:border-white/[0.14] text-zinc-300 text-sm py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4 text-zinc-400" />}
        {loading ? 'Öppnar bankautentisering...' : 'Koppla bank via Open Banking (BankID)'}
      </button>

      <div className="flex gap-3">
        <button onClick={onBack} className={backBtn}>Tillbaka</button>
        <button onClick={onSkip} className="flex-1 text-center text-sm text-zinc-600 hover:text-zinc-400 transition-colors py-3 rounded-xl">
          Hoppa över, gör senare →
        </button>
      </div>
    </div>
  )
}

/* ── Step 6: Done ── */
function Step6({ bankConnected, csvImported, name, onFinish, saving, primaryBtn }: {
  bankConnected: boolean; csvImported: number; name: string; onFinish: () => void; saving: boolean; primaryBtn: string
}) {
  const firstName = name.split(' ')[0] || 'du'
  const hasData = bankConnected || csvImported > 0

  return (
    <div className="space-y-6">
      <div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Check className="w-6 h-6 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">Allt klart, {firstName}!</h2>
        <p className="text-sm text-zinc-500 leading-relaxed">
          {hasData
            ? 'Pulse börjar analysera dina transaktioner direkt.'
            : 'Profilen är sparad. Importera transaktioner när som helst via Ladda upp.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-sm text-zinc-400">Profil konfigurerad</span>
        </div>
        {bankConnected && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-sm text-zinc-400">Bank kopplad · synkar transaktioner</span>
          </div>
        )}
        {csvImported > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04]">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </div>
            <span className="text-sm text-zinc-400">{csvImported} transaktioner importerade</span>
          </div>
        )}
        {!hasData && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141414] border border-white/[0.04] opacity-50">
            <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
            </div>
            <span className="text-sm text-zinc-500">Inga transaktioner ännu</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {hasData && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/10">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-zinc-500">Aktivera push-notiser från dashboarden för att få smarta varningar.</p>
          </div>
        )}
        {!hasData && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-950/20 border border-blue-500/10">
            <Zap className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-xs text-zinc-500">Gå till <strong className="text-zinc-400">Ladda upp</strong> i menyn för att importera transaktioner.</p>
          </div>
        )}
      </div>

      <button onClick={onFinish} disabled={saving} className={primaryBtn.replace('flex-1', 'w-full')}>
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Startar...</> : <>Öppna Pulse <ArrowRight className="w-4 h-4" /></>}
      </button>
    </div>
  )
}
