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
  description: 'Din personliga AI-finansassistent',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased bg-[#080808] text-[#f0f0f0]">
        {children}
        <MobileNav />
      </body>
    </html>
  )
}
