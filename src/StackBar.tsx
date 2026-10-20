import type { ReactNode } from 'react'
import { useTip } from './useTip'

export type Segment = {
  id: string
  label: string
  value: number
  // 凡例に出す値
  text: ReactNode
  tone: 'base' | 'miss' | 'miss-soft' | 'slow'
  tip?: ReactNode
}

type Props = { segments: Segment[]; label: string }

// 全体に占める内訳を1本の積み上げ棒で見せる。値は下の凡例にすべて書く
export default function StackBar({ segments, label }: Props) {
  const tip = useTip()
  const total = segments.reduce((n, s) => n + Math.max(0, s.value), 0)

  return (
    <div className="viz-root stack">
      <div className="stack-bar" role="img" aria-label={label}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <span
                key={s.id}
                className={`stack-seg ${s.tone}`}
                style={{ flexGrow: s.value / total }}
                {...(s.tip ? tip.bind(s.tip) : {})}
              />
            ))}
      </div>
      <ul className="stack-legend">
        {segments.map((s) => (
          <li key={s.id}>
            <i className={`swatch ${s.tone}`} />
            <span className="stack-label">{s.label}</span>
            <span className="stack-value">{s.text}</span>
          </li>
        ))}
      </ul>
      {tip.node}
    </div>
  )
}
