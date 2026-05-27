import { NextResponse } from 'next/server'
import { listSwedishInstitutions, type Institution } from '@/lib/nordigen'

// Popular Swedish banks we always want to surface at the top
const PRIORITY_IDS = [
  'SWEDBANK_SWEDSESS',
  'SEB_ESSESESS',
  'NORDEA_NDEASS22',
  'HANDELSBANKEN_HANDSESS',
  'LANSFORSAKRINGAR_LFBASSE1',
  'IKANO_BANKSE',
  'DANSKEBANK_DABADKKK',
  'ICA_BANKEN_ICANSESS',
  'REVOLUT_REVOGB21',
  'KLARNA_KLARSESX',
]

export async function GET() {
  try {
    const all = await listSwedishInstitutions()

    // Sort: priority banks first (preserving PRIORITY_IDS order), then alphabetical
    const priorityMap = new Map(PRIORITY_IDS.map((id, i) => [id, i]))
    all.sort((a, b) => {
      const pa = priorityMap.has(a.id) ? priorityMap.get(a.id)! : 999
      const pb = priorityMap.has(b.id) ? priorityMap.get(b.id)! : 999
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name, 'sv')
    })

    // Return a trimmed-down shape for the UI
    const institutions = all.map((inst: Institution) => ({
      id: inst.id,
      name: inst.name,
      logo: inst.logo,
      days: inst.transaction_total_days,
    }))

    return NextResponse.json({ institutions })
  } catch (err) {
    console.error('institutions error:', err)
    // Return a hardcoded fallback list so the UI works even if Nordigen is slow
    return NextResponse.json({
      institutions: FALLBACK,
      fallback: true,
    })
  }
}

// Used when Nordigen API is not yet configured or unreachable
const FALLBACK = [
  { id: 'SWEDBANK_SWEDSESS',       name: 'Swedbank',           logo: '', days: '730' },
  { id: 'SEB_ESSESESS',            name: 'SEB',                logo: '', days: '730' },
  { id: 'NORDEA_NDEASS22',         name: 'Nordea',             logo: '', days: '730' },
  { id: 'HANDELSBANKEN_HANDSESS',  name: 'Handelsbanken',      logo: '', days: '730' },
  { id: 'LANSFORSAKRINGAR_LFBASSE1', name: 'Länsförsäkringar', logo: '', days: '730' },
  { id: 'DANSKEBANK_DABADKKK',     name: 'Danske Bank',        logo: '', days: '730' },
  { id: 'ICA_BANKEN_ICANSESS',     name: 'ICA Banken',         logo: '', days: '730' },
  { id: 'REVOLUT_REVOGB21',        name: 'Revolut',            logo: '', days: '730' },
]
