import { describe, expect, it } from 'vitest'
import { kps, type Session } from './types'

function session(ts: number[]): Session {
  return {
    startedAt: '2026-10-19T00:00:00.000Z',
    kanaCount: 0,
    durationMs: ts[ts.length - 1],
    correct: ts.length,
    misses: 0,
    texts: ['一'],
    keystrokes: ts.map((t) => ({ t, key: 'a', code: '', ok: true, expected: 'a', sentence: 0, kanaPos: 0 })),
  }
}

describe('kps', () => {
  it('文が出た時から数える記録は、すべての打鍵を数える', () => {
    expect(kps(session([500, 1000]))).toBeCloseTo(2)
  })

  it('1打鍵目を時刻 0 にしていた以前の記録は、最初の打鍵を数えない', () => {
    expect(kps(session([0, 500, 1000]))).toBeCloseTo(2)
  })
})
