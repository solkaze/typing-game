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

function typed(reading: string, keys: string, prefer?: Map<string, string>): Typist {
  const t = new Typist(reading, prefer)
  for (const k of keys) expect(t.input(k), keys).toBe(true)
  return t
}

describe('segments', () => {
  const pairs = (t: Typist) => t.segments.map((s) => [s.kana, s.romaji])

  it('splits what was typed into kana and the spelling used for each', () => {
    expect(pairs(typed('しゃしん', 'shasin'))).toEqual([
      ['しゃ', 'sha'],
      ['し', 'si'],
    ])
    expect(pairs(typed('しゃしん', 'shasinn'))).toEqual([
      ['しゃ', 'sha'],
      ['し', 'si'],
      ['ん', 'nn'],
    ])
    expect(pairs(typed('じゃ', 'jilya'))).toEqual([
      ['じ', 'ji'],
      ['ゃ', 'lya'],
    ])
  })

  it('tells a lone n from nn by what followed', () => {
    expect(pairs(typed('かんたん', 'kantann'))).toEqual([
      ['か', 'ka'],
      ['ん', 'n'],
      ['た', 'ta'],
      ['ん', 'nn'],
    ])
    expect(pairs(typed('かんたん', 'kanntann'))[1]).toEqual(['ん', 'nn'])
  })

  it('keeps a doubled consonant with the kana it doubles', () => {
    expect(pairs(typed('かった', 'katta'))).toEqual([
      ['か', 'ka'],
      ['った', 'tta'],
    ])
    expect(pairs(typed('かった', 'kaltuta'))[1]).toEqual(['っ', 'ltu'])
  })

  it('lists the spellings that were possible at that place', () => {
    expect(typed('し', 'shi').segments[0].options).toEqual(['si', 'shi', 'ci'])
    const [, n1, , n2] = typed('かんたん', 'kantann').segments
    expect(n1.options).toContain('n')
    expect(n2.options).not.toContain('n')
  })
})

describe('preferred spellings', () => {
  const prefer = new Map([
    ['し', 'shi'],
    ['じゃ', 'ja'],
    ['ち', 'chi'],
    ['ん', 'nn'],
  ])

  it('show in the guide, including after a doubled consonant', () => {
    expect(new Typist('しじゃ', prefer).guide).toBe('shija')
    expect(new Typist('まっち', prefer).guide).toBe('macchi')
    expect(new Typist('しゃ', prefer).guide).toBe('sya')
  })

  it('still accept every other spelling', () => {
    expect(typed('しじゃ', 'sizya', prefer).done).toBe(true)
    expect(typed('かんたん', 'kantann', prefer).done).toBe(true)
  })

  it('keep nn in the guide until the second n is typed', () => {
    expect(new Typist('かんたん', prefer).guide).toBe('kanntann')
    const t = typed('かんたん', 'kan', prefer)
    expect(t.guide).toBe('ntann')
    expect(t.kanaPos).toBe(1)
    // n 1打のまま次へ進んでもよい
    expect(typed('かんたん', 'kant', prefer).guide).toBe('ann')
  })

  it('ignore a spelling the kana does not have', () => {
    expect(new Typist('し', new Map([['し', 'xx']])).guide).toBe('si')
  })
})
