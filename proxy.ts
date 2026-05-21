import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/privacy',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/share-import',
  '/api/heartbeat',
  '/api/bank/sync',
]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow static files and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.match(/\.(png|ico|jpg|svg|webmanifest)$/)
  ) {
    return NextResponse.next()
  }

  // Allow public paths without auth
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check session
  const session = await getSessionFromRequest(req)

  // If no session and trying to access protected page, redirect to login
  if (!session && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
}
