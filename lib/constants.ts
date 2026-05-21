/**
 * Categories that represent pass-through money (reimbursements).
 * These MUST be excluded from all financial calculations — velocity,
 * health score, baseline, forecast, spending chart, AI analysis etc.
 */
export const PASS_THROUGH_CATS = ['utlägg', 'återbetalning'] as const
export type PassThroughCat = typeof PASS_THROUGH_CATS[number]

/** Prisma "NOT IN" filter for pass-through categories */
export const EXCLUDE_PASS_THROUGH = {
  NOT: { category: { in: ['utlägg', 'återbetalning'] } },
} as const
