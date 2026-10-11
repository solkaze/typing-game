import { tone } from './delta'

// 前半から後半への時間の変化。向きは矢印と色の両方で示し、数字は地の文字色のままにする
export default function Delta({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="delta none">-</span>
  const t = tone(ms)
  return (
    <span className={`delta ${t}`}>
      <i aria-hidden="true">{t === 'better' ? '▼' : t === 'worse' ? '▲' : '・'}</i>
      {Math.abs(Math.round(ms))}
      <span className="sr-only">{t === 'better' ? ' ms 速くなった' : t === 'worse' ? ' ms 遅くなった' : ' ms'}</span>
    </span>
  )
}
