'use client'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'

interface ScoreData {
  total: number               // 0–100
  savingsRate: number         // 0–100
  budgetAdherence: number     // 0–100
  subscriptionRatio: number   // 0–100
  cashCushion: number         // 0–100
  savingsRateRaw: number      // actual %
  subscriptionRatioRaw: number
  cashCushionDays: number
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f1f1f" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  )
}

function SubScore({ label, score, detail }: { label: string; score: number; detail: string }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-xs text-zinc-500">{detail}</span>
      </div>
      <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div className={`h-1 rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

export default function HealthScore() {
  const [data, setData] = useState<ScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/health-score')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d as ScoreData | null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 w-36 bg-white/[0.06] rounded mb-4" />
        <div className="h-20 bg-white/[0.04] rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const grade = data.total >= 80 ? 'A' : data.total >= 65 ? 'B' : data.total >= 50 ? 'C' : data.total >= 35 ? 'D' : 'F'
  const gradeColor = data.total >= 80 ? 'text-emerald-400' : data.total >= 65 ? 'text-emerald-500' : data.total >= 50 ? 'text-amber-400' : 'text-red-400'
  const label = data.total >= 80 ? 'Utmärkt' : data.total >= 65 ? 'Bra' : data.total >= 50 ? 'Okej' : data.total >= 35 ? 'Behöver förbättras' : 'Kritiskt'

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-3.5 h-3.5 text-zinc-500" />
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Finansiell hälsa
        </h3>
      </div>

      {/* Score ring + grade */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative shrink-0">
          <ScoreRing score={data.total} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-black ${gradeColor}`}>{grade}</span>
          </div>
        </div>
        <div>
          <p className={`text-lg font-black ${gradeColor}`}>{data.total}/100</p>
          <p className="text-sm text-zinc-400">{label}</p>
          <p className="text-xs text-zinc-600 mt-0.5">Baserat på denna månad</p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="space-y-3">
        <SubScore
          label="Sparkvot"
          score={data.savingsRate}
          detail={`${Math.round(data.savingsRateRaw)}% av inkomst`}
        />
        <SubScore
          label="Budgetföljning"
          score={data.budgetAdherence}
          detail={data.budgetAdherence >= 70 ? 'På rätt spår' : 'Över snitt'}
        />
        <SubScore
          label="Prenumerationsbörda"
          score={data.subscriptionRatio}
          detail={`${Math.round(data.subscriptionRatioRaw)}% av inkomst`}
        />
        <SubScore
          label="Kassabuffert"
          score={data.cashCushion}
          detail={`${data.cashCushionDays} dagars utgifter`}
        />
      </div>
    </div>
  )
}
