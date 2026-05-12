'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Settings } from 'lucide-react'

interface Profile {
  id: string
  name: string | null
  age: number | null
  occupation: string | null
  financialGoal: string | null
  savingsTarget: number | null
  paydayDay: number
  monthlyRent: number
  criticalBuffer: number
  warningThreshold: number
}

type EditingField = keyof Omit<Profile, 'id' | 'createdAt' | 'updatedAt'> | null

function EditableField({
  label,
  value,
  fieldKey,
  type = 'text',
  suffix,
  min,
  max,
  multiline,
  displayValue,
  onSave,
}: {
  label: string
  value: string | number | null
  fieldKey: string
  type?: string
  suffix?: string
  min?: number
  max?: number
  multiline?: boolean
  displayValue?: string
  onSave: (field: string, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  function startEdit() {
    setDraft(String(value ?? ''))
    setEditing(true)
  }

  function save() {
    setEditing(false)
    if (draft !== String(value ?? '')) {
      onSave(fieldKey, draft)
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) save()
    if (e.key === 'Escape') setEditing(false)
  }

  const inputClass =
    'bg-[#161616] border border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'

  const displayText = displayValue ?? (value !== null && value !== undefined && String(value) !== '' ? String(value) : '—')

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium mb-0.5">
          {label}
        </p>
        {editing ? (
          <div className="relative mt-1">
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={handleKeyDown}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            ) : (
              <div className="relative">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={type}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={save}
                  onKeyDown={handleKeyDown}
                  min={min}
                  max={max}
                  className={`${inputClass} ${suffix ? 'pr-10' : ''}`}
                />
                {suffix && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
                    {suffix}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="text-sm text-zinc-200 hover:text-white transition-colors text-left mt-0.5 group"
          >
            {displayText}
            <span className="text-zinc-600 group-hover:text-zinc-400 text-xs ml-2 transition-colors">
              redigera
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((p: Profile | null) => setProfile(p ?? ({} as Profile)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(field: string, value: string) {
    let parsed: string | number | null = value

    // Convert numeric fields
    const numericFields = [
      'age', 'paydayDay', 'monthlyRent', 'savingsTarget',
      'criticalBuffer', 'warningThreshold',
    ]
    if (numericFields.includes(field)) {
      parsed = value === '' ? null : parseFloat(value)
      if (parsed !== null && isNaN(parsed as number)) return
    }

    // For warningThreshold stored as float: convert from percentage display back
    // We store it as a multiplier (1.25 = 25% over), display as "25%"
    // But we let user input the multiplier directly for simplicity

    setProfile((prev) => (prev ? { ...prev, [field]: parsed } : prev))
    setSaved(false)

    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: parsed }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Settings save error:', err)
    }
  }

  const sectionClass = 'bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 space-y-0'
  const sectionTitle = 'text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 block'

  return (
    <div className="min-h-screen bg-[#080808] pb-24 sm:pb-0">
      {/* Header */}
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">
          PULSE
        </h1>
        <Settings className="w-4 h-4 text-zinc-600" />
        {saved && (
          <span className="text-xs text-emerald-400 animate-pulse">Sparad</span>
        )}
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <h2 className="text-lg font-bold text-zinc-100">Inställningar</h2>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-40 bg-[#161616] rounded mb-4" />
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-8 w-full bg-[#161616] rounded mb-2" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Ekonomi-inställningar */}
            <div className={sectionClass}>
              <span className={sectionTitle}>Ekonomi-inställningar</span>
              <EditableField
                label="Löndag"
                value={profile?.paydayDay ?? 25}
                fieldKey="paydayDay"
                type="number"
                min={1}
                max={31}
                onSave={handleSave}
              />
              <EditableField
                label="Månadshyra / fasta kostnader"
                value={profile?.monthlyRent ?? 8500}
                fieldKey="monthlyRent"
                type="number"
                suffix="kr"
                min={0}
                onSave={handleSave}
              />
              <EditableField
                label="Sparmål per månad"
                value={profile?.savingsTarget ?? null}
                fieldKey="savingsTarget"
                type="number"
                suffix="kr"
                min={0}
                onSave={handleSave}
              />
              <EditableField
                label="Kritisk buffert"
                value={profile?.criticalBuffer ?? 5000}
                fieldKey="criticalBuffer"
                type="number"
                suffix="kr"
                min={0}
                onSave={handleSave}
              />
              <EditableField
                label="Varningströskel (multiplikator)"
                value={profile?.warningThreshold ?? 1.25}
                fieldKey="warningThreshold"
                type="number"
                displayValue={
                  profile?.warningThreshold
                    ? `${Math.round((profile.warningThreshold - 1) * 100)}% över snitt`
                    : '25% över snitt'
                }
                min={1}
                max={3}
                onSave={handleSave}
              />
            </div>

            {/* Din profil */}
            <div className={sectionClass}>
              <span className={sectionTitle}>Din profil</span>
              <EditableField
                label="Namn"
                value={profile?.name ?? null}
                fieldKey="name"
                onSave={handleSave}
              />
              <EditableField
                label="Ålder"
                value={profile?.age ?? null}
                fieldKey="age"
                type="number"
                min={1}
                max={120}
                onSave={handleSave}
              />
              <EditableField
                label="Yrke"
                value={profile?.occupation ?? null}
                fieldKey="occupation"
                onSave={handleSave}
              />
              <EditableField
                label="Ekonomiskt mål"
                value={profile?.financialGoal ?? null}
                fieldKey="financialGoal"
                multiline
                onSave={handleSave}
              />
            </div>

            <p className="text-xs text-zinc-700 text-center">
              Klicka på ett värde för att redigera. Sparas automatiskt.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
