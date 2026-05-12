'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Activity, Send, ArrowLeft, MessageCircle, Trash2, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED = [
  'Vad har jag spenderat mest på denna månad?',
  'Hur mycket går jag på mat per vecka?',
  'Vilka prenumerationer har jag?',
  'Är jag på väg att klara mitt sparmål?',
  'Vad är mitt dyraste köp senaste månaden?',
  'Jämför mina utgifter med förra månaden',
]

function renderAssistantText(text: string) {
  // Split on double newlines for paragraphs, single newlines preserved
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
      continue
    }

    // Bold **text** inline
    const formatted = line.replace(/\*\*(.*?)\*\*/g, (_, m: string) => `<b>${m}</b>`)

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
      const content = line.replace(/^[\s•-]+/, '')
      const formattedContent = content.replace(/\*\*(.*?)\*\*/g, (_, m: string) => `<b>${m}</b>`)
      elements.push(
        <div key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-emerald-500 mt-0.5 shrink-0">·</span>
          <span dangerouslySetInnerHTML={{ __html: formattedContent }} />
        </div>
      )
      continue
    }

    elements.push(
      <p key={key++} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />
    )
  }

  return elements
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return

    setShowSuggestions(false)
    const userMsg: Message = { role: 'user', content: text.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    setStreaming(true)

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) {
        setMessages((prev) => {
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
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: snap }
          return copy
        })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: 'Något gick fel. Kontrollera din anslutning.' }
        return copy
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendMessage(input)
  }

  return (
    <div className="flex flex-col bg-[#080808]" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shrink-0">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Activity className="w-4 h-4 text-emerald-500" />
        <h1 className="text-sm font-black tracking-widest text-white uppercase flex-1">Fråga Pulse</h1>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
            title="Rensa konversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <MessageCircle className="w-4 h-4 text-zinc-600" />
      </header>

      {/* Messages area */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-zinc-400 text-sm">Ställ en fråga om din ekonomi</p>
              <p className="text-zinc-600 text-xs mt-1">Pulse har tillgång till dina senaste 60 dagars transaktioner</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-sm">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => void sendMessage(q)}
                  className="text-xs bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] hover:border-white/[0.14] text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-xl transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[80%] bg-[#161616] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-zinc-100 leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="max-w-[88%] text-zinc-200 py-1 space-y-1">
                    {msg.content === '' && streaming ? (
                      <span className="inline-flex gap-1 items-center py-1">
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : (
                      renderAssistantText(msg.content)
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Suggestion chips when there are already messages */}
      {messages.length > 0 && showSuggestions && (
        <div className="shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => void sendMessage(q)}
              className="text-xs bg-[#161616] hover:bg-[#1c1c1c] border border-white/[0.08] text-zinc-500 hover:text-zinc-300 px-2.5 py-1.5 rounded-xl transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div
        className="shrink-0 border-t border-white/[0.06] bg-[#080808]/95 backdrop-blur-xl px-4 py-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSuggestions((s) => !s)}
              className={`shrink-0 p-2.5 rounded-xl border transition-colors ${
                showSuggestions
                  ? 'bg-[#1c1c1c] border-emerald-500/40 text-emerald-400'
                  : 'bg-[#161616] border-white/[0.08] text-zinc-600 hover:text-zinc-400'
              }`}
              title="Förslag"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
            placeholder="Fråga om din ekonomi…"
            className="flex-1 bg-[#161616] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-2.5 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
