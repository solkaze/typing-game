import { describe, expect, it } from 'vitest'
import { review } from './review'
import { kps, type Keystroke, type Session } from './types'

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

  it('splits the lost time into misses and hesitations', () => {
    expect(r.loss.slow).toEqual({ count: 2, ms: 60 + 200 })
    expect(r.loss.miss).toEqual({ count: 1, ms: 140 })
    // 各文の1打鍵目から: 1000 ms + 200 ms で 8 打
    expect(r.potentialKps).toBeCloseTo((8 / (1200 - 400)) * 1000)
  })

  it('measures every sentence from its own first key, like the whole run', () => {
    expect(r.sentences[0].lead).toBeNull()
    expect(r.sentences[0].kps).toBeCloseTo(6)
    // 前の文を打ち終えてから 500 ms は参考に出すだけで、速度には入れない
    expect(r.sentences[1].lead).toBe(500)
    expect(r.sentences[1].keys[0].dt).toBeNull()
    expect(r.sentences[1].kps).toBeCloseTo((2 / 200) * 1000)
    // 文ごとの打鍵数と時間を足すと、全体の速度になる
    const timed = r.sentences.flatMap((x) => x.keys.filter((k) => k.dt !== null))
    expect(timed).toHaveLength(s.correct - 2)
    expect(kps(s)).toBeCloseTo((timed.length / timed.reduce((n, k) => n + k.dt!, 0)) * 1000)
    expect(r.sentences.map((x) => x.text)).toEqual(['一', '二'])
  })

  it('measures speed from the first key, showing the time before it only as the lead', () => {
    const s2 = session([
      ['a', 600, 0],
      ['b', 700, 0],
      ['c', 800, 0],
    ])
    const r2 = review(s2)
    expect(r2.sentences[0].lead).toBe(600)
    expect(r2.sentences[0].kps).toBeCloseTo((2 / 200) * 1000)
    expect(kps(s2)).toBeCloseTo(r2.sentences[0].kps!)
  })

  it('starts timing at the first key even when it is a miss', () => {
    const s3 = session([
      ['!x', 500, 0],
      ['a', 650, 0],
      ['b', 750, 0],
      ['c', 850, 0],
    ])
    const r3 = review(s3)
    expect(r3.sentences[0].lead).toBe(500)
    expect(r3.sentences[0].keys.map((k) => k.dt)).toEqual([150, 100, 100])
    expect(r3.sentences[0].keys[0].level).toBe('miss')
    expect(r3.sentences[0].kps).toBeCloseTo((3 / 350) * 1000)
    expect(kps(s3)).toBeCloseTo(r3.sentences[0].kps!)
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
