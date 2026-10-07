import { describe, expect, it } from 'vitest'
import { ghostKeys, readGhostKps } from './ghost'

describe('ghostKeys', () => {
  it('文を打ち始める前は 0、1打鍵目は時刻 0 に打つ', () => {
    expect(ghostKeys(-1, 10, 30)).toBe(0)
    expect(ghostKeys(0, 10, 30)).toBe(1)
  })

  it('決めた速度で増える', () => {
    expect(ghostKeys(99, 10, 30)).toBe(1)
    expect(ghostKeys(100, 10, 30)).toBe(2)
    expect(ghostKeys(1000, 10, 30)).toBe(11)
    expect(ghostKeys(1000, 7.5, 30)).toBe(8)
  })

  it('文末で止まる', () => {
    expect(ghostKeys(2900, 10, 30)).toBe(30)
    expect(ghostKeys(60000, 10, 30)).toBe(30)
  })

  it('文末に着く時刻は、その文をゴーストの速度で打ち終える時刻', () => {
    // 文ごとの速度は (打鍵数 - 1) / 時間
    const ms = ((30 - 1) / 8) * 1000
    expect(ghostKeys(ms - 1, 8, 30)).toBe(29)
    expect(ghostKeys(ms, 8, 30)).toBe(30)
  })
})

describe('readGhostKps', () => {
  it('数でなければ既定値、範囲の外は丸める', () => {
    expect(readGhostKps(undefined, 8)).toBe(8)
    expect(readGhostKps('10', 8)).toBe(8)
    expect(readGhostKps(NaN, 8)).toBe(8)
    expect(readGhostKps(0, 8)).toBe(1)
    expect(readGhostKps(99, 8)).toBe(30)
    expect(readGhostKps(10.5, 8)).toBe(10.5)
  })
})
