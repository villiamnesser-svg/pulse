'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Inloggning misslyckades'); return }
      window.location.href = '/dashboard'
    } catch {
      setError('Något gick fel. Försök igen.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all w-full'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#080808]">
      <div className="w-full max-w-sm">
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl p-8">
          <div className="flex items-center gap-2 mb-8">
            <Activity className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-black tracking-widest text-white uppercase">PULSE</span>
          </div>

          <h1 className="text-xl font-bold text-zinc-100 mb-1">Logga in</h1>
          <p className="text-sm text-zinc-500 mb-6">Välkommen tillbaka.</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block">
                E-post
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.se"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5 block">
                Lösenord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/30 border border-red-500/20 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loggar in...</> : 'Logga in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-sm text-zinc-600 text-center">
          Inget konto?{' '}
          <Link href="/register" className="text-emerald-500 hover:text-emerald-400 transition-colors">
            Skapa ett här
          </Link>
        </p>
      </div>
    </div>
  )
}
