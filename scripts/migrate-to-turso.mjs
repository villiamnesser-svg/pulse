// Migrates local SQLite data to Turso
// Run: node scripts/migrate-to-turso.mjs
import { createClient } from '@libsql/client'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const TURSO_URL = process.env.TURSO_DATABASE_URL
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env')
  process.exit(1)
}

const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? './pulse.db'
const localDb = new Database(path.resolve(process.cwd(), dbPath))
const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

const TABLES = [
  'Transaction', 'Baseline', 'Insight', 'SeasonalMemory',
  'PushSubscription', 'UserProfile', 'MerchantAlias'
]

async function migrate() {
  for (const table of TABLES) {
    const rows = localDb.prepare(`SELECT * FROM "${table}"`).all()
    if (rows.length === 0) { console.log(`${table}: empty, skipping`); continue }

    const cols = Object.keys(rows[0])
    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT OR IGNORE INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`

    let ok = 0
    for (const row of rows) {
      try {
        await turso.execute({ sql, args: cols.map(c => (row)[c] ?? null) })
        ok++
      } catch (e) {
        console.error(`  row error in ${table}:`, e.message)
      }
    }
    console.log(`${table}: ${ok}/${rows.length} rows migrated`)
  }
  console.log('\nDone.')
}

migrate().catch(console.error)
