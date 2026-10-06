export type Keystroke = {
  // セッションの1打鍵目からの経過ミリ秒
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
// endless: 決めた回数ミスするまで短文を打ち続ける
export type Mode = 'standard' | 'optimize' | 'long' | 'endless'

export const MODES: { id: Mode; label: string }[] = [
  { id: 'standard', label: '通常' },
  { id: 'optimize', label: '最適化' },
  { id: 'long', label: '長文' },
  { id: 'endless', label: 'エンドレス' },
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

export const kps = (s: Session) =>
  s.durationMs > 0 ? (s.correct - 1) / (s.durationMs / 1000) : 0

export const accuracy = (s: Session) =>
  s.correct + s.misses > 0 ? s.correct / (s.correct + s.misses) : 0
