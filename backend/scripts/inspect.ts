/**
 * Stage-by-stage connection check + schema inspection.
 *   npm run inspect            (reads backend/.env)
 *
 * 1. Authenticates and runs SELECT 1
 * 2. DESCRIBE TABLE for every allowlisted table
 * 3. Samples 10 rows from each table
 * 4. Row count vs distinct UWI count (duplicate check)
 * 5. Logical-field resolution report
 * Writes backend/schema-report.json (gitignored — it contains sample rows).
 * Read-only: only SELECT / DESCRIBE statements are executed.
 */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { loadConfig } from '../src/config/env.js'
import { DatabricksClient } from '../src/services/databricks.js'
import { TtlCache } from '../src/services/cache.js'
import { Catalog, TABLES, quoteIdent as q, type TableKey } from '../src/repositories/catalog.js'
import { DatabricksError } from '../src/lib/errors.js'

const config = loadConfig()
if (!config.configured) {
  console.error(`Missing ${config.missing.join(', ')} in backend/.env`)
  process.exit(1)
}
const sql = new DatabricksClient(config.databricks, fetch, undefined, () => {})
const catalog = new Catalog(sql, new TtlCache(0), config.databricks)
const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), host: new URL(config.databricks.host).host }

const step = (n: number, msg: string) => console.log(`\n[${n}] ${msg}`)
const fail = (e: unknown) => (e instanceof DatabricksError ? `${e.code}: ${e.message}${e.opts.providerMessage ? ` — ${e.opts.providerMessage.slice(0, 300)}` : ''}` : String(e))

step(1, 'Authenticating (SELECT 1)…')
try {
  const t = Date.now()
  await sql.query('SELECT 1 AS ok')
  console.log(`    ✓ connected in ${Date.now() - t}ms`)
} catch (e) {
  console.error(`    ✗ ${fail(e)}`)
  process.exit(1)
}

const tables: Record<string, unknown> = {}
for (const key of Object.keys(TABLES) as TableKey[]) {
  step(2, `${TABLES[key]}`)
  try {
    const s = await catalog.schema(key)
    console.log(`    columns (${s.columns.length}): ${s.columns.map((c) => `${c.name}:${c.type}`).join(', ')}`)
    console.log(`    resolved: ${JSON.stringify(s.fields)}`)
    if (s.unresolved.length) console.log(`    unresolved: ${s.unresolved.join(', ')}`)
    const sample = await sql.query(`SELECT * FROM ${s.fqtn} LIMIT 10`)
    console.log(`    sample: ${sample.rows.length} rows`)
    let counts: Record<string, unknown> = {}
    const uwi = s.fields.uwi
    if (uwi) {
      const c = await sql.query(`SELECT COUNT(*) AS rows, COUNT(DISTINCT ${q(uwi)}) AS distinct_uwi, SUM(CASE WHEN ${q(uwi)} IS NULL THEN 1 ELSE 0 END) AS null_uwi FROM ${s.fqtn}`)
      counts = c.rows[0]
      console.log(`    rows=${counts.rows} distinct_uwi=${counts.distinct_uwi} null_uwi=${counts.null_uwi} → ${Number(counts.rows) === Number(counts.distinct_uwi) ? 'one row per well' : 'MULTIPLE rows per well'}`)
    } else {
      const c = await sql.query(`SELECT COUNT(*) AS rows FROM ${s.fqtn}`)
      counts = c.rows[0]
      console.log(`    rows=${counts.rows}`)
    }
    if (key === 'wellMaster' && s.fields.latitude && s.fields.longitude) {
      const lat = q(s.fields.latitude), lon = q(s.fields.longitude)
      const v = await sql.query(`SELECT SUM(CASE WHEN ${lat} BETWEEN -90 AND 90 AND ${lon} BETWEEN -180 AND 180 AND NOT (${lat} = 0 AND ${lon} = 0) THEN 1 ELSE 0 END) AS valid, COUNT(*) AS total FROM ${s.fqtn}`)
      console.log(`    valid coordinates: ${v.rows[0].valid} / ${v.rows[0].total}`)
      counts = { ...counts, validCoordinates: v.rows[0].valid }
    }
    tables[s.table] = { available: true, columns: s.columns, fields: s.fields, unresolved: s.unresolved, counts, sample: sample.rows }
  } catch (e) {
    console.error(`    ✗ ${fail(e)}`)
    tables[TABLES[key]] = { available: false, error: fail(e) }
  }
}
report.tables = tables
writeFileSync(new URL('../schema-report.json', import.meta.url), JSON.stringify(report, null, 2))
console.log('\nWrote backend/schema-report.json')
