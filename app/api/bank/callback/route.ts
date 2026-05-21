import { NextRequest, NextResponse } from 'next/server'
import { getUserToken, fetchAccounts } from '@/lib/tink'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // userId passed via state param
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=${error ?? 'no_code'}`)
  }

  if (!state) {
    return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=no_state`)
  }

  try {
    // State may be "userId" or "userId|source"
    const [userId, source] = state.split('|')
    const successRedirect = source === 'onboarding'
      ? `${baseUrl}/onboarding?bank=connected`
      : `${baseUrl}/settings?bank=connected`

    // Exchange code for tokens
    const { access_token, refresh_token } = await getUserToken(code)

    // Fetch accounts
    const accounts = await fetchAccounts(access_token)
    const accountIds = accounts.map(a => a.id)
    // Use the first account's financialInstitutionId as the institution identifier
    const institutionId = accounts[0]?.financialInstitutionId ?? 'tink'

    // Save connection
    await prisma.bankConnection.upsert({
      where: { requisitionId: code },
      update: {
        status: 'linked',
        accountIds: JSON.stringify(accountIds),
        keys: JSON.stringify({ access_token, refresh_token }),
        institutionId,
      },
      create: {
        userId,
        requisitionId: code,
        institutionId,
        accountIds: JSON.stringify(accountIds),
        status: 'linked',
        keys: JSON.stringify({ access_token, refresh_token }),
      },
    })

    return NextResponse.redirect(successRedirect)
  } catch (err) {
    console.error('Bank callback error:', err)
    const errRedirect = state.includes('|onboarding')
      ? `${baseUrl}/onboarding?bank=error`
      : `${baseUrl}/settings?bank=error`
    return NextResponse.redirect(errRedirect)
  }
}
