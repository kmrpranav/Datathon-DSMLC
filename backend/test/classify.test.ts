import { describe, expect, it } from 'vitest'
import { classifyWell, currentRoleSql } from '../src/lib/classify.js'

describe('classifyWell', () => {
  it('uses flow direction before status', () => {
    expect(classifyWell({ flowDirection: 'Injection', status: 'Producing' }).currentRole).toBe('injection')
  })
  it('flags dual-role history from totals without making roles exclusive', () => {
    const r = classifyWell({ status: 'Injecting', oilTotal: 1200 })
    expect(r).toMatchObject({ currentRole: 'injection', hasInjectedHistorically: true, hasProducedHistorically: true, dualRole: true })
  })
  it('returns unknown with no evidence', () => {
    expect(classifyWell({ status: 'Suspended' })).toMatchObject({ currentRole: 'unknown', hasProducedHistorically: null, hasInjectedHistorically: null, dualRole: false })
  })
  it('respects explicit false flags', () => {
    expect(classifyWell({ status: 'Producing', everInjected: false }).hasInjectedHistorically).toBe(false)
  })
  it('builds matching SQL', () => {
    const sql = currentRoleSql({ flowDirection: 'fd', status: 'st' }, (c) => `\`${c}\``)
    expect(sql.indexOf('`fd`')).toBeLessThan(sql.indexOf('`st`'))
    expect(currentRoleSql({}, (c) => c)).toBe(`'unknown'`)
  })
})

describe('classifyWell without current-status columns', () => {
  it('uses a single historical flag as the current role', () => {
    expect(classifyWell({ everProduced: true, everInjected: false })).toMatchObject({ currentRole: 'production', currentRoleSource: 'historyFlags', dualRole: false })
  })
  it('orders dual-role wells by the most recent role start', () => {
    expect(classifyWell({ everProduced: true, everInjected: true, productionStart: '2012-03-25', injectionStart: '2023-06-01' }))
      .toMatchObject({ currentRole: 'injection', currentRoleSource: 'latestRoleStart', dualRole: true })
  })
  it('stays unknown for dual-role wells without both start dates', () => {
    expect(classifyWell({ everProduced: true, everInjected: true, injectionStart: '2023-06-01' })).toMatchObject({ currentRole: 'unknown', dualRole: true })
  })
})
