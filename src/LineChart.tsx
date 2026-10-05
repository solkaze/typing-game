import { useState } from 'react'

type Point = { label: string; value: number }

type Props = {
  title: string
  points: Point[]
  format: (value: number) => string
}

const W = 420
const H = 170
const PAD = { top: 12, right: 16, bottom: 22, left: 44 }

// 1系列の推移。系列が1つなので凡例は持たず、タイトルが系列名を兼ねる
export default function LineChart({ title, points, format }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || Math.abs(hi) * 0.1 || 1
  const min = lo - span * 0.1
  const max = hi + span * 0.1
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const ratio = points.length === 1 ? 0 : (px - PAD.left) / innerW
    const i = Math.round(ratio * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, i)))
  }

  const h = hover !== null ? points[hover] : null

  return (
    <figure className="viz-root chart">
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-readout">
          {h ? `${h.label}　${format(h.value)}` : `最新 ${format(values[values.length - 1])}`}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="tick" x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
              {format(t)}
            </text>
          </g>
        ))}
        <text className="tick" x={PAD.left} y={H - 4}>
          {points[0].label}
        </text>
        {points.length > 1 && (
          <text className="tick" x={W - PAD.right} y={H - 4} textAnchor="end">
            {points[points.length - 1].label}
          </text>
        )}
        {hover !== null && (
          <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} />
        )}
        <path className="series" d={path} />
        {points.length <= 40 &&
          points.map((p, i) => <circle key={i} className="marker" cx={x(i)} cy={y(p.value)} r={4} />)}
        {hover !== null && <circle className="marker active" cx={x(hover)} cy={y(points[hover].value)} r={5} />}
      </svg>
    </figure>
  )
}
