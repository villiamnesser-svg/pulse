'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, Upload, Smartphone, CheckCircle2, AlertCircle, Zap, Building2 } from 'lucide-react'

type DetectedBank = 'swedbank' | 'seb' | 'nordea' | 'handelsbanken' | 'lansforsakringar' | 'ikano' | 'unknown'

const BANK_INFO: Record<string, { name: string; color: string; bg: string; steps: string[] }> = {
  swedbank: {
    name: 'Swedbank',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    steps: [
      'Logga in på Swedbank Internetbank',
      'Gå till ditt konto → Transaktioner',
      'Välj period och klicka "Exportera"',
      'Välj format: CSV (semikolonavgränsat)',
      'Ladda upp filen här',
    ],
  },
  seb: {
    name: 'SEB',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    steps: [
      'Logga in på SEB Internetbank',
      'Välj konto → Transaktioner',
      'Klicka "Exportera" eller "Ladda ned"',
      'Välj CSV-format',
      'Ladda upp filen här',
    ],
  },
  nordea: {
    name: 'Nordea',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    steps: [
      'Logga in på Nordea Internetbank',
      'Gå till Konton → välj konto',
      'Klicka "Transaktioner" → "Exportera"',
      'Välj CSV och önskad period',
      'Ladda upp filen här',
    ],
  },
  handelsbanken: {
    name: 'Handelsbanken',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    steps: [
      'Logga in på Handelsbanken Internetbank',
      'Välj konto i menyn',
      'Gå till Transaktioner',
      'Klicka "Exportera till Excel/CSV"',
      'Ladda upp filen här',
    ],
  },
  lansforsakringar: {
    name: 'Länsförsäkringar',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    steps: [
      'Logga in på Länsförsäkringar Bank',
      'Välj konto → Transaktioner',
      'Välj period och klicka "Exportera"',
      'Ladda ned som CSV',
      'Ladda upp filen här',
    ],
  },
  ikano: {
    name: 'Ikano Bank',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    steps: [
      'Logga in på Ikano Bank',
      'Gå till ditt konto',
      'Välj Transaktioner → Exportera',
      'Välj CSV-format',
      'Ladda upp filen här',
    ],
  },
}

const SUPPORTED_BANKS = ['swedbank', 'seb', 'nordea', 'handelsbanken', 'lansforsakringar', 'ikano']

const BANK_DISPLAY_NAMES: Record<DetectedBank, string> = {
  swedbank: 'Swedbank',
  seb: 'SEB',
  nordea: 'Nordea',
  handelsbanken: 'Handelsbanken',
  lansforsakringar: 'Länsförsäkringar',
  ikano: 'Ikano Bank',
  unknown: 'Okänd bank',
}

