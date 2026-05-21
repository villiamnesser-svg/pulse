const TINK_BASE = 'https://api.tink.com'
const CLIENT_ID = process.env.TINK_CLIENT_ID!
const CLIENT_SECRET = process.env.TINK_CLIENT_SECRET!

interface TinkToken {
  access_token: string
  expires_in: number
}

// Client credentials token (app-level, not user-level)
export async function getClientToken(scope: string): Promise<string> {
  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink token error: ${err}`)
  }
  const data = (await res.json()) as TinkToken
  return data.access_token
}

// Exchange authorization code for user access token
export async function getUserToken(code: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink user token error: ${err}`)
  }
  return res.json() as Promise<{ access_token: string; refresh_token: string }>
}

// Refresh user access token
export async function refreshUserToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  const res = await fetch(`${TINK_BASE}/api/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json() as Promise<{ access_token: string; refresh_token: string }>
}

// Create a Tink Link URL — user authenticates via Tink, code comes back in redirect
export function createAuthUrl(userId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'accounts:read,balances:read,transactions:read,provider-consents:read',
    market: 'SE',
    locale: 'sv_SE',
    state: userId,
  })
  return `https://link.tink.com/1.0/transactions/connect-accounts?${params}`
}

export interface TinkTransaction {
  id: string
  accountId: string
  amount: { value: { unscaledValue: number; scale: number }; currencyCode: string }
  dates: { booked: string }
  descriptions: { original: string; display: string }
  status: string
  types: { type: string }
}

export interface TinkAccount {
  id: string
  name: string
  type: string
  financialInstitutionId?: string
  balances: { booked: { amount: { value: { unscaledValue: number; scale: number }; currencyCode: string } } }
}

// Fetch accounts for a user
export async function fetchAccounts(accessToken: string): Promise<TinkAccount[]> {
  const res = await fetch(`${TINK_BASE}/data/v2/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch accounts')
  const data = (await res.json()) as { accounts: TinkAccount[] }
  return data.accounts ?? []
}

// Fetch transactions for a user (last 90 days by default)
export async function fetchTransactions(
  accessToken: string,
  accountIds: string[],
  pageToken?: string,
): Promise<{ transactions: TinkTransaction[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    accountIdIn: accountIds.join(','),
    pageSize: '100',
  })
  if (pageToken) params.set('pageToken', pageToken)

  const res = await fetch(`${TINK_BASE}/data/v2/transactions?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch transactions')
  const data = (await res.json()) as { transactions: TinkTransaction[]; nextPageToken?: string }
  return data
}

// Convert Tink amount to SEK float
export function tinkAmountToFloat(amount: TinkTransaction['amount']): number {
  const { unscaledValue, scale } = amount.value
  return unscaledValue / Math.pow(10, scale)
}
