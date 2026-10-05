import { describe, expect, it } from 'vitest'
import { defaultRomaji, Typist } from '../romaji/engine'
import { sameFingerRate } from './fingers'
import { OPTIMIZE_SENTENCES } from './optimize'
import { PASSAGES } from './passages'
import { pickPassage, pickSentences } from './pick'
import { SENTENCES } from './sentences'

const ALL = [...SENTENCES, ...OPTIMIZE_SENTENCES, ...PASSAGES.flatMap((p) => p.sentences)]
const kanaTotal = (sentences: { reading: string }[]) => sentences.reduce((n, s) => n + s.reading.length, 0)

describe('sentences', () => {
  it('have readings the engine can type to the end', () => {
    for (const s of ALL) {
      const t = new Typist(s.reading)
      for (const k of t.guide) expect(t.input(k), s.text).toBe(true)
      expect(t.done, s.text).toBe(true)
    }
  })

  it('are unique by text, so a reading can be looked up from a stored session', () => {
    expect(new Set(ALL.map((s) => s.text)).size).toBe(ALL.length)
  })
})

describe('sameFingerRate', () => {
  it('counts neighbouring keys on one finger, but not a repeated key', () => {
    expect(sameFingerRate('ki')).toBe(1)
    expect(sameFingerRate('kk')).toBe(0)
    expect(sameFingerRate('kita')).toBeCloseTo(1 / 3)
    expect(sameFingerRate('a')).toBe(0)
  })
})

describe('optimize sentences', () => {
  // 通常の文は中央値で 0.08 ほど
  it('are dense in same-finger sequences when typed as the guide shows', () => {
    for (const s of OPTIMIZE_SENTENCES) {
      expect(sameFingerRate(defaultRomaji(s.reading)), s.text).toBeGreaterThanOrEqual(0.15)
    }
  })

  it('can fill every kana count exactly', () => {
    for (const count of [100, 200, 400]) {
      for (let i = 0; i < 20; i++) {
        expect(kanaTotal(pickSentences(count, Math.random, OPTIMIZE_SENTENCES))).toBe(count)
      }
    }
  })
})

describe('passages', () => {
  it('are 400 to 800 kana long with unique titles', () => {
    for (const p of PASSAGES) {
      expect(kanaTotal(p.sentences), p.title).toBeGreaterThanOrEqual(400)
      expect(kanaTotal(p.sentences), p.title).toBeLessThanOrEqual(800)
    }
    expect(new Set(PASSAGES.map((p) => p.title)).size).toBe(PASSAGES.length)
  })
})

describe('pickPassage', () => {
  it('returns the named passage, or a random one other than the last played', () => {
    expect(pickPassage(PASSAGES[2].title).title).toBe(PASSAGES[2].title)
    for (let i = 0; i < 20; i++) {
      expect(pickPassage(null, PASSAGES[0].title).title).not.toBe(PASSAGES[0].title)
    }
  })
})

describe('pickSentences', () => {
  it('hits the requested kana count exactly without repeats', () => {
    for (const count of [100, 200, 400]) {
      for (let i = 0; i < 20; i++) {
        const picked = pickSentences(count)
        const sum = picked.reduce((n, s) => n + s.reading.length, 0)
        expect(sum).toBe(count)
        expect(new Set(picked).size).toBe(picked.length)
      }
    }
  })
})
