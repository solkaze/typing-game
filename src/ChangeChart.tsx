import type { Change } from './analysis'
import ChangeTable from './ChangeTable'
import Delta from './Delta'
import { signed } from './delta'
import { TipRows } from './Tip'
import { useTip } from './useTip'

type Props = { faster: Change[]; slower: Change[]; note?: string }

const pct = (v: number) => `${Math.round(v * 100)}%`

// 前半 → 後半の時間を、並びごとに2つの点とそれを結ぶ線で見せる。左ほど速い
export default function ChangeChart({ faster, slower, note }: Props) {
  const tip = useTip()
  const all = [...faster, ...slower]

  if (all.length === 0) {
    return (
      <section className="panel">
        <h3>2 連の変化</h3>
        <p className="note">前半と後半で変わった並びはありません</p>
      </section>
    )
  }

  const values = all.flatMap((c) => [c.before, c.after])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo) * 0.06 || 10
  const min = lo - pad
  const max = hi + pad
  const at = (v: number) => `${((v - min) / (max - min)) * 100}%`

  const group = (title: string, rows: Change[], kind: 'better' | 'worse') =>
    rows.length > 0 && (
      <>
        <div className="dumbbell-group">{title}</div>
        {rows.map((c) => (
          <div
            key={c.label}
            className="dumbbell-row"
            {...tip.bind(
              <TipRows
                title={c.label}
                mono
                rows={[
                  ['前半 → 後半', `${Math.round(c.before)} → ${Math.round(c.after)} ms`],
                  ['差', signed(c.after - c.before)],
                  ['ミス率', `${pct(c.missBefore)} → ${pct(c.missAfter)}`],
                  ['後半の回数', c.count],
                ]}
              />,
            )}
          >
            <span className="bar-label">{c.label}</span>
            <span className="dumbbell-track">
              <span
                className={`dumbbell-line ${kind}`}
                style={{ left: at(Math.min(c.before, c.after)), right: `calc(100% - ${at(Math.max(c.before, c.after))})` }}
              />
              <span className="dumbbell-dot before" style={{ left: at(c.before) }} />
              <span className={`dumbbell-dot after ${kind}`} style={{ left: at(c.after) }} />
            </span>
            <span className="bar-text">
              <Delta ms={c.after - c.before} />
            </span>
          </div>
        ))}
      </>
    )

  return (
    <section className="panel">
      <h3>2 連の変化</h3>
      {note && <p className="note">{note}</p>}
      <div className="viz-root dumbbell">
        <div className="dumbbell-legend">
          <i className="dumbbell-dot before" />
          前半
          <i className="dumbbell-dot after" />
          後半
        </div>
        <div className="dumbbell-axis">
          <span />
          <span className="dumbbell-scale">
            <span>← 速い　{Math.round(min)} ms</span>
            <span>{Math.round(max)} ms　遅い →</span>
          </span>
          <span />
        </div>
        {group('速くなった', faster, 'better')}
        {group('遅くなった', slower, 'worse')}
        {tip.node}
      </div>
      <details className="table-view">
        <summary>数値の表</summary>
        <ChangeTable rows={all} />
      </details>
    </section>
  )
}
