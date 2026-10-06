import { describe, expect, it } from 'vitest'
import { density, pickDrill, plan } from './drill'
import { defaultRomaji } from './romaji/engine'
import { SENTENCES, type Sentence } from './texts/sentences'
import type { Keystroke, Session } from './types'

// 文ごとのローマ字からセッションを作る。打鍵間隔は interval(直前のキー, キー) で決める。
// '!' を前に付けたキーは、1回誤打してから打てたことにする
function session(
  typed: string[],
  interval: (prev: string, key: string) => number = () => 100,
  extra: Partial<Session> = {},
  texts: string[] = typed,
): Session {
  const keystrokes: Keystroke[] = []
  let t = 0
  typed.forEach((romaji, sentence) => {
    let prev = ''
    let missed = false
    for (const key of romaji) {
      if (key === '!') {
        missed = true
        continue
      }
      t += prev ? interval(prev, key) : 400
      if (missed) {
        keystrokes.push({ t: t - 50, key: 'q', code: '', ok: false, expected: key, sentence, kanaPos: 0 })
        missed = false
      }
      keystrokes.push({ t, key, code: '', ok: true, expected: key, sentence, kanaPos: 0 })
      prev = key
    }
  })
  const correct = keystrokes.filter((k) => k.ok).length
  return {
    startedAt: '2026-10-07T00:00:00.000Z',
    kanaCount: 0,
    durationMs: t,
    correct,
    misses: keystrokes.length - correct,
    texts,
    keystrokes,
    ...extra,
  }
}

const kanaTotal = (sentences: Sentence[]) => sentences.reduce((n, s) => n + s.reading.length, 0)
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

describe('plan', () => {
  it('ranks bigrams by the time each occurrence loses', () => {
    const slowKa = (prev: string, key: string) => (prev + key === 'ka' ? 250 : 100)
    const p = plan([session(Array(6).fill('kakeko'), slowKa)])
    expect(p.targets[0].label).toBe('ka')
    expect(p.targets[0].cost).toBeCloseTo(150)
    expect(p.targets.some((t) => t.label === 'ke')).toBe(false)
  })

  it('counts a bigram that is often mistyped even when it is not slow', () => {
    const p = plan([session(Array(6).fill('k!ake'))])
    expect(p.targets.map((t) => t.label)).toEqual(['ka'])
    expect(p.targets[0].cost).toBeGreaterThan(0)
  })

  it('ignores bigrams seen too few times, and has no targets without records', () => {
    const slowKa = (prev: string, key: string) => (prev + key === 'ka' ? 250 : 100)
    expect(plan([session(['kakeko', 'kekokeko', 'kekokeko'], slowKa)]).targets).toEqual([])
    expect(plan([]).targets).toEqual([])
  })

  it('remembers how each sentence was last spelled, except one left unfinished', () => {
    const p = plan([
      session(['shi', 'ka'], undefined, {}, ['A', 'B']),
      session(['si', 'k'], undefined, { missLimit: 3 }, ['A', 'B']),
    ])
    expect(p.spellings.get('A')).toBe('si')
    expect(p.spellings.get('B')).toBe('ka')
  })
})

describe('density', () => {
  it('is the cost per key, so long sentences are not favoured', () => {
    const costs = new Map([['ka', 90]])
    expect(density('kaki', costs)).toBeCloseTo(30)
    expect(density('kakikaki', costs)).toBeCloseTo(180 / 7)
    expect(density('a', costs)).toBe(0)
  })
})

describe('pickDrill', () => {
  // 既定のつづりで全文を打ち、「ka」だけ遅かったことにする
  const slowKa = (prev: string, key: string) => (prev + key === 'ka' ? 300 : 100)
  const p = plan([session(SENTENCES.map((s) => defaultRomaji(s.reading)), slowKa)])
  const costs = new Map(p.targets.map((t) => [t.label, t.cost]))
  const score = (s: Sentence) => density(defaultRomaji(s.reading), costs)

  it('hits the requested kana count exactly without repeats', () => {
    for (const count of [100, 200, 400]) {
      for (let i = 0; i < 10; i++) {
        const picked = pickDrill(count, p)
        expect(kanaTotal(picked)).toBe(count)
        expect(new Set(picked).size).toBe(picked.length)
      }
    }
  })

  it('picks sentences denser in the weak bigrams than the pool at large', () => {
    const all = mean(SENTENCES.map(score))
    for (let i = 0; i < 10; i++) {
      expect(mean(pickDrill(200, p, Math.random, SENTENCES).map(score))).toBeGreaterThan(all * 1.5)
    }
  })

  it('scores a sentence by the spelling it was last typed with', () => {
    const a = { text: 'A', reading: 'しか' }
    const b = { text: 'B', reading: 'しき' }
    const typed = plan([session(['shika', 'siki'], undefined, {}, ['A', 'B'])])
    // 既定の si では出てこない「sh」も、shi と打った文では弱点として数える
    const picked = pickDrill(2, { targets: [{ label: 'sh', cost: 100 }], spellings: typed.spellings }, Math.random, [a, b])
    expect(picked).toEqual([a])
  })

  it('falls back to a plain pick when there is nothing to aim at', () => {
    expect(kanaTotal(pickDrill(200, plan([])))).toBe(200)
  })
})
