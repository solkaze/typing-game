import { useState } from 'react'
import type { Change, Confusion, Row } from './analysis'
import BarList from './BarList'
import Delta from './Delta'
import RowTip from './RowTip'
import StatTable from './StatTable'
import { useTip } from './useTip'

type Props = {
  keys: Row[]
  // これより回数の少ないキーは、偶然の影響が大きいので色を付けない
  minCount: number
  changes?: Map<string, Change>
  confusions: Confusion[]
}

type Metric = 'time' | 'miss' | 'loss'

const METRICS: { id: Metric; label: string; low: string; high: string; side: string }[] = [
  { id: 'time', label: '時間', low: '速い', high: '遅い', side: '遅いキー' },
  { id: 'miss', label: 'ミス率', low: '少ない', high: '多い', side: 'ミスしやすいキー' },
  { id: 'loss', label: '損失', low: '小さい', high: '大きい', side: '損失の大きいキー' },
]

// QWERTY の段と、段ごとの横ずれ (キー幅が単位)
const ROWS: [string, number][] = [
  ['1234567890-', 0],
  ['qwertyuiop', 0.5],
  ['asdfghjkl;', 0.75],
  ['zxcvbnm,./', 1.25],
]

// 色の段数。index.css の .heat-0 〜 .heat-6 と揃える。色相は値ごとに .heat-time / .heat-miss / .heat-loss で切り替える
const STEPS = 7
const SIDE = 8

const value = (r: Row, metric: Metric) =>
  metric === 'time' ? r.median : metric === 'miss' ? r.missRate * 100 : Math.max(0, r.loss) / 1000

const format = (v: number, metric: Metric) =>
  metric === 'time' ? `${Math.round(v)} ms` : metric === 'miss' ? `${v.toFixed(1)}%` : `${v.toFixed(2)} 秒`

// キーの上に小さく出すので単位は省く
const short = (v: number, metric: Metric) =>
  metric === 'time' ? String(Math.round(v)) : metric === 'miss' ? v.toFixed(1) : v.toFixed(1)

// キーごとの値をキーボードの形に並べ、色の濃さで見せる
export default function KeyboardMap({ keys, minCount, changes, confusions }: Props) {
  const [metric, setMetric] = useState<Metric>('time')
  const tip = useTip()
  const m = METRICS.find((x) => x.id === metric)!

  const rows = new Map(keys.map((r) => [r.label.toLowerCase(), r]))
  const scored = keys.flatMap((r) => {
    const v = value(r, metric)
    return r.count >= minCount && v !== null ? [{ row: r, v }] : []
  })
  const values = scored.map((s) => s.v)
  // 時間は 0 から始めると差が見えないので、いちばん速いキーを薄い端にする
  const lo = metric === 'time' && values.length ? Math.min(...values) : 0
  const hi = values.length ? Math.max(...values) : 0
  const step = (v: number) => (hi > lo ? Math.min(STEPS - 1, Math.floor(((v - lo) / (hi - lo)) * STEPS)) : 0)

  const wrong = (key: string) =>
    confusions
      .filter((c) => c.expected.toLowerCase() === key)
      .slice(0, 3)
      .map((c) => `${c.typed === ' ' ? 'Space' : c.typed} ×${c.count}`)
      .join('　')

  const tipOf = (r: Row) => {
    const w = wrong(r.label.toLowerCase())
    return <RowTip row={r} change={changes?.get(r.label)} foot={w ? `代わりに打ったキー: ${w}` : undefined} />
  }

  const ranked = [...scored].sort((a, b) => b.v - a.v).filter((s) => s.v > 0)

  return (
    <section className="panel keyboard-panel">
      <header className="panel-head">
        <h3>キー別</h3>
        <div className="segmented">
          {METRICS.map((x) => (
            <button key={x.id} className={x.id === metric ? 'on' : ''} onClick={() => setMetric(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </header>
      {scored.length === 0 ? (
        <p className="note">まだデータが足りません</p>
      ) : (
        <>
          <div className="keyboard-body">
            <div className={`viz-root keyboard-wrap heat-${metric}`}>
              <div className="keyboard">
                {ROWS.map(([line, shift]) => (
                  <div key={line} className="keyboard-row" style={{ marginLeft: `calc(${shift} * (var(--k) + var(--gap)))` }}>
                    {[...line].map((key) => {
                      const r = rows.get(key)
                      const v = r && r.count >= minCount ? value(r, metric) : null
                      return (
                        <span
                          key={key}
                          className={`key ${v !== null ? `heat-${step(v)}` : 'blank'}`}
                          {...(r ? tip.bind(tipOf(r)) : {})}
                        >
                          <b>{key}</b>
                          {v !== null && <small>{short(v, metric)}</small>}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div className="heat-legend">
                <span>
                  {m.low} {format(lo, metric)}
                </span>
                <span className="heat-scale">
                  {Array.from({ length: STEPS }, (_, i) => (
                    <i key={i} className={`heat-${i}`} />
                  ))}
                </span>
                <span>
                  {format(hi, metric)} {m.high}
                </span>
              </div>
              {tip.node}
            </div>
            <div className="keyboard-side">
              <h4>{m.side}</h4>
              <BarList
                mono
                bars={ranked.slice(0, SIDE).map(({ row, v }) => ({
                  id: row.label,
                  label: row.label,
                  value: v,
                  text: format(v, metric),
                  extra: changes ? <Delta ms={changes.has(row.label) ? changes.get(row.label)!.after - changes.get(row.label)!.before : null} /> : undefined,
                  tone: metric === 'miss' ? 'miss' : metric === 'loss' ? 'loss' : undefined,
                  tip: tipOf(row),
                }))}
              />
            </div>
          </div>
          <p className="note">
            {minCount} 回以上打ったキーに色を付けています。損失は、全体の中央値より遅い分 × 回数。
            {changes && '▼▲ は前半から後半への時間の変化 (ms)。'}
          </p>
          <details className="table-view">
            <summary>数値の表</summary>
            <StatTable rows={ranked.map((s) => s.row)} changes={changes} />
          </details>
        </>
      )}
    </section>
  )
}
