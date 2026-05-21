'use client'

import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { VelocityResult } from '@/lib/velocity'

interface VelocityCardProps {
  velocity: VelocityResult | null
  loading?: boolean
}

const levelConfig = {
  SAFE: {
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/10 text-emerald-400',
    badgeText: 'SAFE',
    accent: 'text-emerald-400',
    ring: '#10b981',
    ringBg: '#052e16',
    glow: '0 0 60px rgba(16,185,129,0.08)',
    Icon: TrendingUp,
  },
  WARNING: {
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/10 text-amber-400',
    badgeText: 'VARNING',
    accent: 'text-amber-400',
    ring: '#f59e0b',
    ringBg: '#1c1008',
    glow: '0 0 60px rgba(245,158,11,0.08)',
    Icon: AlertTriangle,
  },
  CRITICAL: {
    border: 'border-red-500/20',
    badge: 'bg-red-500/10 text-red-400',
    badgeText: 'KRITISK',
    accent: 'text-red-400',
    ring: '#ef4444',
    ringBg: '#1c0505',
    glow: '0 0 60px rgba(239,68,68,0.08)',
    Icon: TrendingDown,
  },
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('sv-SE')
}

function CircularProgress({
  progress,
  color,
  bgColor,
  size = 88,
}: {
  progress: number
  color: string
  bgColor: string
  size?: number
}) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(progress / 100, 1)
  const gap = circ - dash

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bgColor} strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
    </svg>
  )
}

export default function VelocityCard({ velocity, loading }: VelocityCardProps) {
  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-6 animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-3 bg-[#161616] rounded w-36" />
          <div className="h-6 bg-[#161616] rounded-full w-20" />
        </div>
        <div className="flex gap-6 mb-6">
          <div className="w-[88px] h-[88px] bg-[#161616] rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="h-10 bg-[#161616] rounded w-40 mb-2" />
            <div className="h-3 bg-[#161616] rounded w-32 mb-4" />
            <div className="h-4 bg-[#161616] rounded w-full" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="bg-[#161616] rounded-xl h-16" />)}
        </div>
      </div>
    )
  }

  if (!velocity) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-6 text-center py-10">
        <p className="text-sm text-zinc-500">Ladda upp transaktioner för att se din spending velocity.</p>
      </div>
    )
  }

  const cfg = levelConfig[velocity.level]
  const { Icon } = cfg

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const monthProgress = (velocity.daysElapsed / daysInMonth) * 100
  // Budget consumption: how much of projected vs baseline
  const budgetProgress = velocity.baselineMonthly > 0
    ? (velocity.projectedMonthTotal / velocity.baselineMonthly) * 100
    : 0

  return (
    <div
      className={`bg-[#0f0f0f] border ${cfg.border} rounded-2xl p-6`}
      style={{ boxShadow: cfg.glow }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Spending Velocity
        </span>
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${cfg.badge}`}>
          <Icon className="w-3 h-3" />
          {cfg.badgeText}
        </span>
      </div>

      {/* Main row: ring + numbers */}
      <div className="flex items-center gap-6 mb-6">
        {/* Circular ring — shows budget consumption, center shows same */}
        <div className="relative flex-shrink-0">
          <CircularProgress progress={budgetProgress} color={cfg.ring} bgColor={cfg.ringBg} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs font-bold text-zinc-300">{Math.round(budgetProgress)}%</span>
            <span className="text-[9px] text-zinc-600 leading-tight">av snitt</span>
          </div>
        </div>

        {/* Numbers */}
        <div className="flex-1 min-w-0">
          <p className={`text-3xl font-black tracking-tight ${cfg.accent} leading-none mb-1`}>
            {fmt(velocity.projectedMonthTotal)}
            <span className="text-base font-medium ml-1 text-zinc-500">kr</span>
          </p>
          <p className="text-xs text-zinc-500 mb-3">
            proj. · snitt{' '}
            <span className="text-zinc-300 font-medium">{fmt(velocity.baselineMonthly)} kr</span>
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed italic">{velocity.message}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#161616] border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-600 mb-1.5">Saldo</p>
          <p className="text-sm font-bold text-zinc-100">{fmt(velocity.currentBalance)}</p>
          <p className="text-[10px] text-zinc-600">kr</p>
        </div>
        <div className="bg-[#161616] border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-600 mb-1.5">Till lön</p>
          <p className="text-sm font-bold text-zinc-100">{velocity.daysUntilPayday}</p>
          <p className="text-[10px] text-zinc-600">dagar</p>
        </div>
        <div className="bg-[#161616] border border-white/[0.05] rounded-xl p-3">
          <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-zinc-600 mb-1.5">Per dag</p>
          <p className={`text-sm font-bold ${velocity.dailyBudgetRemaining < 150 ? 'text-red-400' : 'text-zinc-100'}`}>
            {fmt(velocity.dailyBudgetRemaining)}
          </p>
          <p className="text-[10px] text-zinc-600">kr/dag</p>
        </div>
      </div>
    </div>
  )
}
