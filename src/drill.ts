import { analyze } from './analysis'
import { defaultRomaji } from './romaji/engine'
import { OPTIMIZE_SENTENCES } from './texts/optimize'
import { pickSentences } from './texts/pick'
import { SENTENCES, type Sentence } from './texts/sentences'
import type { Session } from './types'

// 弱点とみなす2連。cost は1回打つごとに失っている時間の見込み (ms)
export type Target = { label: string; cost: number }

export type Plan = {
  // cost の大きい順
  targets: Target[]
  // 文面 -> その文を最後に打ち切ったときのつづり
  spellings: Map<string, string>
}

// これより少ない回数しか打っていない2連は、たまたまの遅れと区別がつかないので狙わない
const MIN_COUNT = 5
// 誤打1回を、ふつうの打鍵いくつぶんの遅れとして数えるか (打ち直しと立て直しのぶん)
const MISS_COST = 3
// 弱点の濃い順に並べたとき、上からどこまでを出題の候補にするか。
// かな数をちょうどに揃えられなければ、次の割合まで広げる
const SHARES = [0.25, 0.5, 1]

const DRILL_POOL: readonly Sentence[] = [...SENTENCES, ...OPTIMIZE_SENTENCES]

// 記録から、狙う2連とその重みを決める。
// 遅さ (全体の中央値との差) と誤打のしやすさを、どちらも1回あたりの時間に直して足す
export function plan(sessions: Session[]): Plan {
  const a = analyze(sessions)
  const base = a.medianInterval
  const targets: Target[] = []
  if (base !== null) {
    for (const row of a.bigrams) {
      if (row.count < MIN_COUNT) continue
      const slow = row.median !== null ? Math.max(0, row.median - base) : 0
      const cost = slow + row.missRate * MISS_COST * base
      if (cost > 0) targets.push({ label: row.label, cost })
    }
    targets.sort((x, y) => y.cost - x.cost)
  }

  const spellings = new Map<string, string>()
  for (const s of sessions) {
    const typed = s.texts.map(() => '')
    for (const k of s.keystrokes) {
      if (k.ok && k.sentence < typed.length) typed[k.sentence] += k.key
    }
    // エンドレスは最後の文の途中で終わるので、その文のつづりは揃っていない
    const finished = s.missLimit === undefined ? typed.length : typed.length - 1
    for (let i = 0; i < finished; i++) spellings.set(s.texts[i], typed[i])
  }
  return { targets, spellings }
}

// ローマ字1打鍵あたりの、弱点で失う時間の見込み (ms)。長い文が有利にならないよう打鍵数で割る
export function density(romaji: string, costs: ReadonlyMap<string, number>): number {
  let sum = 0
  for (let i = 1; i < romaji.length; i++) sum += costs.get(romaji.slice(i - 1, i + 1)) ?? 0
  return romaji.length > 1 ? sum / (romaji.length - 1) : 0
}

// 弱点の2連が濃い文から、読みの合計がちょうど kanaCount になる組を選ぶ。
// つづりは人によって違う (si / shi など) ので、打ったことのある文はそのときのつづりで測る
export function pickDrill(
  kanaCount: number,
  { targets, spellings }: Plan,
  random: () => number = Math.random,
  pool: readonly Sentence[] = DRILL_POOL,
): Sentence[] {
  if (targets.length === 0) return pickSentences(kanaCount, random, pool)
  const costs = new Map(targets.map((t) => [t.label, t.cost]))
  const ranked = pool
    .map((s) => ({ s, d: density(spellings.get(s.text) ?? defaultRomaji(s.reading), costs) }))
    .sort((x, y) => y.d - x.d)
    .map((x) => x.s)

  let picked: Sentence[] = []
  for (const share of SHARES) {
    picked = pickSentences(kanaCount, random, ranked.slice(0, Math.ceil(ranked.length * share)))
    if (picked.reduce((n, s) => n + s.reading.length, 0) === kanaCount) break
  }
  return picked
}
