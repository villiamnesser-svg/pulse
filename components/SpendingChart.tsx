'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

interface DayData {
  date: string
  amount: number
  dayOfWeek: number
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-white/[0.1] rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[11px] text-zinc-500 mb-0.5">{shortDate(label as string)}</p>
      <p className="text-sm font-semibold text-white">{(payload[0].value as number).toLocaleString('sv-SE')} kr</p>
    </div>
  )
}

export default function SpendingChart() {
  const [data, setData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/spending')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((d) => { setData(d as DayData[]); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 animate-pulse">
        <div className="h-3 w-32 bg-white/[0.06] rounded mb-5" />
        <div className="h-32 bg-white/[0.04] rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 text-center">
        <p className="text-xs text-zinc-600 py-8">Kunde inte ladda utgiftsdata.</p>
      </div>
    )
  }

  if (!loading && data.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5 text-center">
        <p className="text-xs text-zinc-600 py-8">Inga utgifter de senaste 30 dagarna.</p>
      </div>
    )
  }

  const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.amount, 0) / data.length) : 0
  // Use reduce instead of spread to avoid call-stack overflow on large arrays
  const max = data.reduce((m, d) => Math.max(m, d.amount), 1)
  const today = new Date().toISOString().slice(0, 10)

  // Show every 5th label to avoid clutter
  const tickDates = data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((d) => d.date)

  return (
    <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500">
          Utgifter senaste 30 dagarna
        </h3>
        <span className="text-[11px] text-zinc-600">snitt {avg.toLocaleString('sv-SE')} kr/dag</span>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap="30%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#52525b' }}
            tickLine={false}
            axisLine={false}
            ticks={tickDates}
            tickFormatter={shortDate}
          />
          <YAxis hide domain={[0, max * 1.15]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine
            y={avg}
            stroke="rgba(255,255,255,0.1)"
            strokeDasharray="3 3"
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
            {data.map((entry) => {
              const isWeekend = entry.dayOfWeek === 0 || entry.dayOfWeek === 6
              const isToday = entry.date === today
              const isHigh = avg > 0 && entry.amount > avg * 1.5

              let color = isWeekend ? '#6366f1' : '#10b981'
              if (isHigh) color = '#f59e0b'
              if (isToday) color = '#818cf8'

              return <Cell key={entry.date} fill={color} fillOpacity={entry.amount === 0 ? 0.15 : 0.75} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500/75" />
          <span className="text-[10px] text-zinc-600">Vardag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-indigo-500/75" />
          <span className="text-[10px] text-zinc-600">Helg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500/75" />
          <span className="text-[10px] text-zinc-600">Högt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-400/75" />
          <span className="text-[10px] text-zinc-600">Idag</span>
        </div>
      </div>
    </div>
  )
}
