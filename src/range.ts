// 履歴グラフの表示範囲。記録の添字で、両端を含む
export type Range = { from: number; to: number }

// これより少ない点数までは拡大しない
export const MIN_SPAN = 5

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const sized = (from: number, size: number, n: number): Range => {
  const start = clamp(from, 0, n - size)
  return { from: start, to: start + size - 1 }
}

// null は全体。記録が増減して範囲がはみ出したときもここで収める
export function clampRange(r: Range | null, n: number): Range {
  if (!r) return { from: 0, to: n - 1 }
  const size = clamp(r.to - r.from + 1, Math.min(n, MIN_SPAN), n)
  return sized(r.from, size, n)
}

export const lastRange = (n: number, size: number): Range => sized(n - size, Math.min(n, size), n)

// anchor は表示範囲の中での横位置 (0-1)。その位置の記録が動かないように拡大・縮小する
export function zoomRange(r: Range, n: number, anchor: number, dir: 1 | -1): Range {
  const size = r.to - r.from + 1
  const wanted = dir > 0 ? Math.min(size - 1, Math.round(size * 0.8)) : Math.max(size + 1, Math.round(size * 1.25))
  const next = clamp(wanted, Math.min(n, MIN_SPAN), n)
  const at = r.from + anchor * (size - 1)
  return sized(Math.round(at - anchor * (next - 1)), next, n)
}

export const panRange = (r: Range, n: number, delta: number): Range => sized(r.from + delta, r.to - r.from + 1, n)
