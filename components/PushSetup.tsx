'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Loader2, X } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer as ArrayBuffer
}

type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading' | 'ios-standalone-required'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches
}

interface PushSetupProps {
  /** If true, shows a full banner instead of just the header button */
  banner?: boolean
  onDismiss?: () => void
}

export default function PushSetup({ banner, onDismiss }: PushSetupProps) {
  const [status, setStatus] = useState<PushStatus>('loading')

  useEffect(() => {
    let cancelled = false
    const done = (s: PushStatus) => { if (!cancelled) setStatus(s) }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      // iOS Safari requires Add to Home Screen for push
      done(isIOS() && !isStandalone() ? 'ios-standalone-required' : 'unsupported')
      return
    }
    try {
      if (Notification.permission === 'denied') { done('denied'); return }
    } catch {
      done(isIOS() && !isStandalone() ? 'ios-standalone-required' : 'unsupported')
      return
    }

    // Safety timeout — never stay stuck in 'loading'
    const timeout = setTimeout(() => done('unsubscribed'), 2500)

    navigator.serviceWorker.getRegistration('/sw.js')
      .then(async (reg) => {
        clearTimeout(timeout)
        if (!reg) { done('unsubscribed'); return }
        const sub = await reg.pushManager.getSubscription()
        done(sub ? 'subscribed' : 'unsubscribed')
      })
      .catch(() => { clearTimeout(timeout); done('unsubscribed') })

    return () => { cancelled = true; clearTimeout(timeout) }
  }, [])

  async function subscribe() {
    try {
      setStatus('loading')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); return }

      // Register SW, then wait for it to fully activate before subscribing
      await navigator.serviceWorker.register('/sw.js')
      const reg = await navigator.serviceWorker.ready

      const keyRes = await fetch('/api/push')
      const { publicKey } = (await keyRes.json()) as { publicKey: string | null }
      if (!publicKey) { setStatus('unsubscribed'); return }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      setStatus('subscribed')
      onDismiss?.()
    } catch (err) {
      console.error('Push subscription failed:', err)
      setStatus('unsubscribed')
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      setStatus('unsubscribed')
    } catch (err) {
      console.error('Unsubscribe failed:', err)
    }
  }

  if (status === 'unsupported') return null

  // ── Banner variant (shown on dashboard if not subscribed) ──
  if (banner) {
    if (status === 'loading' || status === 'subscribed') return null
    return (
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-950/60 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200">Aktivera push-notiser</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {status === 'denied'
              ? 'Notiser är blockerade i din webbläsare. Tillåt dem under webbläsarens inställningar.'
              : status === 'ios-standalone-required'
              ? 'På iPhone: tryck på delningsikonen och välj "Lägg till på hemskärmen" — öppna sedan appen därifrån för att aktivera notiser.'
              : 'Få varningar direkt när din ekonomi behöver uppmärksamhet — utan att öppna appen.'}
          </p>
          {status !== 'denied' && status !== 'ios-standalone-required' && (
            <button
              onClick={() => void subscribe()}
              className="mt-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Aktivera notiser
            </button>
          )}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // ── Header icon button ──
  return (
    <button
      onClick={() => void (status === 'subscribed' ? unsubscribe() : subscribe())}
      disabled={status === 'loading' || status === 'denied' || status === 'ios-standalone-required'}
      title={
        status === 'subscribed' ? 'Notiser på — klicka för att stänga av'
          : status === 'denied' ? 'Notiser blockerade i webbläsaren'
          : status === 'ios-standalone-required' ? 'Lägg till på hemskärmen för notiser på iPhone'
          : 'Aktivera notiser'
      }
      className="relative text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {status === 'loading' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : status === 'subscribed' ? (
        <Bell className="w-4 h-4 text-emerald-400" />
      ) : (
        <>
          <BellOff className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full" />
        </>
      )}
      <span className="hidden sm:inline">
        {status === 'subscribed' ? 'Notiser på'
          : status === 'denied' ? 'Blockerade'
          : status === 'ios-standalone-required' ? 'Lägg till på hemskärmen'
          : 'Notiser av'}
      </span>
    </button>
  )
}
