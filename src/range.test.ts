import { describe, expect, it } from 'vitest'
import { clampRange, lastRange, panRange, zoomRange } from './range'

describe('clampRange', () => {
  it('null は全体', () => {
    expect(clampRange(null, 30)).toEqual({ from: 0, to: 29 })
  })

  it('記録が減ってはみ出した範囲を、幅を保って収める', () => {
    expect(clampRange({ from: 20, to: 29 }, 25)).toEqual({ from: 15, to: 24 })
  })

  it('記録数より広い範囲は全体になる', () => {
    expect(clampRange({ from: 0, to: 29 }, 3)).toEqual({ from: 0, to: 2 })
  })
})

describe('lastRange', () => {
  it('直近 size 件', () => {
    expect(lastRange(30, 20)).toEqual({ from: 10, to: 29 })
    expect(lastRange(8, 20)).toEqual({ from: 0, to: 7 })
  })
})

describe('zoomRange', () => {
  const all = { from: 0, to: 99 }

  it('右端を基準に拡大すると右端が残る', () => {
    expect(zoomRange(all, 100, 1, 1)).toEqual({ from: 20, to: 99 })
  })

  it('左端を基準に拡大すると左端が残る', () => {
    expect(zoomRange(all, 100, 0, 1)).toEqual({ from: 0, to: 79 })
  })

  it('最小幅より狭くならない', () => {
    const r = { from: 40, to: 44 }
    expect(zoomRange(r, 100, 0.5, 1)).toEqual(r)
  })

  it('狭い範囲でも 1 件ずつは変わる', () => {
    expect(zoomRange({ from: 40, to: 45 }, 100, 0, 1)).toEqual({ from: 40, to: 44 })
    expect(zoomRange({ from: 40, to: 44 }, 100, 0, -1)).toEqual({ from: 40, to: 45 })
  })

  it('縮小は全体で止まる', () => {
    expect(zoomRange({ from: 5, to: 99 }, 100, 0.5, -1)).toEqual(all)
    expect(zoomRange(all, 100, 0.5, -1)).toEqual(all)
  })

  it('記録が最小幅より少なければ全体のまま', () => {
    expect(zoomRange({ from: 0, to: 2 }, 3, 0.5, 1)).toEqual({ from: 0, to: 2 })
  })
})

describe('panRange', () => {
  it('幅を保って動かし、端で止まる', () => {
    expect(panRange({ from: 10, to: 19 }, 30, 5)).toEqual({ from: 15, to: 24 })
    expect(panRange({ from: 10, to: 19 }, 30, 50)).toEqual({ from: 20, to: 29 })
    expect(panRange({ from: 10, to: 19 }, 30, -50)).toEqual({ from: 0, to: 9 })
  })
})
