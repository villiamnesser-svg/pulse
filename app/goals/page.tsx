'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Flag, Plus, Trash2, X } from 'lucide-react'

interface Goal {
  id: string
  name: string
  emoji: string
  targetAmount: number
  targetDate: string | null
  createdAt: string
  savedAmount: number
  monthsToGo: number | null
}

const EMOJI_OPTIONS = [
  '🎯', '🏠', '✈️', '🚗',
  '💻', '🎓', '💍', '👶',
  '💰', '🏋️', '📱', '🌍',
]

const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
]

function fmt(n: number) {
  return Math.round(n).toLocaleString('sv-SE')
}

function formatTargetDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

function monthsUntil(iso: string): number {
  const target = new Date(iso)
  const now = new Date()
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth())
  )
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Sheet state
  const [showSheet, setShowSheet] = useState(false)
  const [newEmoji, setNewEmoji] = useState(EMOJI_OPTIONS[0])
  const [newName, setNewName] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newDate, setNewDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    void loadGoals()
  }, [])

  async function loadGoals() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as Goal[]
      setGoals(data)
    } catch {
      setError('Kunde inte ladda mål')
    } finally {
      setLoading(false)
    }
  }

  async function saveGoal() {
    const amount = parseFloat(newTarget)
    if (!newName.trim() || isNaN(amount) || amount <= 0) {
      setSaveError('Fyll i namn och belopp')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          emoji: newEmoji,
          targetAmount: amount,
          targetDate: newDate || undefined,
        }),
      })
      if (!res.ok) throw new Error('failed')
      setShowSheet(false)
      setNewName('')
      setNewTarget('')
      setNewDate('')
      setNewEmoji(EMOJI_OPTIONS[0])
      await loadGoals()
    } catch {
      setSaveError('Kunde inte spara målet')
    } finally {
      setSaving(false)
    }
  }

  async function deleteGoal(id: string) {
    try {
      await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
      setGoals(prev => prev.filter(g => g.id !== id))
    } catch {
      setError('Kunde inte ta bort målet')
    } finally {
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] pb-24 sm:pb-0">
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">PULSE</h1>
        <Flag className="w-4 h-4 text-zinc-600" />
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Sparmål</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Följ dina ekonomiska mål.</p>
          </div>
          <button
            onClick={() => setShowSheet(true)}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 px-3 py-2 rounded-xl transition-all"
          >
            <Plus className="w-3 h-3" />
            Lägg till mål
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 animate-pulse h-28"
              />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#0f0f0f] border border-white/[0.08] flex items-center justify-center">
              <Flag className="w-7 h-7 text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-medium">Inga mål ännu</p>
              <p className="text-sm text-zinc-600 mt-1">
                Skapa ditt första sparmål för att börja följa dina framsteg.
              </p>
            </div>
            <button
              onClick={() => setShowSheet(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Lägg till mål
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(goal => {
              const pct = Math.min(100, goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0)
              const achieved = goal.savedAmount >= goal.targetAmount

              return (
                <div
                  key={goal.id}
                  className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl leading-none shrink-0">{goal.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-zinc-100 truncate">{goal.name}</p>
                          {achieved && (
                            <span className="text-xs bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                              Uppnått! 🎉
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Mål: {fmt(goal.targetAmount)} kr
                        </p>
                      </div>
                    </div>

                    {confirmDeleteId === goal.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void deleteGoal(goal.id)}
                          className="text-xs text-red-400 hover:text-red-300 bg-red-950/20 border border-red-500/20 px-2 py-1 rounded-lg transition-colors"
                        >
                          Ja, ta bort
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(goal.id)}
                        className="text-zinc-700 hover:text-zinc-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-[#1c1c1c] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${achieved ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-zinc-500">
                        {fmt(goal.savedAmount)} kr av {fmt(goal.targetAmount)} kr sparade
                      </p>
                      <p className="text-xs text-zinc-600">{Math.round(pct)}%</p>
                    </div>
                  </div>

                  {/* Target date or months to go */}
                  {(goal.targetDate || goal.monthsToGo !== null) && !achieved && (
                    <p className="text-xs text-zinc-600 mt-1.5">
                      {goal.targetDate && (
                        <span>Mål: {formatTargetDate(goal.targetDate)} · {monthsUntil(goal.targetDate)} mån kvar</span>
                      )}
                      {!goal.targetDate && goal.monthsToGo !== null && (
                        <span>~{goal.monthsToGo} mån till målet i nuvarande spartakt</span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Add goal sheet */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSheet(false)}
          />

          {/* Sheet */}
          <div className="relative w-full sm:max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-zinc-100">Nytt sparmål</h3>
              <button
                onClick={() => setShowSheet(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Emoji picker */}
            <div>
              <p className="text-xs text-zinc-500 mb-2.5">Välj ikon</p>
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewEmoji(e)}
                    className={`relative flex items-center justify-center text-2xl h-12 rounded-xl transition-all active:scale-95 ${
                      newEmoji === e
                        ? 'bg-emerald-950/60 ring-2 ring-emerald-500/50 ring-offset-1 ring-offset-[#0f0f0f]'
                        : 'bg-[#161616] border border-white/[0.06] hover:bg-[#1c1c1c] hover:border-white/[0.15]'
                    }`}
                  >
                    {e}
                    {newEmoji === e && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f0f0f]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Namn</p>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="T.ex. Semesterresa"
                className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Target amount */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Målbelopp</p>
              <div className="relative">
                <input
                  type="number"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  placeholder="50000"
                  min={1}
                  className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">
                  kr
                </span>
              </div>
            </div>

            {/* Target date (optional) */}
            <div>
              <p className="text-xs text-zinc-500 mb-1.5">Måldatum (valfritt)</p>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full bg-[#161616] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50 [color-scheme:dark]"
              />
            </div>

            {saveError && (
              <p className="text-xs text-red-400">{saveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveGoal()}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm py-2.5 rounded-xl font-medium transition-colors"
              >
                {saving ? 'Sparar...' : 'Spara mål'}
              </button>
              <button
                onClick={() => setShowSheet(false)}
                className="px-4 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
