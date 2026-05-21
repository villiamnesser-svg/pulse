const BASE = 'https://bankaccountdata.gocardless.com/api/v2'

// Swedbank SE institution ID
export const SWEDBANK_ID = 'SWEDBANK_SWEDSESS'

interface TokenResponse {
  access: string
  access_expires: number
  refresh: string
  refresh_expires: number
}

interface Requisition {
  id: string
  status: string
  link: string
  accounts: string[]
}

interface GCTransaction {
  transactionId?: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  debtorName?: string
  remittanceInformationUnstructured?: string
  remittanceInformationStructured?: string
  balanceAfterTransaction?: { balanceAmount: { amount: string } }
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

  const res = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless auth failed: ${err}`)
  }

  const data = (await res.json()) as TokenResponse
  cachedToken = { token: data.access, expiresAt: Date.now() + data.access_expires * 1000 }
  return data.access
}

async function gc<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless ${path} failed (${res.status}): ${err}`)
  }
  return res.json() as Promise<T>
}

export async function createRequisition(redirectUrl: string): Promise<Requisition> {
  return gc<Requisition>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: redirectUrl,
      institution_id: SWEDBANK_ID,
      language: 'SV',
      user_language: 'SV',
    }),
  })
}

export async function getRequisition(id: string): Promise<Requisition> {
  return gc<Requisition>(`/requisitions/${id}/`)
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string
): Promise<{ booked: GCTransaction[]; pending: GCTransaction[] }> {
  const params = dateFrom ? `?date_from=${dateFrom}` : ''
  const data = await gc<{ transactions: { booked: GCTransaction[]; pending: GCTransaction[] } }>(
    `/accounts/${accountId}/transactions/${params}`
  )
  return data.transactions
}

export async function getAccountBalances(accountId: string): Promise<number | null> {
  const data = await gc<{ balances: { balanceAmount: { amount: string }; balanceType: string }[] }>(
    `/accounts/${accountId}/balances/`
  )
  const interimBalance = data.balances.find(b => b.balanceType === 'interimAvailable' || b.balanceType === 'closingBooked')
  return interimBalance ? parseFloat(interimBalance.balanceAmount.amount) : null
}

export function parseMerchant(tx: GCTransaction): string {
  return (
    tx.creditorName ||
    tx.debtorName ||
    tx.remittanceInformationUnstructured ||
    tx.remittanceInformationStructured ||
    'Okänd'
  ).trim().substring(0, 100)
}

export function parseAmount(tx: GCTransaction): number {
  return parseFloat(tx.transactionAmount.amount)
}
