import type { Change } from './analysis'
import { signed, tone } from './delta'

type Props = { rows: Change[] }

// 幅を取らないよう、ミス率は整数の % で出す
const pct = (v: number) => Math.round(v * 100)

// 対象の期間を前半と後半に分けたときの、並びごとの変わり方。グラフと同じ値を数字で確かめるための表
export default function ChangeTable({ rows }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>キー</th>
          <th>前半 → 後半</th>
          <th>差</th>
          <th>ミス率</th>
          <th>回数</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="keys">{r.label}</td>
            <td>
              {Math.round(r.before)} → {Math.round(r.after)} ms
            </td>
            <td className={tone(r.after - r.before)}>{signed(r.after - r.before)}</td>
            <td>
              {pct(r.missBefore)} → {pct(r.missAfter)}%
            </td>
            <td>{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
