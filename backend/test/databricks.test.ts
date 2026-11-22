import { describe, expect, it, vi } from 'vitest'
import { DatabricksClient, normalizeValue } from '../src/services/databricks.js'
import { DatabricksError } from '../src/lib/errors.js'

const cfg = { host: 'https://example.cloud.databricks.com', token: 'dapi-secret-token', warehouseId: 'wh1', catalog: 'workspace', schema: 'default', queryTimeoutMs: 10_000 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const manifest = {
  schema: { columns: [
    { name: 'uwi', type_name: 'STRING', position: 0 },
    { name: 'oil', type_name: 'DOUBLE', position: 1 },
    { name: 'n', type_name: 'BIGINT', position: 2 },
    { name: 'active', type_name: 'BOOLEAN', position: 3 },
    { name: 'd', type_name: 'DATE', position: 4 },
  ] },
  total_chunk_count: 2,
}

function client(responses: Response[]) {
  const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => responses.shift() ?? json({}, 500))
  const c = new DatabricksClient(cfg, fetchMock as unknown as typeof fetch, async () => {}, () => {})
  return { c, fetchMock }
}

describe('DatabricksClient', () => {
  it('submits, polls, follows chunk links and normalizes types', async () => {
    const { c, fetchMock } = client([
      json({ statement_id: 's1', status: { state: 'PENDING' } }),
      json({ statement_id: 's1', status: { state: 'RUNNING' } }),
      json({
        statement_id: 's1',
        status: { state: 'SUCCEEDED' },
        manifest,
        result: { chunk_index: 0, data_array: [['A', '1.5', '7', 'true', '2024-01-02']], next_chunk_internal_link: '/api/2.0/sql/statements/s1/result/chunks/1' },
      }),
      json({ chunk_index: 1, data_array: [['B', null, '9007199254740993', 'false', null]] }),
    ])
    const res = await c.query('SELECT * FROM t WHERE uwi = :uwi', [{ name: 'uwi', value: 'A' }, { name: 'x', value: null, type: 'STRING' }])

    expect(res.rows).toEqual([
      { uwi: 'A', oil: 1.5, n: 7, active: true, d: '2024-01-02' },
      { uwi: 'B', oil: null, n: '9007199254740993', active: false, d: null },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(4)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.cloud.databricks.com/api/2.0/sql/statements')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer dapi-secret-token')
    const body = JSON.parse(init!.body as string)
    expect(body).toMatchObject({ warehouse_id: 'wh1', disposition: 'INLINE', format: 'JSON_ARRAY', on_wait_timeout: 'CONTINUE' })
    expect(body.parameters).toEqual([{ name: 'uwi', type: 'STRING', value: 'A' }, { name: 'x', type: 'STRING' }]) // null → value omitted
    expect(fetchMock.mock.calls[3][0]).toBe('https://example.cloud.databricks.com/api/2.0/sql/statements/s1/result/chunks/1')
  })

  it('maps FAILED statements and missing tables', async () => {
    const { c } = client([json({ statement_id: 's2', status: { state: 'FAILED', error: { error_code: 'BAD_REQUEST', message: '[TABLE_OR_VIEW_NOT_FOUND] nope' } } })])
    await expect(c.query('SELECT 1')).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND' })
  })

  it('maps CANCELED statements', async () => {
    const { c } = client([json({ statement_id: 's3', status: { state: 'CANCELED' } })])
    await expect(c.query('SELECT 1')).rejects.toMatchObject({ code: 'CANCELED' })
  })

  it('maps 401 to AUTH without leaking the token', async () => {
    const { c } = client([json({ error_code: 'UNAUTHENTICATED', message: 'Invalid token' }, 401)])
    const err = (await c.query('SELECT 1').catch((e) => e)) as DatabricksError
    expect(err.code).toBe('AUTH')
    expect(JSON.stringify({ m: err.message, o: err.opts })).not.toContain('dapi-secret-token')
  })

  it('cancels the statement when the deadline passes', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/cancel') ? json({}) : json({ statement_id: 's4', status: { state: 'RUNNING' } }),
    )
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const c = new DatabricksClient({ ...cfg, queryTimeoutMs: 5_000 }, fetchMock as unknown as typeof fetch, async (ms) => { now += ms }, () => {})
    await expect(c.query('SELECT 1')).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/statements/s4/cancel'))).toBe(true)
    vi.restoreAllMocks()
  })

  it('refuses non read-only or stacked statements', async () => {
    const { c, fetchMock } = client([])
    await expect(c.query('DROP TABLE x')).rejects.toBeInstanceOf(DatabricksError)
    await expect(c.query('SELECT 1; DELETE FROM x')).rejects.toBeInstanceOf(DatabricksError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes edge values', () => {
    expect(normalizeValue('NaN', 'DOUBLE')).toBeNull()
    expect(normalizeValue('12.30', 'DECIMAL')).toBe(12.3)
    expect(normalizeValue('[1,2]', 'ARRAY')).toEqual([1, 2])
    expect(normalizeValue('x', 'STRING')).toBe('x')
  })
})
