import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

// Paths publicly accessible without login
const PUBLIC_PATHS = ['/', '/login', '/register', '/privacy']
const PUBLIC_API = ['/api/auth/', '/api/bank/callback', '/api/share-import', '/api/heartbeat', '/api/bank/sync/cron']
// Auth-only: redirect logged-in users to /dashboard
const AUTH_ONLY = ['/login', '/register']

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow static files and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.match(/\.(png|ico|jpg|svg|webmanifest|txt)$/)
  ) {
    return NextResponse.next()
  }

  // Always allow public API routes
  if (PUBLIC_API.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // All other /api/ routes — let individual handlers return 401 if needed
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(req)

  // Logged-in users on login/register → dashboard
  if (session && AUTH_ONLY.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Public pages — allow everyone
  if (PUBLIC_PATHS.some(p => pathname === p)) {
    return NextResponse.next()
  }

  // Everything else requires auth
  if (!session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
}
