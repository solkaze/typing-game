import { describe, expect, it } from 'vitest'
import { analyze, median, worst } from './analysis'
import { accuracy, kps, type Keystroke, type Session } from './types'

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
    texts: [],
    keystrokes,
  }
}

describe('median', () => {
  it('handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('analyze', () => {
  const s = session([
    ['k', 0, 0],
    ['a', 100, 0],
    ['k', 200, 0],
    ['!j', 260, 0],
    ['a', 500, 0],
    ['k', 900, 1],
    ['a', 1050, 1],
  ])
  const a = analyze([s])
  const row = (rows: typeof a.keys, label: string) => rows.find((r) => r.label === label)!

  it('measures intervals only from clean keystrokes', () => {
    expect(a.hits).toBe(6)
    // 100, 100, 150。誤打後の 300 と文頭の 400 は含めない
    expect(a.medianInterval).toBe(100)
    expect(row(a.bigrams, 'ka').count).toBe(3)
    expect(row(a.bigrams, 'ka').median).toBe(125)
    expect(row(a.bigrams, 'ka').missRate).toBeCloseTo(1 / 3)
    expect(row(a.keys, 'a').missRate).toBeCloseTo(1 / 3)
  })

  it('does not join n-grams across sentences', () => {
    expect(a.bigrams.map((r) => r.label).sort()).toEqual(['ak', 'ka'])
    expect(row(a.trigrams, 'kak').median).toBe(200)
    expect(row(a.trigrams, 'aka').median).toBeNull()
  })

  it('records what was typed instead of the expected key', () => {
    expect(a.confusions).toEqual([{ expected: 'k', typed: 'j', count: 1 }])
  })

  it('reports sentence start latency and session figures', () => {
    expect(a.flow.sentenceStart).toBe(400)
    expect(a.trend[0].kps).toBeCloseTo(kps(s))
    expect(kps(s)).toBeCloseTo(5 / 1.05)
    expect(accuracy(s)).toBeCloseTo(6 / 7)
  })

  it('ranks rows by time lost against the overall median', () => {
    expect(worst(a.bigrams, 1, 1)[0].label).toBe('ka')
    expect(worst(a.bigrams, 10, 5)).toEqual([])
  })
})
