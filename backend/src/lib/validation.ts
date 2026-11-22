import { z } from 'zod'

/** Optional trimmed string; empty → undefined. */
export const optText = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined))

/** UWIs look like "100/01-02-003-04W5/00" or plain digits; allow those characters only. */
export const uwiSchema = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9/._ -]+$/, 'invalid UWI')

export const pageSchema = {
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  sort: z.string().trim().max(64).regex(/^[A-Za-z0-9_]+$/, 'invalid sort column').optional(),
  dir: z.enum(['asc', 'desc']).optional(),
}

/** Optional number from a query string; empty → undefined (not 0). */
export const optNumber = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().finite().optional())
