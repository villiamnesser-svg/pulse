'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity, ArrowLeft, Settings, Building2, RefreshCw, Check,
  Unlink, LogOut, FileText, Target, Bell, BellOff, Zap, X, ChevronRight,
} from 'lucide-react'

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
  isPremium?: boolean
  premiumUntil?: string | null
}

interface BankConn {
  id?: string
  status: string
  lastSyncedAt: string | null
  institutionId: string
  provider?: string
}

interface BankInstitution {
  id: string
  name: string
  logo: string
  days: string
}

// Map Nordigen institution IDs to human-readable names + colours
function bankDisplayName(institutionId: string): string {
  const id = institutionId.toLowerCase()
  if (id.includes('swedbank'))       return 'Swedbank'
  if (id.includes('_seb_'))          return 'SEB'
  if (id === 'seb_essesess')         return 'SEB'
  if (id.includes('nordea'))         return 'Nordea'
  if (id.includes('handelsbanken'))  return 'Handelsbanken'
  if (id.includes('lansforsakring')) return 'Länsförsäkringar'
  if (id.includes('danske'))         return 'Danske Bank'
  if (id.includes('ica'))            return 'ICA Banken'
  if (id.includes('revolut'))        return 'Revolut'
  if (id.includes('klarna'))         return 'Klarna'
  if (id.includes('ikano'))          return 'Ikano Bank'
  if (id === 'tink')                 return 'Din bank'
  return 'Din bank'
}

// ─── Editable field ────────────────────────────────────────────────────────────

type EditingField = keyof Omit<Profile, 'id'> | null

