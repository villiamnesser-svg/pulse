export interface ParsedTransaction {
  id: string
  date: Date
  merchant: string
  amount: number
  balance: number
  isIncome: boolean
}

export type DetectedBank =
  | 'swedbank'
  | 'seb'
  | 'nordea'
  | 'handelsbanken'
  | 'lansforsakringar'
  | 'ikano'
  | 'unknown'

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseCsvLine(line: string, delimiter = ','): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === delimiter && !inQuotes) { fields.push(current.trim()); current = '' }
    else { current += ch }
  }
  fields.push(current.trim())
  return fields
}

function detectDelimiter(line: string): ',' | ';' | '\t' {
  const tabs = (line.match(/\t/g) ?? []).length
  const semis = (line.match(/;/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  if (tabs >= semis && tabs >= commas) return '\t'
  return semis >= commas ? ';' : ','
}

function parseAmount(raw: string): number {
  // Handle Swedish number format: "1 234,56" or "1234.56" or "-1 234,56"
  const cleaned = raw.replace(/\s/g, '').replace(/ /g, '')
  // If has comma and period: "1.234,56" → European, else "1,234.56" → US
  if (/\d+\.\d{3},\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  return parseFloat(cleaned.replace(',', '.'))
}

function clean(s: string | undefined): string {
  return (s ?? '').replace(/^["'\s]+|["'\s]+$/g, '').trim()
}

function makeId(dateStr: string, merchant: string, amount: number): string {
  return `${dateStr}-${merchant.slice(0, 12).replace(/\s/g, '_')}-${Math.abs(amount).toFixed(2)}`
}

// ─── Bank detection ────────────────────────────────────────────────────────────

export function detectBank(csvText: string): DetectedBank {
  const head = csvText.slice(0, 800).toLowerCase()
  if (head.includes('swedbank') || head.includes('bokföringsdag')) return 'swedbank'
  if (head.includes('avsändare') && head.includes('mottagare')) return 'nordea'
  if (head.includes('seb') || (head.includes('bokföringsdatum') && head.includes('verifikationsnummer'))) return 'seb'
  if (head.includes('handelsbanken') || (head.includes('datum') && head.includes('text') && !head.includes('bokf'))) return 'handelsbanken'
  if (head.includes('lansforsakringar') || head.includes('länsförsäkringar')) return 'lansforsakringar'
  if (head.includes('ikano')) return 'ikano'
  // Fallback: try to parse generically
  return 'unknown'
}

// ─── Generic column-based parser ──────────────────────────────────────────────

function parseGeneric(csvText: string): ParsedTransaction[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  const results: ParsedTransaction[] = []

  let headerIndex = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].toLowerCase()
    if (l.includes('datum') || l.includes('bokf') || l.includes('date')) {
      headerIndex = i; break
    }
  }
  if (headerIndex === -1) return results

  const delim = detectDelimiter(lines[headerIndex])
  const headers = parseCsvLine(lines[headerIndex], delim).map(h => clean(h).toLowerCase())

  const dateCol    = headers.findIndex(h => h.includes('bokf') || h === 'datum' || h === 'date' || h.includes('transaktionsdatum'))
  const descCol    = headers.findIndex(h => ['beskrivning','text','transaktion','rubrik','namn','mottagare','avsändare','meddelande'].some(k => h.includes(k)))
  const amountCol  = headers.findIndex(h => h === 'belopp' || h === 'amount' || h === 'summa')
  const balanceCol = headers.findIndex(h => h.includes('saldo') || h.includes('balance'))

  if (dateCol === -1 || descCol === -1 || amountCol === -1) return results

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = parseCsvLine(line, delim)
    const dateStr  = clean(parts[dateCol])
    const merchant = clean(parts[descCol])
    const amtStr   = clean(parts[amountCol])
    const balStr   = balanceCol !== -1 ? clean(parts[balanceCol]) : '0'

    if (!dateStr || !merchant || !amtStr) continue
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) continue
    const amount = parseAmount(amtStr)
    const balance = parseAmount(balStr)
    if (isNaN(amount)) continue

    results.push({ id: makeId(dateStr, merchant, amount), date, merchant, amount, balance: isNaN(balance) ? 0 : balance, isIncome: amount > 0 })
  }
  return results
}

// ─── Swedbank ─────────────────────────────────────────────────────────────────
// Headers: Bokföringsdag;Valutadag;Verifikationsnummer;Beskrivning;Kategori;Belopp;Saldo

function parseSwedbank(csvText: string): ParsedTransaction[] {
  return parseGeneric(csvText)
}

// ─── SEB ──────────────────────────────────────────────────────────────────────
// Headers: Bokföringsdatum;Valutadatum;Verifikationsnummer;Text;Belopp;Saldo

function parseSEB(csvText: string): ParsedTransaction[] {
  return parseGeneric(csvText)
}

// ─── Nordea ───────────────────────────────────────────────────────────────────
// Headers: Bokföringsdatum;Belopp;Avsändare;Mottagare;Namn;Rubrik;Meddelande;Egna anteckningar;Saldo
// Tricky: description is in "Namn" or "Rubrik", avsändare/mottagare may be empty

function parseNordea(csvText: string): ParsedTransaction[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  const results: ParsedTransaction[] = []

  let headerIndex = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (lines[i].toLowerCase().includes('belopp') && lines[i].toLowerCase().includes('saldo')) {
      headerIndex = i; break
    }
  }
  if (headerIndex === -1) return parseGeneric(csvText)

  const delim = detectDelimiter(lines[headerIndex])
  const headers = parseCsvLine(lines[headerIndex], delim).map(h => clean(h).toLowerCase())

  const dateCol    = headers.findIndex(h => h.includes('bokf') || h.includes('datum'))
  const amountCol  = headers.findIndex(h => h === 'belopp')
  const balanceCol = headers.findIndex(h => h.includes('saldo'))
  const nameCol    = headers.findIndex(h => h === 'namn' || h === 'rubrik' || h === 'meddelande' || h === 'mottagare')

  if (dateCol === -1 || amountCol === -1) return parseGeneric(csvText)

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const parts = parseCsvLine(line, delim)
    const dateStr  = clean(parts[dateCol])
    const amtStr   = clean(parts[amountCol])
    const balStr   = balanceCol !== -1 ? clean(parts[balanceCol]) : '0'

    // Build merchant name from multiple columns
    const nameCols = [headers.indexOf('namn'), headers.indexOf('rubrik'), headers.indexOf('mottagare'), headers.indexOf('avsändare'), headers.indexOf('meddelande')]
    let merchant = ''
    for (const col of nameCols) {
      const val = col !== -1 ? clean(parts[col]) : ''
      if (val && val.length > merchant.length) merchant = val
    }
    if (!merchant && nameCol !== -1) merchant = clean(parts[nameCol])
    if (!merchant) merchant = 'Okänd'

    if (!dateStr || !amtStr) continue
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) continue
    const amount = parseAmount(amtStr)
    const balance = parseAmount(balStr)
    if (isNaN(amount)) continue

    results.push({ id: makeId(dateStr, merchant, amount), date, merchant, amount, balance: isNaN(balance) ? 0 : balance, isIncome: amount > 0 })
  }
  return results
}

// ─── Handelsbanken ────────────────────────────────────────────────────────────
// Headers: Datum;Text;Belopp;Saldo  (sometimes tab-separated)

function parseHandelsbanken(csvText: string): ParsedTransaction[] {
  return parseGeneric(csvText)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ParseResult {
  transactions: ParsedTransaction[]
  bank: DetectedBank
  count: number
}

export function parseCSV(csvText: string): ParseResult {
  const bank = detectBank(csvText)
  let transactions: ParsedTransaction[] = []

  switch (bank) {
    case 'nordea':
      transactions = parseNordea(csvText)
      break
    case 'handelsbanken':
      transactions = parseHandelsbanken(csvText)
      break
    case 'seb':
      transactions = parseSEB(csvText)
      break
    case 'swedbank':
    default:
      transactions = parseSwedbank(csvText)
      break
  }

  // Fallback: if bank-specific parser got 0 results, try generic
  if (transactions.length === 0 && bank !== 'unknown') {
    transactions = parseGeneric(csvText)
  }

  return { transactions, bank, count: transactions.length }
}

// Keep backward compat
export { parseSwedbank }
