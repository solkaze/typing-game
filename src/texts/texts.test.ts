import { describe, expect, it } from 'vitest'
import { Typist } from '../romaji/engine'
import { pickSentences } from './pick'
import { SENTENCES } from './sentences'

describe('sentences', () => {
  it('have readings the engine can type to the end', () => {
    for (const s of SENTENCES) {
      const t = new Typist(s.reading)
      for (const k of t.guide) expect(t.input(k), s.text).toBe(true)
      expect(t.done, s.text).toBe(true)
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
