import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:./pulse.db'
  const authToken = process.env.TURSO_AUTH_TOKEN

  const adapter = new PrismaLibSql({ url, authToken })
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0])
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
