export interface ParsedTransaction {
  id: string
  date: Date
  merchant: string
  amount: number
  balance: number
  isIncome: boolean
}

// Parse a CSV line respecting quoted fields, auto-detects , or ; delimiter
function parseCsvLine(line: string, delimiter = ','): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function detectDelimiter(line: string): ',' | ';' {
  const semicolons = (line.match(/;/g) ?? []).length
  const commas = (line.match(/,/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

// Swedbank exports amounts with period decimal (e.g. -280.00) or Swedish comma (e.g. -280,00)
function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\s/g, '').replace(',', '.'))
}

export function parseSwedbank(csvText: string): ParsedTransaction[] {
  // Normalize line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  const results: ParsedTransaction[] = []

  // Find the header row (contains "Bokföringsdag" or "Datum")
  let headerIndex = -1
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const l = lines[i].toLowerCase()
    if (l.includes('bokf') || l.includes('datum') || l.includes('radnummer')) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) return results

  const delimiter = detectDelimiter(lines[headerIndex])
  const headers = parseCsvLine(lines[headerIndex], delimiter).map((h) => h.toLowerCase().replace(/["\s]/g, ''))

  // Detect column indices — normalize header names
  const dateCol = headers.findIndex((h) => h.includes('bokf') || h === 'datum')
  const descCol = headers.findIndex((h) => h === 'beskrivning' || h === 'transaktion' || h.includes('text'))
  const amountCol = headers.findIndex((h) => h === 'belopp')
  const balanceCol = headers.findIndex((h) => h.includes('saldo'))

  if (dateCol === -1 || descCol === -1 || amountCol === -1 || balanceCol === -1) return results

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = parseCsvLine(line, delimiter)
    if (parts.length <= Math.max(dateCol, descCol, amountCol, balanceCol)) continue

    const dateStr = parts[dateCol]?.replace(/"/g, '').trim()
    const merchant = parts[descCol]?.replace(/"/g, '').trim()
    const amountStr = parts[amountCol]?.replace(/"/g, '').trim()
    const balanceStr = parts[balanceCol]?.replace(/"/g, '').trim()

    const date = new Date(dateStr)
    if (isNaN(date.getTime())) continue

    const amount = parseAmount(amountStr)
    const balance = parseAmount(balanceStr)
    if (isNaN(amount) || isNaN(balance)) continue

    const merchantClean = merchant.trim()
    if (!merchantClean) continue

    const id = `${dateStr}-${merchantClean.slice(0, 10).replace(/\s/g, '')}-${Math.abs(amount)}`

    results.push({
      id,
      date,
      merchant: merchantClean,
      amount,
      balance,
      isIncome: amount > 0,
    })
  }

  return results
}
