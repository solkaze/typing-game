import { useEffect, useRef, useState } from 'react'

// note は読み出しにだけ添える補足 (軸には出さない)
type Point = { label: string; value: number; note?: string }

type Props = {
  title: string
  points: Point[]
  format: (value: number) => string
  // ページ幅いっぱいに置くとき。幅に応じて高さも少し伸ばす
  wide?: boolean
  // 何も指していないときに右端の値へ付ける見出し
  restLabel?: string
  // 複数のグラフで指している位置を揃えるときは親が持つ
  hover?: number | null
  onHover?: (index: number | null) => void
  onSelect?: (index: number) => void
  // anchor は横位置 (0-1)、dir は +1 で拡大
  onZoom?: (anchor: number, dir: 1 | -1) => void
  // delta は動かす点数。右へ引くと負
  onPan?: (delta: number) => void
}

const PAD = { top: 12, right: 16, bottom: 22, left: 44 }
// これより動いたらクリックではなくドラッグとみなす (px)
const DRAG_START = 4

// 1系列の推移。系列が1つなので凡例は持たず、タイトルが系列名を兼ねる
export default function LineChart({
  title,
  points,
  format,
  wide = false,
  restLabel = '最新',
  hover: sharedHover,
  onHover,
  onSelect,
  onZoom,
  onPan,
}: Props) {
  const [ownHover, setOwnHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; shift: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  // 実際の表示幅 (px)。測るまでは仮の寸法で描く
  const [width, setWidth] = useState<number | null>(null)
  const empty = points.length === 0

  // 拡大縮小ではなく幅そのものを座標系にするので、文字や線の太さは幅によらず一定になる
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setWidth(w)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [empty])

  const W = width ?? (wide ? 880 : 420)
  const H = wide ? Math.round(Math.min(280, Math.max(200, W * 0.2))) : 170
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  // React の onWheel は passive で、ページのスクロールを止められないので直接付ける
  useEffect(() => {
    const el = svg.current
    if (!el || !onZoom) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return
      e.preventDefault()
      const box = el.getBoundingClientRect()
      const px = ((e.clientX - box.left) / box.width) * W
      onZoom(Math.max(0, Math.min(1, (px - PAD.left) / innerW)), e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onZoom, W, innerW])

  if (empty) return null

  const setHover = onHover ?? setOwnHover
  const wanted = onHover ? (sharedHover ?? null) : ownHover
  const hover = wanted !== null && wanted < points.length ? wanted : null

  const values = points.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || Math.abs(hi) * 0.1 || 1
  const min = lo - span * 0.1
  const max = hi + span * 0.1
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH
  const ticks = [min + (max - min) * 0.1, (min + max) / 2, max - (max - min) * 0.1]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')

  const indexAt = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const ratio = points.length === 1 ? 0 : (px - PAD.left) / innerW
    const i = Math.round(ratio * (points.length - 1))
    return Math.max(0, Math.min(points.length - 1, i))
  }

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragged.current = false
    if (!onPan || e.button !== 0) return
    drag.current = { x: e.clientX, shift: 0, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (d && onPan) {
      const dx = e.clientX - d.x
      if (Math.abs(dx) > DRAG_START) d.moved = true
      if (d.moved) {
        const box = e.currentTarget.getBoundingClientRect()
        const step = (box.width * (innerW / W)) / Math.max(1, points.length - 1)
        const shift = Math.round(-dx / step)
        if (shift !== d.shift) {
          onPan(shift - d.shift)
          d.shift = shift
        }
        setHover(null)
        return
      }
    }
    setHover(indexAt(e))
  }

  const onUp = () => {
    dragged.current = drag.current?.moved ?? false
    drag.current = null
  }

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // ドラッグの終わりに出る click では選ばない
    if (dragged.current) {
      dragged.current = false
      return
    }
    onSelect?.(indexAt(e))
  }

  const h = hover !== null ? points[hover] : null

  return (
    <figure className={`viz-root chart${onSelect ? ' selectable' : ''}`}>
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-readout">
          {h
            ? `${h.label}${h.note ? ` ${h.note}` : ''}　${format(h.value)}`
            : `${restLabel} ${format(values[values.length - 1])}`}
        </span>
      </figcaption>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
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
        {points.length <= innerW / 10 &&
          points.map((p, i) => <circle key={i} className="marker" cx={x(i)} cy={y(p.value)} r={4} />)}
        {hover !== null && <circle className="marker active" cx={x(hover)} cy={y(points[hover].value)} r={5} />}
      </svg>
    </figure>
  )
}
