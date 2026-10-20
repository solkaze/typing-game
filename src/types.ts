export type Keystroke = {
  // カウントダウンが終わって最初の文を出した時からの経過ミリ秒 (速度は文ごとに1打鍵目から測る: keyTimes)。
  // 以前の記録は1打鍵目を起点 (t = 0) にしていたので、1打鍵目までの時間が無い (startsAtFirstKey)
  t: number
  key: string
  // KeyboardEvent.code。配列 (JIS/US) に依らない物理キー
  code: string
  ok: boolean
  // その時点でガイドが示していたキー
  expected: string
  sentence: number
  kanaPos: number
}

// standard: 短文を決まったかな数だけ / optimize: 同じ指が続く並びを詰めた文 / long: ひと続きの長文 /
// endless: 決めた回数ミスするまで短文を打ち続ける / weak: これまでの記録で遅い・誤打しやすい2連が濃い文
export type Mode = 'standard' | 'optimize' | 'long' | 'endless' | 'weak'

export const MODES: { id: Mode; label: string }[] = [
  { id: 'standard', label: '通常' },
  { id: 'optimize', label: '最適化' },
  { id: 'long', label: '長文' },
  { id: 'endless', label: 'エンドレス' },
  { id: 'weak', label: '弱点' },
]

export type Session = {
  id?: number
  // モードを追加する前の記録には無い。modeOf で読む
  mode?: Mode
  // 長文モードで打った文章の題
  title?: string
  // エンドレスモードで、この回数ミスしたら終わりという上限
  missLimit?: number
  // エンドレスモードで最後まで打ち切った文の数
  completed?: number
  startedAt: string
  // エンドレスモードでは打てたかな数 (途中で終わった文のぶんも含む)
  kanaCount: number
  durationMs: number
  correct: number
  misses: number
  texts: string[]
  keystrokes: Keystroke[]
}

export const modeOf = (s: Session): Mode => s.mode ?? 'standard'

export const modeLabel = (mode: Mode) => MODES.find((m) => m.id === mode)!.label

// 1打鍵目を時刻 0 にしていた以前の記録か。そうなら最初の打鍵には、かかった時間が無い
export const startsAtFirstKey = (s: Session) => s.keystrokes.length > 0 && s.keystrokes[0].t === 0

// 速度は多くのタイピングサイトと同じく、文ごとにその文の1打鍵目 (誤打も含む) から測る。
// 文が出てから打ち始めるまで (文を読む時間) は入れない。
// 正打鍵ごとの、かかった時間: 同じ文の直前の正打鍵 (文の最初の正打鍵はその文の1打鍵目) からの時間。
// 文の1打鍵目そのものが正打なら測れないので null
export function keyTimes(s: Session): (number | null)[] {
  const out: (number | null)[] = []
  let sentence = -1
  let anchor = 0
  for (const k of s.keystrokes) {
    const first = k.sentence !== sentence
    if (first) {
      sentence = k.sentence
      anchor = k.t
    }
    if (!k.ok) continue
    out.push(first ? null : k.t - anchor)
    anchor = k.t
  }
  return out
}

// 各文で1打鍵目から最後の正打鍵までにかかった時間の合計
export const typingMs = (s: Session) => keyTimes(s).reduce<number>((sum, dt) => sum + (dt ?? 0), 0)

// typingMs の間に打った (かかった時間を測れた) 正打鍵の数。各文の1打鍵目が正打ならそれは数えない
export const timedKeys = (s: Session) => keyTimes(s).filter((dt) => dt !== null).length

export const kps = (s: Session) => {
  const times = keyTimes(s).filter((dt) => dt !== null)
  const ms = times.reduce((sum, dt) => sum + dt, 0)
  return ms > 0 ? times.length / (ms / 1000) : 0
}

export const accuracy = (s: Session) =>
  s.correct + s.misses > 0 ? s.correct / (s.correct + s.misses) : 0
