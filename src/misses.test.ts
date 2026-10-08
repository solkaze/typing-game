import { describe, expect, it } from 'vitest'
import { adjacent, classify, misses } from './misses'
import type { Keystroke, Session } from './types'

// [key, t, sentence] の並びからセッションを作る。key が '!x' なら x の誤打
function session(events: [string, number, number][]): Session {
  const keystrokes: Keystroke[] = events.map(([key, t, sentence]) => ({
    t,
    key: key.replace('!', ''),
    code: '',
    ok: !key.startsWith('!'),
    expected: '?',
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

describe('adjacent', () => {
  it('follows the stagger of the rows', () => {
    expect(adjacent('j', 'k')).toBe(true)
    expect(adjacent('a', 'q')).toBe(true)
    expect(adjacent('a', 'w')).toBe(true)
    expect(adjacent('a', 'e')).toBe(false)
    expect(adjacent('s', 'z')).toBe(true)
    expect(adjacent('a', 'x')).toBe(false)
    expect(adjacent('p', '-')).toBe(true)
    expect(adjacent('k', 'k')).toBe(false)
    expect(adjacent('q', 'z')).toBe(false)
  })
})

describe('classify', () => {
  it('picks the first kind that fits', () => {
    expect(classify('a', 'k', 't', 'a')).toBe('ahead')
    expect(classify('t', 'k', 't', 'a')).toBe('repeat')
    expect(classify('j', 'k', 't', 'a')).toBe('adjacent')
    expect(classify('d', 'k', 't', 'a')).toBe('mirror')
    expect(classify('q', 'k', 't', 'a')).toBe('other')
    // 文頭・文末では前後のキーが無い
    expect(classify('q', 'k', null, null)).toBe('other')
  })
})

describe('misses', () => {
  it('classifies a run of misses by its first key', () => {
    const m = misses(
      [
        session([
          ['t', 0, 0],
          ['!a', 80, 0],
          ['!i', 150, 0],
          ['k', 400, 0],
          ['a', 500, 0],
        ]),
      ],
      100,
    )
    expect(m.events).toBe(1)
    expect(m.extra).toBe(1)
    expect(m.kinds).toEqual([{ kind: 'ahead', count: 1, pairs: [{ expected: 'k', typed: 'a', count: 1 }] }])
  })

  it('measures the delay to the right key and the slowdown after it', () => {
    const m = misses(
      [
        session([
          ['t', 0, 0],
          ['!j', 80, 0],
          ['k', 400, 0],
          ['a', 550, 0],
          ['i', 670, 0],
          ['t', 770, 0],
          ['o', 1770, 0],
        ]),
      ],
      100,
    )
    // 打ち直しまで 400 - 100、直後 3 打は 150, 120, 100
    expect(m.cost).toEqual({ measured: 1, direct: 300, recovery: 70 })
  })

  it('stops the slowdown at the next miss and at the sentence end', () => {
    const m = misses(
      [
        session([
          ['t', 0, 0],
          ['!j', 80, 0],
          ['k', 300, 0],
          ['a', 450, 0],
          ['!q', 500, 0],
          ['i', 750, 0],
          ['t', 900, 0],
          ['o', 2000, 1],
        ]),
      ],
      100,
    )
    // 1 回目: 200 + 50。2 回目: 200 + 50。文をまたぐ 1100 は数えない
    expect(m.cost).toEqual({ measured: 2, direct: 200, recovery: 50 })
  })

  it('counts misses it cannot time', () => {
    const m = misses(
      [
        session([
          ['!j', 0, 0],
          ['k', 200, 0],
          ['a', 300, 0],
          ['!s', 400, 0],
        ]),
      ],
      100,
    )
    expect(m.events).toBe(2)
    expect(m.cost).toBeNull()
    expect(misses([], 100)).toEqual({ events: 0, extra: 0, kinds: [], cost: null })
  })
})
