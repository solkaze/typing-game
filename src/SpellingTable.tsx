import BarList from './BarList'
import type { Spelling } from './spelling'
import { TipRows } from './Tip'

type Props = { rows: Spelling[] }

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)

// 打ち方を使い分けているかなと、もっと短い・速い打ち方があるかな。かなごとに、打ち方の使った割合を棒で見せる
export default function SpellingTable({ rows }: Props) {
  return (
    <section className="panel">
      <h3>打ち分け</h3>
      <p className="note">
        棒は使った割合、右の時間は直前の打鍵からそのかなを打ち終えるまで。2 通り以上で打っているか、短い打ち方があるかなを表示
      </p>
      {rows.length === 0 ? (
        <p className="note">打ち分けているかなはありません</p>
      ) : (
        <div className="spellings">
          {rows.map((row) => {
            const main = row.variants[0].romaji
            // 使っていなくても、勧める打ち方は並べる
            const shown = row.variants.filter((v) => v.count > 0 || v.romaji === row.shorter)
            return (
              <div key={`${row.kana}|${row.variants.length}`} className="spelling">
                <span className="spelling-kana">{row.kana}</span>
                <BarList
                  mono
                  max={row.count}
                  bars={shown.map((v) => ({
                    id: v.romaji,
                    label: v.romaji,
                    value: v.count,
                    text: `${Math.round((v.count / row.count) * 100)}%`,
                    extra: (
                      <>
                        {ms(v.median)}
                        {v.romaji === row.faster && <span className="badge">速い</span>}
                        {v.romaji === row.shorter && (
                          <span className="badge">{main.length - v.romaji.length} 打少ない</span>
                        )}
                      </>
                    ),
                    tone: v.romaji === main ? undefined : 'quiet',
                    tip: (
                      <TipRows
                        title={`${row.kana}　${v.romaji}`}
                        rows={[
                          ['回数', `${v.count} / ${row.count}`],
                          ['時間', ms(v.median)],
                        ]}
                      />
                    ),
                  }))}
                />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
