'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Send, ArrowLeft, Sparkles, Trash2, ChevronDown, TrendingUp, CreditCard, PiggyBank, Calendar, BarChart3, Lock } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_GROUPS = [
  {
    label: 'Denna månad',
    icon: BarChart3,
    questions: [
      'Vad har jag spenderat mest på denna månad?',
      'Hur mycket har jag spenderat totalt denna månad?',
      'Hur ligger jag till mot mitt sparmål?',
    ],
  },
  {
    label: 'Vanor & mönster',
    icon: TrendingUp,
    questions: [
      'Vilka är mina dyraste vanor?',
      'Hur mycket går jag på mat och restaurang per vecka?',
      'Vilka dagar spenderar jag mest?',
    ],
  },
  {
    label: 'Prenumerationer',
    icon: CreditCard,
    questions: [
      'Vilka prenumerationer har jag?',
      'Vad kostar mina prenumerationer per år?',
      'Vilka prenumerationer kan jag avsluta?',
    ],
  },
  {
    label: 'Spara mer',
    icon: PiggyBank,
    questions: [
      'Var kan jag spara mest pengar?',
      'Hur kan jag nå mitt sparmål snabbare?',
      'Vad händer om jag slutar äta ute?',
    ],
  },
  {
    label: 'Jämförelser',
    icon: Calendar,
    questions: [
      'Jämför denna månad med förra månaden',
      'Har mina utgifter ökat eller minskat?',
      'Vad är mitt dyraste köp senaste månaden?',
    ],
  },
]

