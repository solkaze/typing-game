import { useState, type PointerEvent, type ReactNode } from 'react'

type Tip = { x: number; y: number; body: ReactNode }

// 画面の端では反対側へ出す。吹き出しのおおよその大きさ (px)
const WIDTH = 260
const HEIGHT = 180

// グラフのマークにカーソルを置いたときの吹き出し。同じ値は表でも読めるので、補足としてだけ使う
export function useTip() {
  const [tip, setTip] = useState<Tip | null>(null)

  const bind = (body: ReactNode) => ({
    onPointerMove: (e: PointerEvent) => setTip({ x: e.clientX, y: e.clientY, body }),
    onPointerLeave: () => setTip(null),
  })

  const node = tip && (
    <div
      className="tip"
      role="tooltip"
      style={{
        left: tip.x,
        top: tip.y,
        transform: `translate(${tip.x > window.innerWidth - WIDTH ? 'calc(-100% - 12px)' : '12px'}, ${
          tip.y > window.innerHeight - HEIGHT ? 'calc(-100% - 12px)' : '12px'
        })`,
      }}
    >
      {tip.body}
    </div>
  )

  return { bind, node }
}
