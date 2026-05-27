// GoCardless Bank Account Data (formerly Nordigen)
// Docs: https://developer.gocardless.com/bank-account-data/overview

const BASE = 'https://bankaccountdata.gocardless.com/api/v2'

// ─── App-level token (cached in module memory, ~24h TTL) ──────────────────────

let _tokenCache: { access: string; expiry: number } | null = null

export async function getAppToken(): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expiry > now + 120_000) {
    return _tokenCache.access
  }

  const secretId = process.env.NORDIGEN_SECRET_ID
  const secretKey = process.env.NORDIGEN_SECRET_KEY
  if (!secretId || !secretKey) throw new Error('NORDIGEN_SECRET_ID / NORDIGEN_SECRET_KEY not set')

  const res = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Nordigen token error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { access: string; access_expires: number }
  _tokenCache = { access: data.access, expiry: now + data.access_expires * 1000 }
  return data.access
}

// ─── Institutions ──────────────────────────────────────────────────────────────

export interface Institution {
  id: string
  name: string
  bic: string
  countries: string[]
  logo: string
  transaction_total_days: string
  supported_features: string[]
}

export async function listSwedishInstitutions(): Promise<Institution[]> {
  const token = await getAppToken()
  const res = await fetch(`${BASE}/institutions/?country=SE`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to list institutions: ${res.status}`)
  return res.json() as Promise<Institution[]>
}

// ─── Requisitions ──────────────────────────────────────────────────────────────

export interface Requisition {
  id: string
  created: string
  redirect: string
  status: string         // CR | LN | EX | RJ | SA | GA | UA
  institution_id: string
  accounts: string[]
  link: string
  reference: string
  user_language: string
}

export async function createRequisition(
  institutionId: string,
  redirectUri: string,
  reference: string,
): Promise<Requisition> {
  const token = await getAppToken()
  const res = await fetch(`${BASE}/requisitions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      redirect: redirectUri,
      institution_id: institutionId,
      reference,
      user_language: 'SV',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create requisition: ${text}`)
  }
  return res.json() as Promise<Requisition>
}

export async function getRequisition(requisitionId: string): Promise<Requisition> {
  const token = await getAppToken()
  const res = await fetch(`${BASE}/requisitions/${requisitionId}/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Failed to get requisition ${requisitionId}: ${res.status}`)
  return res.json() as Promise<Requisition>
}

export async function deleteRequisition(requisitionId: string): Promise<void> {
  try {
    const token = await getAppToken()
    await fetch(`${BASE}/requisitions/${requisitionId}/`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // Best-effort — don't fail disconnect if Nordigen API is down
  }
}

// ─── Transactions ──────────────────────────────────────────────────────────────

export interface NordigenTx {
  transactionId?: string
  internalTransactionId?: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  debtorName?: string
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  remittanceInformationStructured?: string
  creditorAccount?: { iban: string }
  debtorAccount?: { iban: string }
  proprietaryBankTransactionCode?: string
  bankTransactionCode?: string
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<NordigenTx[]> {
  const token = await getAppToken()
  const url = dateFrom
    ? `${BASE}/accounts/${accountId}/transactions/?date_from=${dateFrom}`
    : `${BASE}/accounts/${accountId}/transactions/`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const text = await res.text()
    // 429 = rate-limited, 4xx = likely expired requisition
    throw new Error(`Nordigen transactions ${accountId} → ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { transactions: { booked: NordigenTx[]; pending?: NordigenTx[] } }
  return data.transactions?.booked ?? []
}

// ─── Balance ───────────────────────────────────────────────────────────────────

export interface NordigenBalance {
  balanceAmount: { amount: string; currency: string }
  balanceType: string
  referenceDate?: string
}

export async function getAccountBalance(accountId: string): Promise<number> {
  try {
    const token = await getAppToken()
    const res = await fetch(`${BASE}/accounts/${accountId}/balances/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) return 0
    const data = (await res.json()) as { balances: NordigenBalance[] }
    const closing = data.balances?.find(b => b.balanceType === 'closingBooked') ?? data.balances?.[0]
    return closing ? parseFloat(closing.balanceAmount.amount) : 0
  } catch {
    return 0
  }
}

// ─── Conversion helper ─────────────────────────────────────────────────────────

export function txToLocal(tx: NordigenTx, fallbackId: string): {
  id: string
  merchant: string
  amount: number
  date: Date
  isIncome: boolean
} {
  const amount = parseFloat(tx.transactionAmount.amount)
  const isIncome = amount > 0

  // Best-effort merchant name
  const merchant = (
    (isIncome ? tx.debtorName : tx.creditorName) ||
    tx.remittanceInformationUnstructured ||
    (tx.remittanceInformationUnstructuredArray ?? []).join(' ') ||
    tx.remittanceInformationStructured ||
    tx.proprietaryBankTransactionCode ||
    'Okänd'
  ).trim()

  const id = tx.transactionId || tx.internalTransactionId || fallbackId

  return { id, merchant, amount, date: new Date(tx.bookingDate), isIncome }
}