function renderAssistantText(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1.5" />)
      continue
    }

    const toBold = (s: string) => s.replace(/\*\*(.*?)\*\*/g, (_, m: string) => `<b class="text-zinc-100 font-semibold">${m}</b>`)

    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = toBold(line.replace(/^[\s•\-]+/, ''))
      elements.push(
        <div key={key++} className="flex gap-2.5 text-sm leading-relaxed text-zinc-300">
          <span className="text-emerald-500 mt-1 shrink-0 text-xs">▸</span>
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      )
      continue
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const num = line.match(/^(\d+)\./)?.[1]
      const content = toBold(line.replace(/^\d+\.\s/, ''))
      elements.push(
        <div key={key++} className="flex gap-2.5 text-sm leading-relaxed text-zinc-300">
          <span className="text-emerald-600 font-mono text-xs mt-1 shrink-0 w-4">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      )
      continue
    }

    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-zinc-300"
        dangerouslySetInnerHTML={{ __html: toBold(line) }} />
    )
  }

  return <div className="space-y-1.5">{elements}</div>
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeGroup, setActiveGroup] = useState(0)
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null)
  const [requiresPremium, setRequiresPremium] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    setShowSuggestions(false)
    setRateLimitMsg(null)
    const userMsg: Message = { role: 'user', content: text.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setStreaming(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (res.status === 403) {
        const data = await res.json() as { error?: string; requiresPremium?: boolean }
        if (data.requiresPremium) setRequiresPremium(true)
        else setRateLimitMsg(data.error ?? 'Åtkomst nekad.')
        setMessages(prev => prev.slice(0, -1))
        setStreaming(false)
        return
      }

      if (res.status === 429) {
        const data = await res.json() as { error?: string }
        setRateLimitMsg(data.error ?? 'Daggränsen nådd.')
        setMessages(prev => prev.slice(0, -1))
        setStreaming(false)
        return
      }

      if (!res.ok || !res.body) {
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: 'Något gick fel. Försök igen.' }
          return copy
        })
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const snap = accumulated
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: snap }
          return copy
        })
      }
    } catch {
      setMessages(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: 'Kunde inte nå Pulse. Kontrollera din anslutning.' }
        return copy
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  const activeQuestions = SUGGESTED_GROUPS[activeGroup]?.questions ?? []

  return (
    <div className="flex flex-col bg-[#080808]" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="bg-[#080808]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 sm:top-12 z-30 shrink-0">
        <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-7 h-7 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-sm font-bold text-white">Fråga Pulse</h1>
          <p className="text-[10px] text-zinc-600 leading-none">AI-ekonomiassistent</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setRateLimitMsg(null) }}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </header>

      {/* Premium wall */}
      {requiresPremium && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white mb-1">Pulse Premium</h2>
            <p className="text-sm text-zinc-500 max-w-xs">
              AI-chatten ingår i Pulse Premium — tillsammans med personliga notiser, månadsanalys och mer.
            </p>
          </div>
          <Link
            href="/premium"
            className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-2xl transition-colors text-sm"
          >
            Se Pulse Premium
          </Link>
        </div>
      )}

      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto px-4 py-4 ${requiresPremium ? 'hidden' : ''}`}>
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Empty state hero */}
            <div className="flex-1 flex flex-col items-center justify-center pb-4">
              <div className="w-14 h-14 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-zinc-200 mb-1">Fråga vad som helst</h2>
              <p className="text-sm text-zinc-600 text-center max-w-xs">
                Pulse har tillgång till dina senaste 60 dagars transaktioner och vet hur din ekonomi ser ut.
              </p>
            </div>

            {/* Grouped suggestions */}
            <div className="space-y-3 pb-2">
              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {SUGGESTED_GROUPS.map((g, i) => {
                  const Icon = g.icon
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveGroup(i)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border shrink-0 ${
                        activeGroup === i
                          ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400'
                          : 'bg-[#161616] border-white/[0.06] text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {g.label}
                    </button>
                  )
                })}
              </div>

              {/* Questions for active group */}
              <div className="space-y-2">
                {activeQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => void sendMessage(q)}
                    className="w-full text-left text-sm bg-[#0f0f0f] hover:bg-[#141414] border border-white/[0.06] hover:border-white/[0.12] text-zinc-400 hover:text-zinc-200 px-4 py-3 rounded-xl transition-all flex items-center justify-between group"
                  >
                    <span>{q}</span>
                    <Send className="w-3 h-3 text-zinc-700 group-hover:text-emerald-500 transition-colors shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-3 h-3 text-emerald-400" />
                  </div>
                )}
                {msg.role === 'user' ? (
                  <div className="max-w-[78%] bg-[#1a1a1a] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-zinc-100 leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="flex-1 max-w-[88%]">
                    {msg.content === '' && streaming ? (
                      <div className="flex gap-1 items-center py-2 px-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    ) : (
                      <div className="py-0.5">
                        {renderAssistantText(msg.content)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Rate limit warning */}
      {rateLimitMsg && (
        <div className="shrink-0 mx-4 mb-2 px-4 py-2.5 bg-amber-950/30 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-400">{rateLimitMsg}</p>
        </div>
      )}

      {/* Suggestion chips when chatting */}
      {messages.length > 0 && showSuggestions && (
        <div className="shrink-0 px-4 pb-2 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {SUGGESTED_GROUPS.map((g, i) => {
              const Icon = g.icon
              return (
                <button key={i} onClick={() => setActiveGroup(i)}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg whitespace-nowrap border shrink-0 transition-all ${
                    activeGroup === i ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400' : 'bg-[#161616] border-white/[0.06] text-zinc-600'
                  }`}>
                  <Icon className="w-2.5 h-2.5" />{g.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeQuestions.map(q => (
              <button key={q} onClick={() => void sendMessage(q)}
                className="text-xs bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-xl transition-colors text-left">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#080808]/95 backdrop-blur-xl px-4 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <form onSubmit={e => { e.preventDefault(); void sendMessage(input) }} className="flex items-center gap-2">
          {messages.length > 0 && (
            <button type="button" onClick={() => setShowSuggestions(s => !s)}
              className={`shrink-0 p-2.5 rounded-xl border transition-all ${
                showSuggestions
                  ? 'bg-[#1c1c1c] border-emerald-500/40 text-emerald-400'
                  : 'bg-[#161616] border-white/[0.06] text-zinc-600 hover:text-zinc-400'
              }`}>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={streaming}
            placeholder={streaming ? 'Pulse skriver...' : 'Fråga om din ekonomi…'}
            className="flex-1 bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
          />
          <button type="submit" disabled={!input.trim() || streaming}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-2.5 transition-all active:scale-95 shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
