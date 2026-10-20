import { median } from './analysis'
import { keyTimes, startsAtFirstKey, timedKeys, typingMs, type Session } from './types'

// 1回分のふり返り。打鍵ログを文ごとに並べ直し、遅かった箇所とミスした箇所に印を付ける

// その回の打鍵間隔の中央値に対して、この倍率以上かかった打鍵を「遅い」「詰まり」とする
export const SLOW_RATIO = 1.5
export const STALL_RATIO = 2.5

export type Level = 'ok' | 'slow' | 'stall' | 'miss'

export type ReviewKey = {
  key: string
  kanaPos: number
  // 同じ文の直前の正打鍵からの時間 (types.ts の keyTimes)。速度は文ごとに1打鍵目から測るので、
  // 文の1打鍵目は null (文の1打鍵目が誤打なら、最初の正打鍵はその誤打からの時間)
  dt: number | null
  // 正しく打つまでに打ってしまったキー
  wrong: string[]
  level: Level
}

export type ReviewSentence = {
  text: string
  keys: ReviewKey[]
  // 文の速度 (打/秒)。全体の速度と同じく、その文の1打鍵目から測る (文を読む時間は入れない)
  kps: number | null
  misses: number
  // 前の文を打ち終えてから (最初の文は文が出てから) その文の1打鍵目までの時間。
  // 速度にも失った時間にも入れず、参考に出すだけ
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
  loss: { miss: Loss; slow: Loss }
  // ミスと遅れが無かった場合の速度 (打/秒)
  potentialKps: number | null
  // 誤打なしで遅かった打鍵。時間の長い順
  spots: Spot[]
}

const SPOT_CONTEXT = 3

export function review(session: Session, spotLimit = 10): Review {
  const sentences: ReviewSentence[] = []
  let wrong: string[] = []
  // 速度は types.ts の kps と同じく文ごとに1打鍵目から測る (keyTimes)
  const times = keyTimes(session)
  let n = 0
  // 前の打鍵の時刻と文。打ち始めまでの時間 (lead) に使う
  let prevT: number | null = startsAtFirstKey(session) ? null : 0
  let prevSentence = -1
  let lead: number | null = null

  for (const k of session.keystrokes) {
    if (k.sentence !== prevSentence) {
      lead = prevT === null ? null : k.t - prevT
      prevSentence = k.sentence
    }
    prevT = k.t
    if (!k.ok) {
      wrong.push(k.key)
      continue
    }
    while (sentences.length <= k.sentence) {
      sentences.push({ text: session.texts[sentences.length] ?? '', keys: [], kps: null, misses: 0, lead: null })
    }
    const s = sentences[k.sentence]
    if (s.keys.length === 0) s.lead = lead
    s.keys.push({ key: k.key, kanaPos: k.kanaPos, dt: times[n++], wrong, level: wrong.length ? 'miss' : 'ok' })
    s.misses += wrong.length
    wrong = []
  }

  // 基準は analysis.ts と同じく、誤打なしで打てた文中の打鍵間隔の中央値
  const clean: number[] = []
  for (const s of sentences) {
    for (const k of s.keys.slice(1)) if (k.level === 'ok') clean.push(k.dt!)
  }
  const baseline = median(clean)

  const loss = { miss: { count: 0, ms: 0 }, slow: { count: 0, ms: 0 } }
  const spots: Spot[] = []
  const add = (l: Loss, dt: number) => {
    l.count++
    l.ms += Math.max(0, dt - (baseline ?? dt))
  }

  sentences.forEach((s, si) => {
    const timed = s.keys.filter((k) => k.dt !== null)
    const total = timed.reduce((sum, k) => sum + k.dt!, 0)
    if (total > 0) s.kps = (timed.length / total) * 1000

    s.keys.forEach((k, i) => {
      if (k.dt === null) return
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

  const ideal = typingMs(session) - loss.miss.ms - loss.slow.ms
  return {
    baseline,
    sentences,
    loss,
    potentialKps: baseline !== null && ideal > 0 ? (timedKeys(session) / ideal) * 1000 : null,
    spots: spots.sort((a, b) => b.dt - a.dt).slice(0, spotLimit),
  }
}
