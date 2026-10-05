import { accuracy, kps, type Session } from './types'

export type Row = {
  label: string
  count: number
  // ミスなしで打てたときの所要時間の中央値 (ms)。2連・3連は最後のキーまでの合計
  median: number | null
  // 1回で正しく打てなかった割合
  missRate: number
  // 全体の中央値より遅い分 × 回数 (ms)。改善したときの効果の目安
  loss: number
}

export type Confusion = { expected: string; typed: string; count: number }

export type Analysis = {
  hits: number
  medianInterval: number | null
  keys: Row[]
  bigrams: Row[]
  trigrams: Row[]
  confusions: Confusion[]
  flow: {
    sentenceStart: number | null
    afterMiss: number | null
    firstHalfKps: number | null
    secondHalfKps: number | null
  }
  trend: { id?: number; startedAt: string; kps: number; accuracy: number }[]
}

type Hit = {
  key: string
  t: number
  // 同じ文の直前の正打鍵からの時間。文頭は null
  dt: number | null
  // 誤打なしで1回で打てたか
  clean: boolean
  // 直近の誤打からの正打鍵数 (誤打のあった打鍵が 0)
  sinceMiss: number
}

const AFTER_MISS_WINDOW = 3

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

class Bucket {
  count = 0
  unclean = 0
  times: number[] = []
}

function bump(map: Map<string, Bucket>, label: string, clean: boolean, time: number | null) {
  let b = map.get(label)
  if (!b) map.set(label, (b = new Bucket()))
  b.count++
  if (!clean) b.unclean++
  else if (time !== null) b.times.push(time)
}

function rows(map: Map<string, Bucket>, baseline: number | null): Row[] {
  return [...map].map(([label, b]) => {
    const m = median(b.times)
    return {
      label,
      count: b.count,
      median: m,
      missRate: b.unclean / b.count,
      loss: m !== null && baseline !== null ? (m - baseline) * b.count : 0,
    }
  })
}

export function analyze(sessions: Session[]): Analysis {
  const keys = new Map<string, Bucket>()
  const bigrams = new Map<string, Bucket>()
  const trigrams = new Map<string, Bucket>()
  const confusions = new Map<string, Confusion>()
  const intervals: number[] = []
  const sentenceStarts: number[] = []
  const afterMiss: number[] = []
  const firstHalf: number[] = []
  const secondHalf: number[] = []
  let hitCount = 0

  for (const session of sessions) {
    const hits: Hit[] = []
    let prev: Hit | undefined
    let prevSentence = -1
    let missed = false
    let sinceMiss = Infinity

    for (const k of session.keystrokes) {
      if (!k.ok) {
        missed = true
        const id = `${k.expected}\u0000${k.key}`
        const c = confusions.get(id)
        if (c) c.count++
        else confusions.set(id, { expected: k.expected, typed: k.key, count: 1 })
        continue
      }
      const sameSentence = k.sentence === prevSentence
      sinceMiss = missed ? 0 : sinceMiss + 1
      const hit: Hit = {
        key: k.key,
        t: k.t,
        dt: prev && sameSentence ? k.t - prev.t : null,
        clean: !missed,
        sinceMiss,
      }
      if (prev && !sameSentence && hit.clean) sentenceStarts.push(k.t - prev.t)

      const p1 = sameSentence ? hits[hits.length - 1] : undefined
      const p2 = p1 && p1.dt !== null ? hits[hits.length - 2] : undefined
      bump(keys, hit.key, hit.clean, hit.dt)
      if (p1) bump(bigrams, p1.key + hit.key, hit.clean, hit.dt)
      if (p1 && p2) {
        // 途中で誤打した3連は、どこが遅いのか分からなくなるので時間に含めない
        bump(trigrams, p2.key + p1.key + hit.key, hit.clean && p1.clean, hit.dt! + p1.dt!)
      }
      if (hit.clean && hit.dt !== null) {
        intervals.push(hit.dt)
        if (sinceMiss >= 1 && sinceMiss <= AFTER_MISS_WINDOW) afterMiss.push(hit.dt)
      }

      hits.push(hit)
      prev = hit
      prevSentence = k.sentence
      missed = false
    }

    hitCount += hits.length
    const half = hits.length >> 1
    if (half >= 2) {
      const end = hits[hits.length - 1].t
      const mid = hits[half].t
      if (mid > 0) firstHalf.push((half / mid) * 1000)
      if (end > mid) secondHalf.push(((hits.length - 1 - half) / (end - mid)) * 1000)
    }
  }

  const baseline = median(intervals)
  const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

  return {
    hits: hitCount,
    medianInterval: baseline,
    keys: rows(keys, baseline),
    bigrams: rows(bigrams, baseline),
    trigrams: rows(trigrams, baseline !== null ? baseline * 2 : null),
    confusions: [...confusions.values()].sort((a, b) => b.count - a.count),
    flow: {
      sentenceStart: median(sentenceStarts),
      afterMiss: median(afterMiss),
      firstHalfKps: mean(firstHalf),
      secondHalfKps: mean(secondHalf),
    },
    trend: sessions.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      kps: kps(s),
      accuracy: accuracy(s),
    })),
  }
}

// 回数が少なすぎるものを除き、損失時間の大きい順に並べる
export function worst(rows: Row[], minCount: number, limit: number): Row[] {
  return rows
    .filter((r) => r.count >= minCount && r.median !== null)
    .sort((a, b) => b.loss - a.loss)
    .slice(0, limit)
}
