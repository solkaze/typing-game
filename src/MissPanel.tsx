import { MISS_KINDS, type MissStats } from './misses'

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
  const clean = lost !== null && durationMs > lost ? (intervals / (durationMs - lost)) * 1000 : null

  return (
    <section className="panel">
      <h3>ミスの種類と損失</h3>
      <p className="note">同じ箇所で続けてミスしたときは、最初の 1 打で分類。例は「打つべきキー→打ったキー」</p>
      <table>
        <thead>
          <tr>
            <th>種類</th>
            <th>回数</th>
            <th>割合</th>
            <th>多い例</th>
          </tr>
        </thead>
        <tbody>
          {stats.kinds.map((k) => {
            const kind = MISS_KINDS.find((m) => m.id === k.kind)!
            return (
              <tr key={k.kind}>
                <td title={kind.note}>{kind.label}</td>
                <td>{k.count}</td>
                <td>{((k.count / stats.events) * 100).toFixed(1)}%</td>
                <td className="keys wrap">
                  {k.pairs.slice(0, PAIRS).map((p) => (
                    <span key={p.expected + p.typed} className="pair">
                      {key(p.expected)}→{key(p.typed)} ×{p.count}
                    </span>
                  ))}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="note">
        {MISS_KINDS.filter((m) => m.note)
          .map((m) => `${m.label}: ${m.note}`)
          .join(' / ')}
      </p>

      <table>
        <tbody>
          <tr>
            <th>ミスした箇所</th>
            <td>
              {stats.events} 箇所{stats.extra > 0 && ` (続けて +${stats.extra} 打)`}
            </td>
          </tr>
          {cost && perMiss !== null && lost !== null && (
            <>
              <tr>
                <th>1 回あたりの損失</th>
                <td>{ms(perMiss)}</td>
              </tr>
              <tr>
                <th>　打ち直すまでの遅れ</th>
                <td>{ms(cost.direct)}</td>
              </tr>
              <tr>
                <th>　直後の打鍵の遅れ</th>
                <td>{ms(cost.recovery)}</td>
              </tr>
              <tr>
                <th>失った時間</th>
                <td>
                  {(lost / 1000).toFixed(1)} 秒 ({((lost / durationMs) * 100).toFixed(1)}%)
                </td>
              </tr>
              {clean !== null && (
                <tr>
                  <th>ミスが無かった場合の速度</th>
                  <td>
                    {((intervals / durationMs) * 1000).toFixed(2)} → {clean.toFixed(2)} 打/秒
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
      {cost && <p className="note">損失は通常の打鍵間隔との差。直後の遅れは、次のミスか文末までの最大 3 打ぶん</p>}
    </section>
  )
}
