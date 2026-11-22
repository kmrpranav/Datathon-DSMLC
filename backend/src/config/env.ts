import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/**
 * Backend-only configuration. Values come from the process environment
 * (loaded from `backend/.env` by `server.ts`). Nothing here is ever sent to
 * the browser; `publicConfigStatus()` is the only view exposed by the API.
 */
const identifier = z.string().trim().regex(/^[A-Za-z0-9_]+$/, 'must contain only letters, digits and underscores')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
  DATA_SOURCE: z.enum(['csv', 'databricks']).default('csv'),
  CSV_DATA_DIR: z.string().trim().default(''),
  DATABRICKS_HOST: z.string().trim().default(''),
  DATABRICKS_WAREHOUSE_ID: z.string().trim().default(''),
  DATABRICKS_TOKEN: z.string().trim().default(''),
  DATABRICKS_CATALOG: identifier.default('workspace'),
  DATABRICKS_SCHEMA: identifier.default('default'),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(86_400).default(600),
  QUERY_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(900).default(120),
})

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  frontendOrigins: string[]
  /** Where data is read from: exported CSV files (default) or Databricks. */
  dataSource: 'csv' | 'databricks'
  /** Absolute folder holding the exported CSV files (default: the project root). */
  csvDataDir: string
  databricks: {
    host: string
    warehouseId: string
    token: string
    catalog: string
    schema: string
    queryTimeoutMs: number
  }
  cacheTtlMs: number
  /** Names of required Databricks variables that are missing or still placeholders (only needed when DATA_SOURCE=databricks). */
  missing: string[]
  configured: boolean
}

/** backend/ — the same depth from src/config and dist/config. */
const BACKEND_DIR = fileURLToPath(new URL('../..', import.meta.url))

const PLACEHOLDER = /YOUR[-_]|<.*>|changeme/i

function normalizeHost(raw: string): string {
  if (!raw) return ''
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const u = new URL(withScheme)
    return `https://${u.host}`
  } catch {
    return ''
  }
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    // Only report variable names + reasons, never values.
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid backend configuration — ${details}`)
  }
  const e = parsed.data
  const host = normalizeHost(e.DATABRICKS_HOST)
  const required: Array<[string, string]> = [
    ['DATABRICKS_HOST', host],
    ['DATABRICKS_WAREHOUSE_ID', e.DATABRICKS_WAREHOUSE_ID],
    ['DATABRICKS_TOKEN', e.DATABRICKS_TOKEN],
  ]
  const missing = required.filter(([, v]) => !v || PLACEHOLDER.test(v)).map(([k]) => k)

  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    frontendOrigins: e.FRONTEND_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
    dataSource: e.DATA_SOURCE,
    csvDataDir: e.CSV_DATA_DIR ? path.resolve(BACKEND_DIR, e.CSV_DATA_DIR) : path.resolve(BACKEND_DIR, '..'),
    databricks: {
      host,
      warehouseId: e.DATABRICKS_WAREHOUSE_ID,
      token: e.DATABRICKS_TOKEN,
      catalog: e.DATABRICKS_CATALOG,
      schema: e.DATABRICKS_SCHEMA,
      queryTimeoutMs: e.QUERY_TIMEOUT_SECONDS * 1000,
    },
    cacheTtlMs: e.CACHE_TTL_SECONDS * 1000,
    missing,
    configured: missing.length === 0,
  }
}

/** Safe-to-expose view of configuration status (no values). */
export function publicConfigStatus(config: AppConfig) {
  return {
    configured: config.configured,
    missing: config.missing,
    catalog: config.databricks.catalog,
    schema: config.databricks.schema,
  }
}
