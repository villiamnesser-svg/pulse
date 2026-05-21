'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ChevronLeft, Upload, Smartphone, CheckCircle2, AlertCircle, Zap } from 'lucide-react'

export default function UploadPage() {
  const [tab, setTab] = useState<'file' | 'ios' | 'android'>('file')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
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
      setError('Välj en CSV-fil från Swedbank.')
      return
    }
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/transactions', { method: 'POST', body: formData })
      const data = await res.json() as { imported?: number; skipped?: number; error?: string }
      if (data.error) { setError(data.error); return }
      setResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 })
    } catch {
      setError('Uppladdning misslyckades. Försök igen.')
    } finally {
      setUploading(false)
      // Reset file input so the same file can be re-uploaded
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

  return (
    <div className="min-h-screen flex flex-col bg-[#080808]">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-4 sticky top-0 sm:top-12 z-20">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm flex items-center gap-1.5">
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
          <p className="text-sm text-zinc-500">Välj hur du vill importera från Swedbank.</p>
        </div>

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
                  <p className="text-sm text-zinc-400">Importerar...</p>
                </>
              ) : result ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <p className="text-sm font-medium text-zinc-100">{result.imported} transaktioner importerade</p>
                  {result.skipped > 0 && <p className="text-xs text-zinc-500">{result.skipped} redan inlagda</p>}
                  <p className="text-xs text-emerald-500 mt-1">Tryck för att importera fler</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-zinc-600" />
                  <p className="text-sm font-medium text-zinc-300">Tryck eller dra hit CSV-filen</p>
                  <p className="text-xs text-zinc-600">Swedbank → Transaktioner → Exportera → CSV</p>
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
            <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-zinc-500 mb-3">Hur exporterar jag?</p>
              <ol className="text-sm text-zinc-400 space-y-2">
                {[
                  'Logga in på Swedbank Internetbank',
                  'Gå till ditt konto → Transaktioner',
                  'Välj period och klicka "Exportera"',
                  'Välj format: CSV (semikolonavgränsat)',
                  'Ladda upp filen här',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500/60 mt-0.5 shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
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
                Skapa en iOS-genväg som syns i Dela-menyn. Exportera CSV från Swedbank → Dela → välj genvägen → klart.
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
                'Exportera CSV från Swedbank → Dela filen',
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
