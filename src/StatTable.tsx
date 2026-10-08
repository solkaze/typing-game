import type { Change, Row } from './analysis'
import { signed, tone } from './delta'

// changes を渡すと、期間の前半から後半への変わり方を列に足す
type Props = { title: string; note?: string; rows: Row[]; changes?: Map<string, Change> }

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)

export default function StatTable({ title, note, rows, changes }: Props) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {note && <p className="note">{note}</p>}
      {rows.length === 0 ? (
        <p className="note">まだデータが足りません</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>キー</th>
              <th>時間</th>
              {changes && <th>前半比</th>}
              <th>ミス率</th>
              <th>回数</th>
              <th>損失</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = changes?.get(r.label)
              const delta = c ? c.after - c.before : null
              return (
                <tr key={r.label}>
                  <td className="keys">{r.label}</td>
                  <td>{ms(r.median)}</td>
                  {changes && <td className={delta === null ? '' : tone(delta)}>{delta === null ? '-' : signed(delta)}</td>}
                  <td>{(r.missRate * 100).toFixed(1)}%</td>
                  <td>{r.count}</td>
                  <td>{(r.loss / 1000).toFixed(2)} 秒</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
