import type { ReactNode } from 'react'
import { useTip } from './useTip'

export type Bar = {
  id: string
  label: ReactNode
  // 棒の長さ。負の値は 0 として描く
  value: number
  // 棒の右に出す値
  text: ReactNode
  // さらに右に添える補足 (時間や前半比など)
  extra?: ReactNode
  // 棒の下に出す補足 (例や文面など)
  sub?: ReactNode
  tip?: ReactNode
  // 色。指定しなければ系列の色
  tone?: 'miss' | 'slow' | 'slow-soft' | 'loss' | 'quiet'
  onClick?: () => void
}

type Props = {
  bars: Bar[]
  // 棒の端にあたる値。省くといちばん大きい値
  max?: number
  // 見出しがキーの並びのとき
  mono?: boolean
}

// 横棒の一覧。1系列なので凡例は持たず、パネルの題が系列名を兼ねる
export default function BarList({ bars, max, mono = false }: Props) {
  const tip = useTip()
  const top = max ?? Math.max(0, ...bars.map((b) => b.value))
  const extra = bars.some((b) => b.extra !== undefined)

  return (
    <div className={`viz-root bars${extra ? ' with-extra' : ''}${mono ? ' mono' : ''}`}>
      {bars.map((b) => {
        const ratio = top > 0 ? Math.max(0, Math.min(1, b.value / top)) : 0
        return (
          <div
            key={b.id}
            className={`bar-row${b.onClick ? ' clickable' : ''}`}
            onClick={b.onClick}
            {...(b.tip ? tip.bind(b.tip) : {})}
          >
            <span className="bar-label">{b.label}</span>
            <span className="bar-track">
              {ratio > 0 && <span className={`bar-fill ${b.tone ?? ''}`} style={{ width: `max(3px, ${ratio * 100}%)` }} />}
            </span>
            <span className="bar-text">{b.text}</span>
            {extra && <span className="bar-extra">{b.extra}</span>}
            {b.sub && <span className="bar-sub">{b.sub}</span>}
          </div>
        )
      })}
      {tip.node}
    </div>
  )
}
