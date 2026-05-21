import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time migration: create SavingsGoal table in production Turso DB
// Visit /api/admin/migrate-goals once to apply. Safe to call multiple times.
export async function GET() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SavingsGoal" (
        "id"           TEXT     NOT NULL PRIMARY KEY,
        "userId"       TEXT     NOT NULL DEFAULT 'local',
        "name"         TEXT     NOT NULL,
        "emoji"        TEXT     NOT NULL DEFAULT '🎯',
        "targetAmount" REAL     NOT NULL,
        "targetDate"   DATETIME,
        "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    return NextResponse.json({ ok: true, message: 'SavingsGoal table ready' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