export default function UploadPage() {
  const [tab, setTab] = useState<'file' | 'ios' | 'android'>('file')
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; bank?: DetectedBank } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('error')) setError('Något gick fel med importen. Försök igen.')
    }
  }, [])

  async function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError('Välj en CSV- eller TXT-fil från din bank.')
      return
    }
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/transactions', { method: 'POST', body: formData })
      const data = await res.json() as { imported?: number; skipped?: number; bank?: DetectedBank; error?: string }
      if (data.error) { setError(data.error); return }
      setResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0, bank: data.bank })
      // Auto-set the selected bank info for instructions
      if (data.bank && data.bank !== 'unknown') setSelectedBank(data.bank)
    } catch {
      setError('Uppladdning misslyckades. Försök igen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const shortcutSteps = [
    'Öppna appen Genvägar på iPhone',
    'Tryck + uppe till höger → Ny genväg',
    'Sök "Hämta innehåll från URL" → lägg till',
    'Ange URL: https://pulse-xi-umber.vercel.app/api/share-import',
    'Metod: POST — Begärandetext: Formulär',
    'Lägg till fält: csv — Värde: Genvägens indata',
    'Lägg till åtgärd "Visa notis" → skriv "Import klar!"',
    'Tryck på genvägens namn uppe → "Importera till Pulse"',
    'Tryck på pilknappen → aktivera "Visa i Delningsblad"',
  ]

  const activeSteps = selectedBank ? BANK_INFO[selectedBank]?.steps : null

  return (
    <div className="min-h-screen flex flex-col bg-[#080808]">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-4 sticky top-0 sm:top-12 z-20">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm flex items-center gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h1 className="text-lg font-black tracking-widest text-white uppercase">PULSE</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4 pb-24">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 mb-1">Importera transaktioner</h2>
          <p className="text-sm text-zinc-500">Exportera CSV från din bank och ladda upp här.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[#0f0f0f] border border-white/[0.06] rounded-2xl p-1">
          {([
            { key: 'file', label: 'Ladda upp' },
            { key: 'ios', label: 'iOS Genväg' },
            { key: 'android', label: 'Android' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 text-xs py-2 rounded-xl font-medium transition-colors ${
                tab === t.key ? 'bg-white/[0.08] text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'file' && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                dragging ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-white/[0.08] hover:border-white/[0.16] bg-[#0f0f0f]'
              }`}
            >
              {uploading ? (
                <>
                  <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-sm text-zinc-400">Analyserar fil...</p>
                </>
              ) : result ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  {result.bank && result.bank !== 'unknown' && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${BANK_INFO[result.bank]?.bg ?? 'bg-zinc-500/10 border-zinc-500/20'} ${BANK_INFO[result.bank]?.color ?? 'text-zinc-400'}`}>
                      {BANK_DISPLAY_NAMES[result.bank]} detekterad
                    </span>
                  )}
                  <p className="text-sm font-medium text-zinc-100">{result.imported} transaktioner importerade</p>
                  {result.skipped > 0 && <p className="text-xs text-zinc-500">{result.skipped} redan inlagda hoppades över</p>}
                  <p className="text-xs text-emerald-500 mt-1">Tryck för att importera fler</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-300">Tryck eller dra hit CSV-filen</p>
                  <p className="text-xs text-zinc-600">Banken detekteras automatiskt</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
            />

            {error && (
              <div className="flex items-center gap-2 bg-red-950/30 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Supported banks */}
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500 mb-3">
                <Building2 className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                Stödda banker — välj din för instruktioner
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SUPPORTED_BANKS.map(bank => {
                  const info = BANK_INFO[bank]
                  const isSelected = selectedBank === bank
                  return (
                    <button
                      key={bank}
                      onClick={() => setSelectedBank(isSelected ? null : bank)}
                      className={`rounded-xl px-3 py-2.5 text-xs font-medium border transition-all text-left ${
                        isSelected
                          ? `${info.bg} ${info.color} border-current/30`
                          : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.12]'
                      }`}
                    >
                      {info.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Per-bank export steps */}
            {activeSteps && selectedBank && (
              <div className={`border rounded-2xl p-5 space-y-3 ${BANK_INFO[selectedBank].bg}`}>
                <p className={`text-xs font-semibold tracking-widest uppercase ${BANK_INFO[selectedBank].color}`}>
                  Exportera från {BANK_INFO[selectedBank].name}
                </p>
                <ol className="space-y-2">
                  {activeSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className={`w-5 h-5 rounded-full border text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium ${BANK_INFO[selectedBank].bg} ${BANK_INFO[selectedBank].color}`}>
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-400 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {tab === 'ios' && (
          <div className="space-y-4">
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-medium text-zinc-100">Sätt upp en gång — dela alltid</p>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Skapa en iOS-genväg som syns i Dela-menyn. Exportera CSV från din bank → Dela → välj genvägen → klart.
              </p>
            </div>
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 space-y-4">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500">Gör så här (en gång)</p>
              <ol className="space-y-3">
                {shortcutSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                      {i + 1}
                    </span>
                    <span className="text-sm text-zinc-400 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4">
              <p className="text-xs text-zinc-500 mb-1.5">Kopiera denna URL till genvägen:</p>
              <code className="text-xs text-emerald-400 break-all select-all">
                https://pulse-xi-umber.vercel.app/api/share-import
              </code>
            </div>
          </div>
        )}

        {tab === 'android' && (
          <div className="space-y-4">
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <p className="text-sm font-medium text-zinc-100">Dela direkt till Pulse</p>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                På Android dyker Pulse automatiskt upp i dela-menyn när du delar en CSV-fil — ingen setup krävs.
              </p>
            </div>
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500">Flöde</p>
              {[
                'Installera Pulse som app (Dela → Lägg till på hemskärmen i Chrome)',
                'Exportera CSV från din bank → Dela filen',
                'Välj Pulse i listan',
                'Importeras direkt, inga extra steg',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/60 mt-0.5 shrink-0" />
                  <span className="text-sm text-zinc-400">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
