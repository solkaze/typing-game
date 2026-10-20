// ゴースト: 決めた速度 (打/秒) で打つ相手。画面の自分の打鍵の下に、いまの文をどこまで打っているかを出す。
// 文ごとに比べられるよう、その文の1打鍵目と同時に同じ文を打ち始める

export const GHOST_KPS_MIN = 1
export const GHOST_KPS_MAX = 30
export const GHOST_KPS_STEP = 0.5

// 文の計測の起点から elapsedMs たった時点で、ゴーストがその文で打ち終えている打鍵数 (length で頭打ち)。
// 文ごとの速度 (Game.tsx の lastKps) は 打鍵数 / 起点からの時間 なので、ゴーストも起点では 0 打から始める。
// こうしておくと、文を打ち終えたときにゴーストより前にいる = その文の速度がゴーストの速度を上回っている、になる
export function ghostKeys(elapsedMs: number, kps: number, length: number): number {
  if (elapsedMs < 0) return 0
  return Math.min(length, Math.floor((elapsedMs / 1000) * kps))
}

export function readGhostKps(saved: unknown, fallback: number): number {
  if (typeof saved !== 'number' || !Number.isFinite(saved)) return fallback
  return Math.max(GHOST_KPS_MIN, Math.min(GHOST_KPS_MAX, saved))
}
