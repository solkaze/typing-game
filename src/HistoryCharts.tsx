import { useState } from 'react'
import LineChart from './LineChart'
import { clampRange, lastRange, MIN_SPAN, panRange, zoomRange, type Range } from './range'
import { accuracy, kps, type Session } from './types'

type Props = {
  sessions: Session[]
  // null は全体。詳細から戻っても拡大したままにするため親が持つ
  range: Range | null
  onRange: (range: Range | null) => void
  onSelect: (session: Session) => void
}

const PRESETS = [20, 50]

const date = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 全記録の推移。速度と正答率は単位が違うので軸を分け、表示範囲と指している回だけを揃える
export default function HistoryCharts({ sessions, range, onRange, onSelect }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const n = sessions.length
  const r = clampRange(range, n)
  const size = r.to - r.from + 1
  const shown = sessions.slice(r.from, r.to + 1)

  const set = (next: Range) => onRange(next.to - next.from + 1 >= n ? null : next)
  const points = (value: (s: Session) => number) =>
    shown.map((s) => ({ label: date(s.startedAt), note: `${s.kanaCount} かな`, value: value(s) }))

  const shared = {
    wide: true,
    restLabel: r.to === n - 1 ? '最新' : '右端',
    format: (v: number) => v.toFixed(2),
    hover,
    onHover: setHover,
    onSelect: (i: number) => onSelect(shown[i]),
    onZoom: (anchor: number, dir: 1 | -1) => set(zoomRange(r, n, anchor, dir)),
    onPan: (delta: number) => set(panRange(r, n, delta)),
  }

  return (
    <section className="history">
      <header className="history-head">
        <h3>記録の推移</h3>
        <span className="note">
          {size === n ? `全 ${n} 回` : `${r.from + 1}〜${r.to + 1} 回目 / 全 ${n} 回`}
        </span>
        <div className="segmented">
          {PRESETS.filter((p) => p < n).map((p) => (
            <button
              key={p}
              className={size === p && r.to === n - 1 ? 'on' : ''}
              onClick={() => set(lastRange(n, p))}
            >
              直近{p}回
            </button>
          ))}
          <button className={size === n ? 'on' : ''} onClick={() => onRange(null)}>
            すべて
          </button>
        </div>
      </header>
      <LineChart title="速度 (打/秒)" points={points(kps)} {...shared} />
      <LineChart title="正答率 (%)" points={points((s) => accuracy(s) * 100)} {...shared} />
      <p className="note">
        点をクリックするとその回の詳細を開きます。
        {n > MIN_SPAN && 'ホイールで拡大・縮小、ドラッグで左右に移動できます。'}
      </p>
    </section>
  )
}
