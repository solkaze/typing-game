import type { ReactNode } from 'react'

type RowsProps = { title: ReactNode; mono?: boolean; rows: [string, ReactNode][]; foot?: ReactNode }

// 吹き出しの中身。見出しの下に「項目 値」を並べる
export function TipRows({ title, mono = false, rows, foot }: RowsProps) {
  return (
    <>
      <div className={`tip-title${mono ? ' mono' : ''}`}>{title}</div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {foot && <div className="tip-foot">{foot}</div>}
    </>
  )
}
