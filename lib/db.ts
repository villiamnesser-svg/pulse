import { PrismaClient } from '@prisma/client'

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (url && url.startsWith('libsql')) {
    // Production: Turso hosted SQLite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    const client = createClient({ url, authToken })
    const adapter = new PrismaLibSQL(client)
    return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
  }

  // Local development: better-sqlite3
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
  const path = require('path') as typeof import('path')
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') ?? './pulse.db'
  const resolvedPath = path.resolve(process.cwd(), dbPath)
  const sqlite = new Database(resolvedPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  const adapter = new PrismaBetterSqlite3({ url: resolvedPath })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
