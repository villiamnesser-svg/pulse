import { NextRequest, NextResponse } from 'next/server'
import { getRequisition } from '@/lib/nordigen'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse-xi-umber.vercel.app'

  // Nordigen sends: ?ref=<requisitionId>
  const ref = searchParams.get('ref')
  // Tink sends: ?code=... (kept for backward compat)
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=${error}`)
  }

  if (!ref) {
    return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=no_ref`)
  }

  try {
    // Fetch the requisition from Nordigen to get linked account IDs
    const requisition = await getRequisition(ref)

    if (requisition.status !== 'LN' && requisition.accounts.length === 0) {
      // Not yet linked — user may have cancelled
      return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=not_linked`)
    }

    // Look up our pending BankConnection
    const connection = await prisma.bankConnection.findUnique({ where: { requisitionId: ref } })
    if (!connection) {
      return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=no_connection`)
    }

    // Derive redirect target from reference stored at connect time
    // reference format: "userId|source|timestamp"
    const [, source] = (requisition.reference ?? '').split('|')
    const successRedirect = source === 'onboarding'
      ? `${baseUrl}/onboarding?bank=connected`
      : `${baseUrl}/settings?bank=connected`

    // Update connection with real account IDs
    await prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        status: 'linked',
        accountIds: JSON.stringify(requisition.accounts),
        institutionId: requisition.institution_id,
      },
    })

    return NextResponse.redirect(successRedirect)
  } catch (err) {
    console.error('Bank callback error:', err)
    return NextResponse.redirect(`${baseUrl}/settings?bank=error&reason=callback_failed`)
  }
}
