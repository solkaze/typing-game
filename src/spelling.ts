import { median } from './analysis'
import { Typist } from './romaji/engine'
import { readingOf } from './texts/lookup'
import type { Session } from './types'

export type Variant = {
  romaji: string
  count: number
  // ミスなしで打てたときの、直前の打鍵からそのかなを打ち終えるまでの時間の中央値 (ms)
  median: number | null
}

// 打ち方が2通り以上あるかな1つぶんの、打ち分けの集計
export type Spelling = {
  kana: string
  count: number
  // 使った回数の多い順。使っていない打ち方も count 0 で含む
  variants: Variant[]
  // いちばん使う打ち方より打鍵数の少ない打ち方
  shorter: string | null
  // 十分な回数があり、いちばん使う打ち方よりはっきり速い打ち方
  faster: string | null
}

// 速さを比べるのに必要な、打ち方ごとの回数
const MIN_COUNT = 5
// これ以上の差が無ければ、速いとは言わない
const FASTER_RATIO = 0.9
// ガイドを合わせるのに必要な回数。1、2回の気まぐれでは変えない
const MIN_HABIT = 3

type Group = { kana: string; options: string[]; times: Map<string, { count: number; clean: number[] }> }

export function spellings(sessions: Session[]): Spelling[] {
  const groups = new Map<string, Group>()

  for (const s of sessions) {
    // 文ごとの正打鍵。clean は直前の正打鍵から誤打なしで打てたか
    const hits: { key: string; t: number; clean: boolean }[][] = s.texts.map(() => [])
    let missed = false
    for (const k of s.keystrokes) {
      if (!k.ok) missed = true
      else {
        hits[k.sentence]?.push({ key: k.key, t: k.t, clean: !missed })
        missed = false
      }
    }

    s.texts.forEach((text, i) => {
      const reading = readingOf(text)
      if (reading === undefined) return
      const typist = new Typist(reading)
      // 文面が同じでも読みを直したあとだと、昔の打鍵が通らないことがある
      if (!hits[i].every((h) => typist.input(h.key))) return

      let at = 0
      for (const seg of typist.segments) {
        const keys = hits[i].slice(at, at + seg.romaji.length)
        const start = at
        at += seg.romaji.length
        if (seg.options.length < 2) continue
        // 子音を重ねた「っ」は、続くかなの打ち方しだいなので数えない
        if (seg.kana.length > 1 && seg.kana[0] === 'っ') continue

        // 「ん」は n 1打で済む位置かどうかで選べる打ち方が違うので、選択肢ごとに分ける
        const id = `${seg.kana}|${[...seg.options].sort().join(',')}`
        let g = groups.get(id)
        if (!g) groups.set(id, (g = { kana: seg.kana, options: seg.options, times: new Map() }))
        let v = g.times.get(seg.romaji)
        if (!v) g.times.set(seg.romaji, (v = { count: 0, clean: [] }))
        v.count++
        // 文頭は直前の打鍵が無いので、時間は測れない
        if (start > 0 && keys.every((h) => h.clean)) {
          v.clean.push(keys[keys.length - 1].t - hits[i][start - 1].t)
        }
      }
    })
  }

  return [...groups.values()]
    .map((g): Spelling => {
      const variants = g.options
        .map((romaji) => {
          const v = g.times.get(romaji)
          return { romaji, count: v?.count ?? 0, median: median(v?.clean ?? []) }
        })
        // sort は安定なので、回数が同じならガイドの優先順のまま
        .sort((a, b) => b.count - a.count)
      const main = variants[0]
      const shortest = g.options.reduce((a, b) => (b.length < a.length ? b : a))
      const rivals = variants.filter(
        (v) =>
          v !== main &&
          v.count >= MIN_COUNT &&
          v.median !== null &&
          main.median !== null &&
          v.median < main.median * FASTER_RATIO,
      )
      return {
        kana: g.kana,
        count: variants.reduce((n, v) => n + v.count, 0),
        variants,
        shorter: shortest.length < main.romaji.length ? shortest : null,
        faster: rivals.length > 0 ? rivals.reduce((a, b) => (b.median! < a.median! ? b : a)).romaji : null,
      }
    })
    .sort((a, b) => b.count - a.count)
}

// いちばんよく使う打ち方を、かなごとに。Typist に渡すとガイドがその打ち方になる
export function preferred(rows: Spelling[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const row of rows) {
    const main = row.variants[0]
    if (main.count < MIN_HABIT) continue
    // n 1打が使えない位置の「ん」は nn に決まっているので、癖の判断には使わない
    if (row.kana === 'ん' && !row.variants.some((v) => v.romaji === 'n')) continue
    out.set(row.kana, main.romaji)
  }
  return out
}
