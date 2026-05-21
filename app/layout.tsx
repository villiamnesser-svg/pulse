import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import MobileNav from '@/components/MobileNav'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Pulse — AI Ekonomiassistent',
  description: 'Din personliga AI-finansassistent. Spåra utgifter, få insikter och nå dina ekonomiska mål.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pulse',
  },
  icons: {
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#080808" />
      </head>
      <body className="min-h-full antialiased bg-[#080808] text-[#f0f0f0]">
        <MobileNav />
        {/* Offset for desktop top nav (h-12) */}
        <div className="sm:pt-12">
          {children}
        </div>
      </body>
    </html>
  )
}
