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

export type Session = {
  id?: number
  startedAt: string
  kanaCount: number
  durationMs: number
  correct: number
  misses: number
  texts: string[]
  keystrokes: Keystroke[]
}

export const kps = (s: Session) =>
  s.durationMs > 0 ? (s.correct - 1) / (s.durationMs / 1000) : 0

export const accuracy = (s: Session) =>
  s.correct + s.misses > 0 ? s.correct / (s.correct + s.misses) : 0
