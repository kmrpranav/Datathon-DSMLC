import { Router } from 'express'
import { TABLES, type TableKey } from '../repositories/catalog.js'
import type { Services } from '../services/container.js'

/**
 * GET /api/meta/schema  Columns + logical-field resolution for every table.
 * Column names only — no data. Used to verify mappings after connecting.
 */
export function metaRouter(s: Services) {
  const r = Router()
  r.get('/schema', async (_req, res) => {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(TABLES) as TableKey[]) {
      const schema = await s.catalog.trySchema(k)
      out[TABLES[k]] = schema
        ? { available: true, columns: schema.columns, fields: schema.fields, unresolved: schema.unresolved }
        : { available: false }
    }
    res.json({ catalog: s.config.databricks.catalog, schema: s.config.databricks.schema, tables: out })
  })
  return r
}
