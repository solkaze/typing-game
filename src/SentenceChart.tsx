import type { ReviewSentence } from './review'
import { TipRows } from './Tip'
import { useTip } from './useTip'

type Props = {
  sentences: ReviewSentence[]
  // その回全体の速度 (打/秒)。基準の線として引く
  average: number
  selected: number | null
  onSelect: (index: number) => void
}

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)

// 文ごとの速度を打った順に並べる。どのあたりで崩れたかを見るためのもので、柱を押すとその文のふり返りへ移る
export default function SentenceChart({ sentences, average, selected, onSelect }: Props) {
  const tip = useTip()
  const speeds = sentences.flatMap((s) => (s.kps === null ? [] : [s.kps]))
  if (speeds.length === 0) return null
  const top = Math.max(average, ...speeds) * 1.08
  const missed = sentences.some((s) => s.misses > 0)

  return (
    <figure className="viz-root pace">
      <div className="pace-plot">
        <span className="pace-top">{top.toFixed(1)}</span>
        <div className="pace-line" style={{ bottom: `${(average / top) * 100}%` }}>
          <span>全体 {average.toFixed(2)}</span>
        </div>
        <div className="pace-cols">
          {sentences.map((s, i) => (
            <button
              key={i}
              className={`pace-col${i === selected ? ' on' : ''}`}
              aria-label={`${i + 1} 文目`}
              onClick={() => onSelect(i)}
              {...tip.bind(
                <TipRows
                  title={`${i + 1} 文目`}
                  rows={[
                    ['速度', s.kps === null ? '-' : `${s.kps.toFixed(2)} 打/秒`],
                    ['ミス', s.misses],
                    ['打ち始めまで', ms(s.lead)],
                  ]}
                  foot={s.text}
                />,
              )}
            >
              <span className="pace-bar" style={{ height: s.kps === null ? 0 : `${(s.kps / top) * 100}%` }} />
            </button>
          ))}
        </div>
      </div>
      {missed && (
        <div className="pace-marks" aria-hidden="true">
          {sentences.map((s, i) => (
            <span key={i}>{s.misses > 0 && <i />}</span>
          ))}
        </div>
      )}
      <figcaption className="note">
        <span>柱は文ごとの速度 (打/秒)、左から打った順</span>
        {missed && (
          <span className="pace-key">
            <i />
            ミスのあった文
          </span>
        )}
      </figcaption>
      {tip.node}
    </figure>
  )
}