function EditableField({
  label, value, fieldKey, type = 'text', suffix, min, max, multiline, displayValue, onSave,
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

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function startEdit() { setDraft(String(value ?? '')); setEditing(true) }
  function save() {
    setEditing(false)
    if (draft !== String(value ?? '')) onSave(fieldKey, draft)
  }
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) save()
    if (e.key === 'Escape') setEditing(false)
  }

  const inputClass = 'bg-[#161616] border border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'
  const displayText = displayValue ?? (value !== null && value !== undefined && String(value) !== '' ? String(value) : '—')

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-600 uppercase tracking-wide font-medium mb-0.5">{label}</p>
        {editing ? (
          <div className="relative mt-1">
            {multiline ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft} onChange={e => setDraft(e.target.value)}
                onBlur={save} onKeyDown={handleKeyDown} rows={3}
                className={`${inputClass} resize-none`}
              />
            ) : (
              <div className="relative">
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type={type} value={draft} onChange={e => setDraft(e.target.value)}
                  onBlur={save} onKeyDown={handleKeyDown} min={min} max={max}
                  className={`${inputClass} ${suffix ? 'pr-10' : ''}`}
                />
                {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">{suffix}</span>}
              </div>
            )}
          </div>
        ) : (
          <button onClick={startEdit} className="text-sm text-zinc-200 hover:text-white transition-colors text-left mt-0.5 group">
            {displayText}
            <span className="text-zinc-600 group-hover:text-zinc-400 text-xs ml-2 transition-colors">redigera</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Bank picker modal ─────────────────────────────────────────────────────────

function BankPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (id: string, name: string) => void
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

  const filtered = institutions.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Välj din bank</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Autentisering via bankens egna inloggning (BankID)</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-white/[0.04]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök bank..."
            className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-zinc-600 py-10">Ingen bank hittades</p>
          ) : (
            <ul className="py-2">
              {filtered.map(bank => (
                <li key={bank.id}>
                  <button
                    onClick={() => onSelect(bank.id, bank.name)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors text-left"
                  >
                    {bank.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bank.logo} alt={bank.name} className="w-8 h-8 rounded-lg object-contain bg-white/[0.06] p-1" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{bank.name}</p>
                      {bank.days && (
                        <p className="text-[10px] text-zinc-600">{bank.days} dagars historik</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-white/[0.04]">
          <p className="text-[10px] text-zinc-700 text-center">
            Läsbehörighet via GoCardless Open Banking · Vi ser aldrig lösenord eller kan flytta pengar
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [bank, setBank] = useState<BankConn | null>(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [showBankPicker, setShowBankPicker] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [syncResult, setSyncResult] = useState<{ imported: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [pushTest, setPushTest] = useState<'idle' | 'sending' | 'ok' | 'error' | 'no-sub'>('idle')

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((p: Profile | null) => setProfile(p ?? ({} as Profile)))
      .catch(console.error)
      .finally(() => setLoading(false))

    fetch('/api/bank/status')
      .then(r => r.json())
      .then(d => setBank(d.connection))
      .catch(() => {})

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('bank') === 'connected') {
      void triggerSync()
    }
  }, [])

  async function handleBankSelect(institutionId: string, _name: string) {
    setShowBankPicker(false)
    setBankLoading(true)
    try {
      const res = await fetch(`/api/bank/connect?institution=${encodeURIComponent(institutionId)}`)
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        console.error('Bank connect error:', data.error)
        setBankLoading(false)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Bank connect failed:', err)
      setBankLoading(false)
    }
  }

  async function triggerSync() {
    setSyncState('syncing')
    setSyncError(null)
    try {
      const res = await fetch('/api/bank/sync', { method: 'POST' })
      const data = await res.json() as { imported: number; ok: boolean; error?: string }
      fetch('/api/bank/status').then(r => r.json()).then(d => setBank(d.connection)).catch(() => {})
      if (data.ok) {
        setSyncResult({ imported: data.imported })
        setSyncState('done')
      } else {
        setSyncError(data.error ?? `HTTP ${res.status}`)
        setSyncState('error')
      }
    } catch (err) {
      setSyncError(String(err))
      setSyncState('error')
    }
  }

  async function disconnectBank() {
    await fetch('/api/bank/connect', { method: 'DELETE' })
    setBank(null)
    setSyncState('idle')
  }

  async function handleSave(field: string, value: string) {
    let parsed: string | number | null = value
    const numericFields = ['age', 'paydayDay', 'monthlyRent', 'savingsTarget', 'criticalBuffer', 'warningThreshold']
    if (numericFields.includes(field)) {
      parsed = value === '' ? null : parseFloat(value)
      if (parsed !== null && isNaN(parsed as number)) return
    }
    setProfile(prev => prev ? { ...prev, [field]: parsed } : prev)
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

  async function testPush() {
    setPushTest('sending')
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) {
        setPushTest(data.error?.includes('Ingen') ? 'no-sub' : 'error')
      } else {
        setPushTest('ok')
      }
    } catch {
      setPushTest('error')
    }
    setTimeout(() => setPushTest('idle'), 4000)
  }

  const sectionClass = 'bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 space-y-0'
  const sectionTitle = 'text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 block'

  const bankNotLinked = !bank || bank.status === 'pending' || bank.status === 'needs_reauth'

  return (
    <div className="min-h-screen bg-[#080808] pb-24 sm:pb-0">
      {showBankPicker && (
        <BankPickerModal
          onClose={() => setShowBankPicker(false)}
          onSelect={handleBankSelect}
        />
      )}

      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <Settings className="w-4 h-4 text-zinc-600" />
        {saved && <span className="text-xs text-emerald-400 animate-pulse">Sparad</span>}
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <h2 className="text-lg font-bold text-zinc-100">Inställningar</h2>

        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
                <div className="h-3 w-40 bg-[#161616] rounded mb-4" />
                {[...Array(4)].map((_, j) => <div key={j} className="h-8 w-full bg-[#161616] rounded mb-2" />)}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* ── Ekonomi-inställningar ── */}
            <div className={sectionClass}>
              <span className={sectionTitle}>Ekonomi-inställningar</span>
              <EditableField label="Löndag" value={profile?.paydayDay ?? 25} fieldKey="paydayDay" type="number" min={1} max={31} onSave={handleSave} />
              <EditableField label="Månadshyra / fasta kostnader" value={profile?.monthlyRent ?? 8500} fieldKey="monthlyRent" type="number" suffix="kr" min={0} onSave={handleSave} />
              <EditableField label="Sparmål per månad" value={profile?.savingsTarget ?? null} fieldKey="savingsTarget" type="number" suffix="kr" min={0} onSave={handleSave} />
              <EditableField label="Kritisk buffert" value={profile?.criticalBuffer ?? 5000} fieldKey="criticalBuffer" type="number" suffix="kr" min={0} onSave={handleSave} />
              <EditableField
                label="Varningströskel (multiplikator)"
                value={profile?.warningThreshold ?? 1.25}
                fieldKey="warningThreshold"
                type="number"
                displayValue={profile?.warningThreshold ? `${Math.round((profile.warningThreshold - 1) * 100)}% över snitt` : '25% över snitt'}
                min={1} max={3}
                onSave={handleSave}
              />
            </div>

            {/* ── Bankkoppling ── */}
            <div className={sectionClass}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span className={sectionTitle}>Bankkoppling</span>
              </div>

              {bankNotLinked ? (
                <div className="space-y-3">
                  {bank?.status === 'needs_reauth' && (
                    <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/20 rounded-xl px-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-xs text-amber-400">Bankkopplingen har gått ut — koppla om för att fortsätta synka.</p>
                    </div>
                  )}

                  <p className="text-sm text-zinc-400">
                    Koppla din bank via GoCardless Open Banking. Autentisering sker via bankens egna inloggning (BankID).
                    Appen får bara läsbehörighet — vi kan aldrig flytta pengar.
                  </p>

                  <button
                    onClick={() => setShowBankPicker(true)}
                    disabled={bankLoading}
                    className="flex items-center gap-2 bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-2.5 rounded-xl font-medium transition-all disabled:opacity-50"
                  >
                    {bankLoading
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Building2 className="w-4 h-4" />}
                    {bankLoading
                      ? 'Öppnar bankautentisering...'
                      : bank?.status === 'needs_reauth'
                        ? 'Koppla om banken'
                        : 'Koppla din bank'}
                  </button>

                  <p className="text-[11px] text-zinc-700">
                    Drivs av GoCardless · 100+ svenska banker stödda · Gratis upp till 50 användare
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm text-zinc-200 font-medium">{bankDisplayName(bank!.institutionId)} kopplad</span>
                  </div>
                  {bank!.lastSyncedAt && (
                    <p className="text-xs text-zinc-500">
                      Senast synkad: {new Date(bank!.lastSyncedAt).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={triggerSync}
                      disabled={syncState === 'syncing'}
                      className="flex items-center gap-2 bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] text-zinc-200 text-xs px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                    >
                      {syncState === 'syncing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : syncState === 'done' ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                          : <RefreshCw className="w-3.5 h-3.5" />}
                      {syncState === 'syncing' ? 'Hämtar...' : syncState === 'done' ? `${syncResult?.imported ?? 0} nya` : 'Synka nu'}
                    </button>
                    <button
                      onClick={disconnectBank}
                      className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 text-xs px-3 py-2 transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Koppla bort
                    </button>
                  </div>
                  {syncState === 'error' && (
                    <p className="text-xs text-red-400">{syncError ?? 'Synkfel — testa igen eller koppla om banken.'}</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Din profil ── */}
            <div className={sectionClass}>
              <span className={sectionTitle}>Din profil</span>
              <EditableField label="Namn" value={profile?.name ?? null} fieldKey="name" onSave={handleSave} />
              <EditableField label="Ålder" value={profile?.age ?? null} fieldKey="age" type="number" min={1} max={120} onSave={handleSave} />
              <EditableField label="Yrke" value={profile?.occupation ?? null} fieldKey="occupation" onSave={handleSave} />
              <EditableField label="Ekonomiskt mål" value={profile?.financialGoal ?? null} fieldKey="financialGoal" multiline onSave={handleSave} />
            </div>

            {/* ── Verktyg ── */}
            <div className={sectionClass}>
              <span className={sectionTitle}>Verktyg</span>
              <Link href="/budget" className="flex items-center gap-3 py-3 border-b border-white/[0.05] text-sm text-zinc-300 hover:text-white transition-colors">
                <Target className="w-4 h-4 text-zinc-500" />
                Budget per kategori
              </Link>
              <Link href="/report" className="flex items-center gap-3 py-3 border-b border-white/[0.05] text-sm text-zinc-300 hover:text-white transition-colors">
                <FileText className="w-4 h-4 text-zinc-500" />
                Månadsrapport
              </Link>
              <div className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <Bell className="w-4 h-4 text-zinc-500" />
                  Testa push-notiser
                </div>
                <button
                  onClick={() => void testPush()}
                  disabled={pushTest === 'sending'}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-medium ${
                    pushTest === 'ok' ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' :
                    pushTest === 'error' ? 'bg-red-950/50 border-red-500/30 text-red-400' :
                    pushTest === 'no-sub' ? 'bg-amber-950/50 border-amber-500/30 text-amber-400' :
                    'bg-[#161616] border-white/[0.08] text-zinc-300 hover:border-white/[0.15]'
                  }`}
                >
                  {pushTest === 'sending' ? 'Skickar...' :
                   pushTest === 'ok' ? '✓ Skickat!' :
                   pushTest === 'error' ? 'Misslyckades' :
                   pushTest === 'no-sub' ? 'Ej aktiverat' : 'Skicka test'}
                </button>
              </div>
            </div>

            {/* ── Premium ── */}
            {(() => {
              const isPremium = profile?.isPremium
              const until = profile?.premiumUntil ? new Date(profile.premiumUntil) : null
              const isTrial = isPremium && until && until > new Date()
              const daysLeft = isTrial ? Math.ceil((until.getTime() - Date.now()) / 86400000) : 0
              const isLifetime = isPremium && !until
              return (
                <Link href="/premium" className="flex items-center justify-between bg-gradient-to-r from-amber-950/30 to-[#0f0f0f] border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">Pulse Premium</p>
                      <p className="text-[11px] text-zinc-600">
                        {isTrial ? `Provperiod — ${daysLeft} dag${daysLeft !== 1 ? 'ar' : ''} kvar`
                          : isLifetime ? 'Aktiv — livstid'
                          : 'Notiser, AI-chat, månadsanalys'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-amber-400 font-semibold">{isPremium ? '✓ Aktiv' : '49 kr/mån →'}</span>
                </Link>
              )
            })()}

            {pushTest === 'no-sub' && (
              <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300 space-y-1">
                <p className="font-medium flex items-center gap-2"><BellOff className="w-4 h-4" /> Push-notiser ej aktiverade</p>
                <p className="text-xs text-amber-400/70">Gå till startsidan och aktivera notiser via klocksymbolen i headern.</p>
              </div>
            )}

            {/* ── Logout ── */}
            <button
              onClick={() => {
                void fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                  router.push('/login')
                  router.refresh()
                })
              }}
              className="w-full flex items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 text-sm py-3 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logga ut
            </button>

            <p className="text-xs text-zinc-700 text-center">Klicka på ett värde för att redigera. Sparas automatiskt.</p>
          </>
        )}
      </main>
    </div>
  )
}
