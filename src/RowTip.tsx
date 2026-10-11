import type { ReactNode } from 'react'
import type { Change, Row } from './analysis'
import { signed } from './delta'
import { TipRows } from './Tip'

type Props = { row: Row; change?: Change; foot?: ReactNode }

// キーや連なり1つぶんの吹き出し
export default function RowTip({ row, change, foot }: Props) {
  const rows: [string, ReactNode][] = [
    ['時間', row.median === null ? '-' : `${Math.round(row.median)} ms`],
    ['ミス率', `${(row.missRate * 100).toFixed(1)}%`],
    ['回数', row.count],
    ['損失', `${(row.loss / 1000).toFixed(2)} 秒`],
  ]
  if (change) rows.splice(1, 0, ['前半比', signed(change.after - change.before)])
  return <TipRows title={row.label} mono rows={rows} foot={foot} />
}
