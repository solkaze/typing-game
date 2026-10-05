import { describe, expect, it } from 'vitest'
import { review } from './review'
import type { Keystroke, Session } from './types'

// [key, t, sentence] の並びからセッションを作る。key が '!x' なら x の誤打
function session(events: [string, number, number][]): Session {
  const keystrokes: Keystroke[] = events.map(([key, t, sentence]) => ({
    t,
    key: key.replace('!', ''),
    code: '',
    ok: !key.startsWith('!'),
    expected: key.startsWith('!') ? 'k' : key,
    sentence,
    kanaPos: 0,
  }))
  const correct = keystrokes.filter((k) => k.ok).length
  return {
    startedAt: '2026-10-05T00:00:00.000Z',
    kanaCount: 0,
    durationMs: keystrokes[keystrokes.length - 1].t,
    correct,
    misses: keystrokes.length - correct,
    texts: ['一', '二'],
    keystrokes,
  }
}

describe('review', () => {
  const s = session([
    ['a', 0, 0],
    ['b', 100, 0],
    ['c', 200, 0],
    ['d', 300, 0],
    ['e', 460, 0], // 160 ms: 遅い
    ['f', 760, 0], // 300 ms: 詰まり
    ['!x', 800, 0],
    ['!y', 850, 0],
    ['g', 1000, 0], // 240 ms: ミス
    ['h', 1500, 1], // 500 ms: 文の切り替わり
    ['i', 1600, 1],
    ['j', 1700, 1],
  ])
  const r = review(s)
  const levels = (i: number) => r.sentences[i].keys.map((k) => k.level)

  it('marks slow keystrokes against the median of clean intervals', () => {
    expect(r.baseline).toBe(100)
    expect(levels(0)).toEqual(['ok', 'ok', 'ok', 'ok', 'slow', 'stall', 'miss'])
    expect(levels(1)).toEqual(['ok', 'ok', 'ok'])
  })

  it('keeps the wrong keys with the keystroke they delayed', () => {
    const g = r.sentences[0].keys[6]
    expect(g.wrong).toEqual(['x', 'y'])
    expect(g.dt).toBe(240)
    expect(r.sentences[0].misses).toBe(2)
    expect(r.sentences[1].misses).toBe(0)
  })

  it('splits the lost time into misses, hesitations and sentence switches', () => {
    expect(r.loss.slow).toEqual({ count: 2, ms: 60 + 200 })
    expect(r.loss.miss).toEqual({ count: 1, ms: 140 })
    expect(r.loss.lead).toEqual({ count: 1, ms: 400 })
    expect(r.potentialKps).toBeCloseTo((9 / (1700 - 400)) * 1000)
  })

  it('reports per-sentence speed without the gap before the sentence', () => {
    expect(r.sentences[0].lead).toBeNull()
    expect(r.sentences[0].kps).toBeCloseTo(6)
    expect(r.sentences[1].lead).toBe(500)
    expect(r.sentences[1].kps).toBeCloseTo(10)
    expect(r.sentences.map((x) => x.text)).toEqual(['一', '二'])
  })

  it('lists the slowest clean keystrokes with the keys leading up to them', () => {
    expect(r.spots.map((x) => [x.before, x.key, x.dt])).toEqual([
      ['cde', 'f', 300],
      ['bcd', 'e', 160],
    ])
    expect(r.spots[0].ratio).toBe(3)
    expect(review(s, 1).spots).toHaveLength(1)
  })

  it('does not flag anything without enough clean keystrokes', () => {
    const r = review(session([['a', 0, 0]]))
    expect(r.baseline).toBeNull()
    expect(r.potentialKps).toBeNull()
    expect(r.spots).toEqual([])
  })
})
