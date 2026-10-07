// ゴースト: 決めた速度 (打/秒) で打つ相手。画面の自分の打鍵の下に、いまの文をどこまで打っているかを出す。
// 文ごとに比べられるよう、自分がその文の1打鍵目を打った時に同じ文を打ち始める

export const GHOST_KPS_MIN = 1
export const GHOST_KPS_MAX = 30
export const GHOST_KPS_STEP = 0.5

// 文の1打鍵目から elapsedMs たった時点で、ゴーストがその文で打ち終えている打鍵数 (length で頭打ち)。
// 文ごとの速度 (Game.tsx の lastKps) が1打鍵目を時刻 0 として数えるのに合わせ、ゴーストも時刻 0 に1打鍵目を打つ。
// こうしておくと、文を打ち終えたときにゴーストより前にいる = その文の速度がゴーストの速度を上回っている、になる
export function ghostKeys(elapsedMs: number, kps: number, length: number): number {
  if (elapsedMs < 0) return 0
  return Math.min(length, 1 + Math.floor((elapsedMs / 1000) * kps))
}

export function readGhostKps(saved: unknown, fallback: number): number {
  if (typeof saved !== 'number' || !Number.isFinite(saved)) return fallback
  return Math.max(GHOST_KPS_MIN, Math.min(GHOST_KPS_MAX, saved))
}
