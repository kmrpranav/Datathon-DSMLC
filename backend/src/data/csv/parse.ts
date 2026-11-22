/**
 * Minimal RFC 4180 CSV parser plus per-column type inference.
 *
 * Types are inferred from the data (every non-null value must fit), and use
 * the same names Databricks reports (BOOLEAN, BIGINT, DOUBLE, DATE, TIMESTAMP,
 * STRING), so the frontend formats CSV and Databricks rows the same way.
 */
import type { ColumnInfo } from '../../repositories/catalog.js'

export type CsvValue = string | number | boolean | null
export type CsvRow = Record<string, CsvValue>

export interface ParsedCsv {
  columns: ColumnInfo[]
  rows: CsvRow[]
  /** Data lines whose field count didn't match the header (skipped). */
  malformedRows: number
}

/** Tokens treated as missing values. */
const NULL_TOKENS = new Set(['', 'null', 'NULL', 'Null', 'NaN', 'nan', 'None', 'NA', 'N/A', '\\N'])

/** Split CSV text into records of raw string fields (handles quotes, escaped quotes, CRLF, newlines in quotes). */
export function splitCsv(text: string): string[][] {
  const out: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0 // strip BOM
  for (; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      out.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    out.push(row)
  }
  // Drop fully blank lines.
  return out.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

const INT = /^-?(0|[1-9]\d*)$/
const DEC = /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
const BOOL = /^(true|false)$/i

type Kind = 'BOOLEAN' | 'BIGINT' | 'DOUBLE' | 'DATE' | 'TIMESTAMP' | 'STRING'

function inferKind(values: string[]): Kind {
  const present = values.filter((v) => !NULL_TOKENS.has(v.trim()))
  if (!present.length) return 'STRING'
  const all = (re: RegExp) => present.every((v) => re.test(v.trim()))
  if (all(BOOL)) return 'BOOLEAN'
  // Integers with leading zeros are identifiers (e.g. UWIs), not numbers.
  if (all(INT) && present.every((v) => Number.isSafeInteger(Number(v)))) return 'BIGINT'
  if (all(DEC) && !present.some((v) => /^-?0\d/.test(v.trim()))) return 'DOUBLE'
  if (all(DATE)) return 'DATE'
  if (all(TIMESTAMP)) return 'TIMESTAMP'
  return 'STRING'
}

function convert(raw: string, kind: Kind): CsvValue {
  const v = raw.trim()
  if (NULL_TOKENS.has(v)) return null
  switch (kind) {
    case 'BOOLEAN':
      return v.toLowerCase() === 'true'
    case 'BIGINT':
    case 'DOUBLE': {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    default:
      return v
  }
}

export function parseCsv(text: string): ParsedCsv {
  const records = splitCsv(text)
  if (!records.length) return { columns: [], rows: [], malformedRows: 0 }
  const header = records[0].map((h) => h.trim())
  const body = records.slice(1)
  const good = body.filter((r) => r.length === header.length)
  const kinds = header.map((_, c) => inferKind(good.map((r) => r[c])))
  const rows = good.map((r) => {
    const o: CsvRow = {}
    header.forEach((h, c) => (o[h] = convert(r[c], kinds[c])))
    return o
  })
  return { columns: header.map((name, c) => ({ name, type: kinds[c] })), rows, malformedRows: body.length - good.length }
}
