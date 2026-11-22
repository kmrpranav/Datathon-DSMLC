/**
 * Well role classification. Uses only values present in the Catalog tables;
 * never assigns a role without evidence.
 *
 * - `currentRole`: first decisive value of current flow direction → status →
 *   well-type column ("inject…" → injection, "produc…" → production).
 * - Historical flags: explicit boolean columns, else cumulative totals > 0,
 *   else the current role. `null` means "no evidence either way".
 * - `dualRole`: the well has evidence of both producing and injecting, so the
 *   categories are not treated as mutually exclusive.
 */
export type WellRole = 'injection' | 'production' | 'unknown'

export interface RoleEvidence {
  flowDirection?: unknown
  status?: unknown
  wellType?: unknown
  everProduced?: unknown
  everInjected?: unknown
  oilTotal?: unknown
  injectionTotal?: unknown
}

export interface RoleClassification {
  currentRole: WellRole
  /** Which column decided `currentRole`. */
  currentRoleSource: 'flowDirection' | 'status' | 'wellType' | null
  hasProducedHistorically: boolean | null
  hasInjectedHistorically: boolean | null
  dualRole: boolean
}

export function roleFromText(v: unknown): WellRole {
  if (typeof v !== 'string') return 'unknown'
  const s = v.toLowerCase()
  if (/inject/.test(s)) return 'injection'
  if (/produc/.test(s)) return 'production'
  return 'unknown'
}

function truthy(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = String(v).trim().toLowerCase()
  if (['true', 'yes', 'y', '1', 't'].includes(s)) return true
  if (['false', 'no', 'n', '0', 'f'].includes(s)) return false
  return null
}

function positive(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n > 0 : null
}

export function classifyWell(e: RoleEvidence): RoleClassification {
  let currentRole: WellRole = 'unknown'
  let currentRoleSource: RoleClassification['currentRoleSource'] = null
  for (const key of ['flowDirection', 'status', 'wellType'] as const) {
    const r = roleFromText(e[key])
    if (r !== 'unknown') {
      currentRole = r
      currentRoleSource = key
      break
    }
  }
  const produced = truthy(e.everProduced) ?? positive(e.oilTotal)
  const injected = truthy(e.everInjected) ?? positive(e.injectionTotal)
  const hasProducedHistorically = produced === true || currentRole === 'production' ? true : produced
  const hasInjectedHistorically = injected === true || currentRole === 'injection' ? true : injected
  return {
    currentRole,
    currentRoleSource,
    hasProducedHistorically,
    hasInjectedHistorically,
    dualRole: hasProducedHistorically === true && hasInjectedHistorically === true,
  }
}

/** SQL expression with the same current-role rules, for aggregations. */
export function currentRoleSql(cols: { flowDirection?: string; status?: string; wellType?: string }, q: (c: string) => string): string {
  const order = [cols.flowDirection, cols.status, cols.wellType].filter(Boolean) as string[]
  if (!order.length) return `'unknown'`
  const branches = order
    .flatMap((c) => [
      `WHEN lower(CAST(${q(c)} AS STRING)) LIKE '%inject%' THEN 'injection'`,
      `WHEN lower(CAST(${q(c)} AS STRING)) LIKE '%produc%' THEN 'production'`,
    ])
    .join(' ')
  return `CASE ${branches} ELSE 'unknown' END`
}
