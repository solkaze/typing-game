import { AFTER_MISS_WINDOW, type Confusion } from './analysis'
import { fingerOf } from './texts/fingers'
import type { Keystroke, Session } from './types'

// 誤打の種類。上から順に当てはめ、最初に合ったものにする
export type MissKind = 'ahead' | 'repeat' | 'adjacent' | 'mirror' | 'other'

export const MISS_KINDS: { id: MissKind; label: string; note: string }[] = [
  { id: 'ahead', label: '先走り', note: '1 つ飛ばして、その次のキーを打った' },
  { id: 'repeat', label: '連打', note: '直前のキーをもう一度打った' },
  { id: 'adjacent', label: '隣のキー', note: '打つべきキーの隣を押した' },
  { id: 'mirror', label: '左右の取り違え', note: '反対の手の同じ指で打った' },
  { id: 'other', label: 'その他', note: '' },
]

export type MissStats = {
  // 誤打の起きた箇所の数。同じ箇所で続けて誤打しても 1 回
  events: number
  // 同じ箇所で 2 打目以降に重ねた誤打
  extra: number
  // 回数の多い順。pairs の expected は実際に打ち直したキー
  kinds: { kind: MissKind; count: number; pairs: Confusion[] }[]
  // 誤打 1 回あたりの損失 (ms) の平均。direct は正しいキーを打つまでの遅れ、recovery は直後の打鍵の遅れ。
  // 文頭の誤打は直前の打鍵が無く測れないので measured に含めない
  cost: { measured: number; direct: number; recovery: number } | null
}

// QWERTY の段と、段ごとの横ずれ (キー幅が単位)
const ROWS: [string, number][] = [
  ['1234567890-', -0.5],
  ['qwertyuiop', 0],
  ['asdfghjkl;', 0.25],
  ['zxcvbnm,./', 0.75],
]

const POS = new Map<string, { row: number; x: number }>()
ROWS.forEach(([keys, shift], row) => {
  ;[...keys].forEach((key, i) => POS.set(key, { row, x: i + shift }))
})

export function adjacent(a: string, b: string): boolean {
  const p = POS.get(a)
  const q = POS.get(b)
  if (!p || !q || a === b) return false
  const dx = Math.abs(p.x - q.x)
  return p.row === q.row ? dx === 1 : Math.abs(p.row - q.row) === 1 && dx < 1
}

// typed: 誤って打ったキー / intended: 打つべきだったキー / prev, next: その前後の正打鍵 (同じ文のもの)
export function classify(typed: string, intended: string, prev: string | null, next: string | null): MissKind {
  if (typed === next) return 'ahead'
  if (typed === prev) return 'repeat'
  if (adjacent(typed, intended)) return 'adjacent'
  const f = fingerOf(typed)
  const g = fingerOf(intended)
  if (f !== undefined && g !== undefined && f + g === 7) return 'mirror'
  return 'other'
}

// baseline は通常の打鍵間隔 (analyze の medianInterval)。null なら損失は出さない
export function misses(sessions: Session[], baseline: number | null): MissStats {
  const kinds = new Map<MissKind, Map<string, Confusion>>()
  let events = 0
  let extra = 0
  let measured = 0
  let direct = 0
  let recovery = 0

  for (const session of sessions) {
    const ks = session.keystrokes
    const hits = ks.flatMap((k, i) => (k.ok ? [i] : []))

    // h 番目の正打鍵の手前にある誤打のまとまりを見る。h = hits.length は打ち直さずに終わった誤打
    for (let h = 0; h <= hits.length; h++) {
      const start = h === 0 ? 0 : hits[h - 1] + 1
      const end = h < hits.length ? hits[h] : ks.length
      if (end === start) continue
      // 続けて誤打したときは、つられて打っただけのことが多いので最初の1打で分類する
      const first = ks[start]
      const hit: Keystroke | undefined = ks[end]
      const at = (j: number) => {
        const k: Keystroke | undefined = ks[hits[j]]
        return k && k.sentence === first.sentence ? k : undefined
      }
      const prev = at(h - 1)
      const next = hit && at(h + 1)

      events++
      extra += end - start - 1
      // ガイドと違うつづりで打ち直すこともあるので、実際に打ったキーを優先する
      const intended = (hit?.key ?? first.expected).toLowerCase()
      const typed = first.key.toLowerCase()
      const kind = classify(typed, intended, prev?.key.toLowerCase() ?? null, next?.key.toLowerCase() ?? null)
      let pairs = kinds.get(kind)
      if (!pairs) kinds.set(kind, (pairs = new Map()))
      const id = `${intended}\u0000${typed}`
      const pair = pairs.get(id)
      if (pair) pair.count++
      else pairs.set(id, { expected: intended, typed, count: 1 })

      if (baseline === null || !hit || !prev) continue
      measured++
      direct += hit.t - prev.t - baseline
      // 次の誤打か文末までで打ち切る。そこから先は次の誤打の損失として数える
      for (let j = h + 1; j <= h + AFTER_MISS_WINDOW; j++) {
        const k = at(j)
        if (!k || hits[j] !== hits[j - 1] + 1) break
        recovery += k.t - ks[hits[j - 1]].t - baseline
      }
    }
  }

  return {
    events,
    extra,
    kinds: [...kinds]
      .map(([kind, pairs]) => {
        const sorted = [...pairs.values()].sort((a, b) => b.count - a.count)
        return { kind, count: sorted.reduce((n, p) => n + p.count, 0), pairs: sorted }
      })
      .sort((a, b) => b.count - a.count),
    cost: measured > 0 ? { measured, direct: direct / measured, recovery: recovery / measured } : null,
  }
}
