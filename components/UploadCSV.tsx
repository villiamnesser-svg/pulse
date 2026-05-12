'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react'

type UploadState = 'idle' | 'uploading' | 'success' | 'error'

interface UploadResult {
  imported: number
  duplicates: number
}

export default function UploadCSV() {
  const [state, setState] = useState<UploadState>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function readFileWithEncoding(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = reject
      // Try latin1 first (Swedbank default), fall back to UTF-8 if BOM present
      const encoding = file.name.endsWith('.csv') ? 'ISO-8859-1' : 'UTF-8'
      reader.readAsText(file, encoding)
    })
  }

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setState('error')
      setErrorMsg('Enbart .csv-filer stöds.')
      return
    }

    setState('uploading')
    setResult(null)
    setErrorMsg('')

    try {
      const text = await readFileWithEncoding(file)
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: text,
      })

      const data = (await res.json()) as UploadResult & { error?: string }

      if (!res.ok) {
        throw new Error(data.error ?? 'Upload failed')
      }

      setResult(data)
      setState('success')
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Något gick fel.')
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function reset() {
    setState('idle')
    setResult(null)
    setErrorMsg('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          dragging
            ? 'border-emerald-500/50 bg-emerald-950/10'
            : state === 'error'
            ? 'border-red-500/30 bg-red-950/10'
            : state === 'success'
            ? 'border-emerald-500/30 bg-emerald-950/10'
            : 'border-white/[0.08] bg-[#0f0f0f] hover:border-white/[0.16] hover:bg-[#111]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={state === 'uploading'}
        />

        {state === 'idle' && (
          <>
            <div className="flex justify-center mb-4">
              <Upload className="w-10 h-10 text-zinc-600" />
            </div>
            <p className="text-zinc-300 font-medium mb-1">Dra och släpp din Swedbank CSV</p>
            <p className="text-zinc-600 text-sm mb-5">eller klicka för att välja fil</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="px-4 py-2 bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] hover:border-white/[0.12] text-zinc-200 text-sm font-medium rounded-xl transition-colors"
            >
              Välj fil
            </button>
          </>
        )}

        {state === 'uploading' && (
          <>
            <div className="flex justify-center mb-4">
              <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
            </div>
            <p className="text-zinc-300 font-medium">Importerar och kategoriserar...</p>
            <p className="text-zinc-600 text-sm mt-1">Det kan ta någon sekund</p>
          </>
        )}

        {state === 'success' && result && (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <p className="text-emerald-400 font-bold text-lg">{result.imported} importerade</p>
            <p className="text-zinc-500 text-sm mt-1">
              {result.duplicates} dubbletter ignorerade
            </p>
            <button
              onClick={reset}
              className="mt-5 px-4 py-2 bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] hover:border-white/[0.12] text-zinc-200 text-sm font-medium rounded-xl transition-colors"
            >
              Ladda upp fler
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-red-400 font-medium">{errorMsg || 'Något gick fel'}</p>
            <button
              onClick={reset}
              className="mt-5 px-4 py-2 bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] hover:border-white/[0.12] text-zinc-200 text-sm font-medium rounded-xl transition-colors"
            >
              Försök igen
            </button>
          </>
        )}
      </div>

      {state === 'idle' && (
        <p className="text-xs text-zinc-600 text-center mt-3">
          Format: Swedbank kontoutdrag (CSV, valfritt format)
        </p>
      )}
    </div>
  )
}
