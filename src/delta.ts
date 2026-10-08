// 前半から後半への時間の変化の表示。負なら速くなった
export const signed = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)} ms`

// 速くなったら better、遅くなったら worse。四捨五入して 0 になる差には色を付けない
export const tone = (v: number) => (Math.round(v) < 0 ? 'better' : Math.round(v) > 0 ? 'worse' : '')
