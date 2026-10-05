import { median } from './analysis'
import type { Session } from './types'

// 1回分のふり返り。打鍵ログを文ごとに並べ直し、遅かった箇所とミスした箇所に印を付ける

// その回の打鍵間隔の中央値に対して、この倍率以上かかった打鍵を「遅い」「詰まり」とする
export const SLOW_RATIO = 1.5
export const STALL_RATIO = 2.5

export type Level = 'ok' | 'slow' | 'stall' | 'miss'

export type ReviewKey = {
  key: string
  kanaPos: number
  // 直前の正打鍵からの時間。文頭では前の文の最後の打鍵から。セッションの1打目は null
  dt: number | null
  // 正しく打つまでに打ってしまったキー
  wrong: string[]
  level: Level
}

export type ReviewSentence = {
  text: string
  keys: ReviewKey[]
  // 文頭の打鍵を除いた、文の中だけの速度 (打/秒)
  kps: number | null
  misses: number
  // 前の文を打ち終えてから最初のキーを打つまでの時間
  lead: number | null
}

export type Spot = {
  sentence: number
  // 文の中での位置
  index: number
  // 直前の数打。どの運指で遅れたかを見るため
  before: string
  key: string
  dt: number
  ratio: number
}

export type Loss = { count: number; ms: number }

export type Review = {
  baseline: number | null
  sentences: ReviewSentence[]
  // 中央値のペースで打てていた場合と比べて余計にかかった時間の内訳
  loss: { miss: Loss; slow: Loss; lead: Loss }
  // ミスと遅れが無かった場合の速度 (打/秒)
  potentialKps: number | null
  // 誤打なしで遅かった打鍵。時間の長い順
  spots: Spot[]
}

const SPOT_CONTEXT = 3

export function review(session: Session, spotLimit = 10): Review {
  const sentences: ReviewSentence[] = []
  let wrong: string[] = []
  let prevT: number | null = null

  for (const k of session.keystrokes) {
    if (!k.ok) {
      wrong.push(k.key)
      continue
    }
    while (sentences.length <= k.sentence) {
      sentences.push({ text: session.texts[sentences.length] ?? '', keys: [], kps: null, misses: 0, lead: null })
    }
    const s = sentences[k.sentence]
    const dt = prevT === null ? null : k.t - prevT
    if (s.keys.length === 0) s.lead = dt
    s.keys.push({ key: k.key, kanaPos: k.kanaPos, dt, wrong, level: wrong.length ? 'miss' : 'ok' })
    s.misses += wrong.length
    wrong = []
    prevT = k.t
  }

  // 基準は analysis.ts と同じく、誤打なしで打てた文中の打鍵間隔の中央値
  const clean: number[] = []
  for (const s of sentences) {
    for (const k of s.keys.slice(1)) if (k.level === 'ok') clean.push(k.dt!)
  }
  const baseline = median(clean)

  const loss = { miss: { count: 0, ms: 0 }, slow: { count: 0, ms: 0 }, lead: { count: 0, ms: 0 } }
  const spots: Spot[] = []
  const add = (l: Loss, dt: number) => {
    l.count++
    l.ms += Math.max(0, dt - (baseline ?? dt))
  }

  sentences.forEach((s, si) => {
    const inner = s.keys.slice(1).reduce((sum, k) => sum + k.dt!, 0)
    if (inner > 0) s.kps = ((s.keys.length - 1) / inner) * 1000

    s.keys.forEach((k, i) => {
      if (k.dt === null) return
      if (i === 0) {
        // 文頭は次の文を読む時間を含むので、ミスしていても「文の切り替わり」に数える
        add(loss.lead, k.dt)
        return
      }
      if (k.level === 'miss') {
        add(loss.miss, k.dt)
        return
      }
      if (baseline === null || baseline <= 0) return
      const ratio = k.dt / baseline
      if (ratio < SLOW_RATIO) return
      k.level = ratio >= STALL_RATIO ? 'stall' : 'slow'
      add(loss.slow, k.dt)
      spots.push({
        sentence: si,
        index: i,
        before: s.keys
          .slice(Math.max(0, i - SPOT_CONTEXT), i)
          .map((p) => p.key)
          .join(''),
        key: k.key,
        dt: k.dt,
        ratio,
      })
    })
  })

  const ideal = session.durationMs - loss.miss.ms - loss.slow.ms
  return {
    baseline,
    sentences,
    loss,
    potentialKps: baseline !== null && ideal > 0 ? ((session.correct - 1) / ideal) * 1000 : null,
    spots: spots.sort((a, b) => b.dt - a.dt).slice(0, spotLimit),
  }
}
