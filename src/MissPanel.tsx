import BarList from './BarList'
import { MISS_KINDS, type MissStats } from './misses'
import StackBar from './StackBar'
import { TipRows } from './Tip'

type Props = {
  stats: MissStats
  // 対象の記録の合計。ミスが無かった場合の速度を出すのに使う
  durationMs: number
  intervals: number
}

const ms = (v: number) => `${Math.round(v)} ms`
const key = (k: string) => (k === ' ' ? 'Space' : k)
const PAIRS = 3

// ミスを種類に分け、1 回のミスでどれだけ時間を失っているかを出す
export default function MissPanel({ stats, durationMs, intervals }: Props) {
  if (stats.events === 0) {
    return (
      <section className="panel">
        <h3>ミスの種類と損失</h3>
        <p className="note">ミスの記録がありません</p>
      </section>
    )
  }

  const { cost } = stats
  const perMiss = cost && cost.direct + cost.recovery
  // 文頭など測れなかったミスも、平均と同じだけ失ったものとして見積もる
  const lost = perMiss === null ? null : Math.max(0, perMiss * stats.events)
  const actual = (intervals / durationMs) * 1000
  const clean = lost !== null && durationMs > lost ? (intervals / (durationMs - lost)) * 1000 : null

  return (
    <section className="panel">
      <h3>ミスの種類と損失</h3>
      <p className="note">
        {stats.events} 箇所{stats.extra > 0 && ` (続けて +${stats.extra} 打)`}。同じ箇所で続けてミスしたときは、最初の 1
        打で分類。例は「打つべきキー→打ったキー」
      </p>
      <BarList
        bars={stats.kinds.map((k) => {
          const kind = MISS_KINDS.find((m) => m.id === k.kind)!
          return {
            id: k.kind,
            label: kind.label,
            value: k.count,
            text: `${Math.round((k.count / stats.events) * 100)}%`,
            extra: `${k.count} 回`,
            tone: 'miss' as const,
            sub: (
              <span className="pairs">
                {k.pairs.slice(0, PAIRS).map((p) => (
                  <span key={p.expected + p.typed} className="pair">
                    {key(p.expected)}→{key(p.typed)} ×{p.count}
                  </span>
                ))}
              </span>
            ),
            tip: (
              <TipRows
                title={kind.label}
                rows={[
                  ['回数', k.count],
                  ['割合', `${((k.count / stats.events) * 100).toFixed(1)}%`],
                ]}
                foot={kind.note || undefined}
              />
            ),
          }
        })}
      />

      {cost && perMiss !== null && lost !== null && (
        <>
          <h4>1 回のミスで失う時間　{ms(perMiss)}</h4>
          <StackBar
            label="1 回のミスで失う時間の内訳"
            segments={[
              { id: 'direct', label: '打ち直すまでの遅れ', value: cost.direct, text: ms(cost.direct), tone: 'miss' },
              { id: 'recovery', label: '直後の打鍵の遅れ', value: cost.recovery, text: ms(cost.recovery), tone: 'miss-soft' },
            ]}
          />
          <h4>
            失った時間　{(lost / 1000).toFixed(1)} 秒 ({((lost / durationMs) * 100).toFixed(1)}%)
          </h4>
          {clean !== null && (
            <BarList
              max={clean}
              bars={[
                { id: 'actual', label: '実際の速度', value: actual, text: `${actual.toFixed(2)} 打/秒` },
                { id: 'clean', label: 'ミスが無ければ', value: clean, text: `${clean.toFixed(2)} 打/秒`, tone: 'quiet' },
              ]}
            />
          )}
          <p className="note">損失は通常の打鍵間隔との差。直後の遅れは、次のミスか文末までの最大 3 打ぶん</p>
        </>
      )}
    </section>
  )
}
