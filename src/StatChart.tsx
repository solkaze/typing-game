import type { Change, Row } from './analysis'
import BarList, { type Bar } from './BarList'
import Delta from './Delta'
import StatTable from './StatTable'
import RowTip from './RowTip'

type Props = {
  title: string
  note?: string
  rows: Row[]
  // 渡すと、期間の前半から後半への変わり方を添える
  changes?: Map<string, Change>
  // 棒の長さにする値。loss は損失時間、miss はミス率、misses はミスした回数
  by?: 'loss' | 'miss' | 'misses'
}

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)
const sec = (v: number) => `${(v / 1000).toFixed(2)} 秒`

// キーや連なりの順位を横棒で見せる。細かい数字は吹き出しと下の表に置く
export default function StatChart({ title, note, rows, changes, by = 'loss' }: Props) {
  const bars = rows.map((r): Bar => {
    const c = changes?.get(r.label)
    const delta = changes ? <Delta ms={c ? c.after - c.before : null} /> : null
    return by === 'loss'
      ? {
          id: r.label,
          label: r.label,
          value: r.loss,
          text: sec(r.loss),
          extra: (
            <>
              {ms(r.median)}
              {delta}
            </>
          ),
          tone: 'slow',
          tip: <RowTip row={r} change={c} />,
        }
      : {
          id: r.label,
          label: r.label,
          value: by === 'miss' ? r.missRate : r.missRate * r.count,
          text: by === 'miss' ? `${Math.round(r.missRate * 100)}%` : `${Math.round(r.missRate * r.count)} 回`,
          extra:
            by === 'miss'
              ? `${Math.round(r.missRate * r.count)} / ${r.count} 回`
              : `${r.count} 回中　${Math.round(r.missRate * 100)}%`,
          tone: 'miss',
          tip: <RowTip row={r} change={c} />,
        }
  })

  return (
    <section className="panel">
      <h3>{title}</h3>
      {note && <p className="note">{note}</p>}
      {rows.length === 0 ? (
        <p className="note">まだデータが足りません</p>
      ) : (
        <>
          <BarList bars={bars} mono />
          <details className="table-view">
            <summary>数値の表</summary>
            <StatTable rows={rows} changes={changes} />
          </details>
        </>
      )}
    </section>
  )
}
