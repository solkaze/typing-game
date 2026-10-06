import type { Spelling } from './spelling'

type Props = { rows: Spelling[] }

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)

function hint(row: Spelling): string {
  const main = row.variants[0].romaji
  const notes: string[] = []
  if (row.shorter) notes.push(`${row.shorter} なら ${main.length - row.shorter.length} 打少ない`)
  if (row.faster) notes.push(`${row.faster} のほうが速い`)
  return notes.join(' / ')
}

// 打ち方を使い分けているかなと、もっと短い・速い打ち方があるかな
export default function SpellingTable({ rows }: Props) {
  return (
    <section className="panel">
      <h3>打ち分け</h3>
      <p className="note">時間は、直前の打鍵からそのかなを打ち終えるまで。2 通り以上で打っているか、短い打ち方があるかなを表示</p>
      {rows.length === 0 ? (
        <p className="note">打ち分けているかなはありません</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>かな</th>
              <th>打ち方</th>
              <th>回数</th>
              <th>時間</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const used = row.variants.filter((v) => v.count > 0)
              return used.map((v, i) => (
                <tr key={`${row.kana}|${v.romaji}|${row.variants.length}`}>
                  {/* 同じかなの2行目からは、かなとメモを繰り返さない */}
                  <td>{i === 0 ? row.kana : ''}</td>
                  <td className="keys">{v.romaji}</td>
                  <td>{v.count}</td>
                  <td>{ms(v.median)}</td>
                  <td>{i === 0 ? hint(row) : ''}</td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
