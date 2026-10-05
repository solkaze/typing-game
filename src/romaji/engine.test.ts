import { describe, expect, it } from 'vitest'
import { defaultRomaji, Typist } from './engine'

function accepts(reading: string, keys: string): boolean {
  const t = new Typist(reading)
  for (const k of keys) if (!t.input(k)) return false
  return t.done
}

describe('Typist', () => {
  it('accepts every spelling of a plain kana', () => {
    for (const keys of ['si', 'shi', 'ci']) expect(accepts('し', keys)).toBe(true)
    for (const keys of ['ka', 'ca']) expect(accepts('か', keys)).toBe(true)
    for (const keys of ['hu', 'fu']) expect(accepts('ふ', keys)).toBe(true)
    expect(accepts('し', 'sa')).toBe(false)
  })

  it('accepts contracted sounds as one chunk or as separate kana', () => {
    for (const keys of ['sya', 'sha', 'sixya', 'shilya', 'cixya']) {
      expect(accepts('しゃ', keys)).toBe(true)
    }
    for (const keys of ['ja', 'zya', 'jya', 'jixya', 'zilya']) {
      expect(accepts('じゃ', keys)).toBe(true)
    }
    for (const keys of ['fa', 'fwa', 'huxa', 'fula']) {
      expect(accepts('ふぁ', keys)).toBe(true)
    }
    expect(accepts('てぃ', 'thi')).toBe(true)
    expect(accepts('てぃ', 'texi')).toBe(true)
  })

  it('handles sokuon by doubling or typing it alone', () => {
    for (const keys of ['katta', 'kaxtuta', 'kaltuta', 'kaltsuta', 'catta']) {
      expect(accepts('かった', keys)).toBe(true)
    }
    for (const keys of ['matti', 'macchi', 'maxtuchi']) {
      expect(accepts('まっち', keys)).toBe(true)
    }
    expect(accepts('きっぷ', 'kippu')).toBe(true)
    expect(accepts('ざっし', 'zassi')).toBe(true)
    expect(accepts('ざっし', 'zasshi')).toBe(true)
    expect(accepts('いっしょ', 'issyo')).toBe(true)
    expect(accepts('いっしょ', 'issho')).toBe(true)
    // 母音や n は重ねても「っ」にならない
    expect(accepts('っあ', 'aa')).toBe(false)
    expect(accepts('っな', 'nna')).toBe(false)
    expect(accepts('っな', 'xtuna')).toBe(true)
  })

  it('allows a single n only where the IME would produce ん', () => {
    expect(accepts('かんたん', 'kantann')).toBe(true)
    expect(accepts('かんたん', 'kanntann')).toBe(true)
    expect(accepts('かんたん', 'kaxntaxn')).toBe(true)
    // 文末の n 1打は確定しない
    expect(accepts('かんたん', 'kantan')).toBe(false)
    // な行・母音・や行の前では nn が必要
    expect(accepts('こんにちは', 'konnnitiha')).toBe(true)
    expect(accepts('こんにちは', 'konnitiha')).toBe(false)
    expect(accepts('けんい', 'kenni')).toBe(true)
    expect(accepts('けんい', 'keni')).toBe(false)
    expect(accepts('こんや', 'konnya')).toBe(true)
    expect(accepts('こんや', 'konya')).toBe(false)
    expect(accepts('ほんを', 'honwo')).toBe(true)
    expect(accepts('ぱん、', 'pan,')).toBe(true)
    expect(accepts("かんい", "kan'i")).toBe(true)
  })

  it('rejects a wrong key without changing state', () => {
    const t = new Typist('かき')
    expect(t.input('k')).toBe(true)
    expect(t.input('x')).toBe(false)
    expect(t.typed).toBe('k')
    expect(t.guide).toBe('aki')
    expect(t.input('a')).toBe(true)
    expect(t.kanaPos).toBe(1)
  })

  it('keeps the guide consistent with what was typed', () => {
    const t = new Typist('しんじゅく')
    expect(t.guide).toBe('sinjuku')
    t.input('s')
    t.input('h')
    expect(t.guide).toBe('injuku')
    for (const k of 'inn') t.input(k)
    expect(t.guide).toBe('juku')
    t.input('z')
    expect(t.guide).toBe('yuku')
  })

  it('shows nn in the guide when a single n would not work', () => {
    expect(defaultRomaji('こんにちは')).toBe('konnnitiha')
    expect(defaultRomaji('ほんうん')).toBe('honnunn')
    expect(defaultRomaji('さんぽ')).toBe('sanpo')
  })

  it('normalizes katakana and passes punctuation through', () => {
    expect(defaultRomaji('コーヒー、ください。')).toBe('ko-hi-,kudasai.')
    expect(accepts('ヴァイオリン', 'vaiorinn')).toBe(true)
  })

  it('throws on characters it cannot type', () => {
    expect(() => new Typist('漢字')).toThrow()
  })
})
