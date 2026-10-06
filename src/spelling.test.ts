import { describe, expect, it } from 'vitest'
import { Typist } from './romaji/engine'
import { preferred, spellings } from './spelling'
import { SENTENCES } from './texts/sentences'
import type { Keystroke, Session } from './types'

const find = (reading: string) => SENTENCES.find((s) => s.reading === reading)!
// 写真を撮るのが彼の趣味だ。
const SHASHIN = find('しゃしんをとるのがかれのしゅみだ。')
// 旅行の計画を立てるのは楽しい。
const RYOKOU = find('りょこうのけいかくをたてるのはたのしい。')

// 文ごとに打ったローマ字からセッションを作る。打鍵間隔は interval(何打目か, 文の番号) で決める。
// '!' を前に付けたキーは、1回誤打してから打てたことにする
function session(
  typed: [{ text: string }, string][],
  interval: (index: number, sentence: number) => number = () => 100,
): Session {
  const keystrokes: Keystroke[] = []
  let t = 0
  typed.forEach(([, romaji], sentence) => {
    let index = 0
    let missed = false
    for (const key of romaji) {
      if (key === '!') {
        missed = true
        continue
      }
      t += interval(index++, sentence)
      if (missed) {
        keystrokes.push({ t: t - 50, key: 'q', code: '', ok: false, expected: key, sentence, kanaPos: 0 })
        missed = false
      }
      keystrokes.push({ t, key, code: '', ok: true, expected: key, sentence, kanaPos: 0 })
    }
  })
  const correct = keystrokes.filter((k) => k.ok).length
  return {
    startedAt: '2026-10-07T00:00:00.000Z',
    kanaCount: 0,
    durationMs: t,
    correct,
    misses: keystrokes.length - correct,
    texts: typed.map(([s]) => s.text),
    keystrokes,
  }
}

const row = (rows: ReturnType<typeof spellings>, kana: string) => rows.find((r) => r.kana === kana)!
const used = (rows: ReturnType<typeof spellings>, kana: string) =>
  row(rows, kana)
    .variants.filter((v) => v.count > 0)
    .map((v) => [v.romaji, v.count])

describe('spellings', () => {
  it('counts which spelling was used for each kana, most used first', () => {
    const rows = spellings([
      session([
        [SHASHIN, 'shashinwotorunogakarenoshumida.'],
        [SHASHIN, 'shashinwotorunogakarenoshumida.'],
        [SHASHIN, 'syasinwotorunogakarenosyumida.'],
      ]),
    ])
    expect(used(rows, 'し')).toEqual([
      ['shi', 2],
      ['si', 1],
    ])
    expect(used(rows, 'しゃ')).toEqual([
      ['sha', 2],
      ['sya', 1],
    ])
    expect(row(rows, 'し').count).toBe(3)
    // 打ち方が1通りしかないかなは載せない
    expect(rows.some((r) => r.kana === 'の')).toBe(false)
  })

  it('times a kana from the key before it to its last key, when typed cleanly', () => {
    // 「しゃ」は文頭なので測れない。「し」は sha の直後から shi の i まで
    const clean = spellings([session([[SHASHIN, 'shashinwotorunogakarenoshumida.']])])
    expect(row(clean, 'しゃ').variants[0].median).toBeNull()
    expect(row(clean, 'し').variants[0].median).toBe(300)

    const missed = spellings([session([[SHASHIN, 'shas!hinwotorunogakarenoshumida.']])])
    expect(row(missed, 'し').variants[0].count).toBe(1)
    expect(row(missed, 'し').variants[0].median).toBeNull()
  })

  it('points out a spelling with fewer keys than the usual one', () => {
    const rows = spellings([session([[SHASHIN, 'shashinnwotorunogakarenoshumida.']])])
    expect(row(rows, 'し').shorter).toBe('si')
    expect(row(rows, 'ん').shorter).toBe('n')
    expect(row(spellings([session([[SHASHIN, 'syasinwotorunogakarenosyumida.']])]), 'し').shorter).toBeNull()
  })

  it('points out a spelling that is clearly faster, given enough samples', () => {
    const shi = 'shashinwotorunogakarenoshumida.'
    const si = 'shasinwotorunogakarenoshumida.'
    // 偶数番の文は shi、奇数番の文は si。shi の文だけ打鍵を遅くする
    const typed: [typeof SHASHIN, string][] = Array.from({ length: 12 }, (_, i) => [SHASHIN, i % 2 ? si : shi])
    const fast = spellings([session([...typed, [SHASHIN, shi]], (_, n) => (n % 2 ? 60 : 100))])
    expect(row(fast, 'し').variants[0].romaji).toBe('shi')
    expect(row(fast, 'し').faster).toBe('si')

    const few = spellings([session(typed.slice(0, 5), (_, n) => (n % 2 ? 60 : 100))])
    expect(row(few, 'し').faster).toBeNull()
  })

  it('skips a sentence whose text is unknown or whose keys no longer fit', () => {
    expect(spellings([session([[{ text: 'どこにも無い文' }, 'si']])])).toEqual([])
    expect(spellings([session([[SHASHIN, 'zzz']])])).toEqual([])
  })

  it('reads a run that stopped mid-sentence', () => {
    expect(used(spellings([session([[RYOKOU, 'ryokoun']])]), 'こ')).toEqual([['ko', 1]])
  })
})

describe('preferred', () => {
  const shi = 'shashinnwotorunogakarenoshumida.'

  it('is the most used spelling of each kana, once it has been used a few times', () => {
    const prefer = preferred(spellings([session([[SHASHIN, shi], [SHASHIN, shi], [SHASHIN, shi]])]))
    expect(prefer.get('し')).toBe('shi')
    expect(prefer.get('ん')).toBe('nn')
    expect(new Typist(SHASHIN.reading, prefer).guide).toBe(shi)

    expect(preferred(spellings([session([[SHASHIN, shi]])])).has('し')).toBe(false)
  })

  it('does not take nn as a habit where a lone n was never possible', () => {
    const variant = (romaji: string, count: number) => ({ romaji, count, median: null })
    const forced = { kana: 'ん', count: 9, variants: [variant('nn', 9), variant('xn', 0)], shorter: null, faster: null }
    const free = { kana: 'ん', count: 4, variants: [variant('n', 4), variant('nn', 0)], shorter: null, faster: null }
    expect(preferred([forced]).has('ん')).toBe(false)
    expect(preferred([forced, free]).get('ん')).toBe('n')
  })
})
