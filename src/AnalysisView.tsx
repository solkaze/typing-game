import { useMemo, useState } from 'react'
import { analyze, changes, worst, type Change, type Row } from './analysis'
import ChangeTable from './ChangeTable'
import LineChart from './LineChart'
import MissPanel from './MissPanel'
import { misses } from './misses'
import { spellings } from './spelling'
import SpellingTable from './SpellingTable'
import StatTable from './StatTable'
import { kps, type Session } from './types'

// sessions は1つのモードの記録だけを渡す。label はそのモード名
type Props = { sessions: Session[]; label: string; onBack: () => void }

const RANGES = [
  { label: '直近10回', size: 10 },
  { label: '直近30回', size: 30 },
  { label: 'すべて', size: Infinity },
]

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)
const rate = (v: number | null) => (v === null ? '-' : `${v.toFixed(2)} 打/秒`)

const date = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CHANGE_LIMIT = 10

const byLabel = (rows: Change[]) => new Map(rows.map((r) => [r.label, r]))

const byMissRate = (rows: Row[], minCount: number, limit: number) =>
  rows
    .filter((r) => r.count >= minCount && r.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, limit)

export default function AnalysisView({ sessions, label, onBack }: Props) {
  const [size, setSize] = useState(RANGES[1].size)
  const target = useMemo(() => sessions.slice(-size), [sessions, size])
  const a = useMemo(() => analyze(target), [target])
  // 回数の少ない連なりは偶然の影響が大きいので、データ量に応じて足切りする
  const minCount = Math.max(3, Math.round(a.hits / 400))
  const missed = useMemo(() => misses(target, a.medianInterval), [target, a.medianInterval])
  // 対象を回数で前半と後半に分け、並びごとに速くなったかを見る
  const moved = useMemo(() => {
    const half = target.length >> 1
    if (half === 0) return null
    const before = analyze(target.slice(0, half))
    const after = analyze(target.slice(half))
    // 半分に分けるぶん、足切りも半分にする
    const min = Math.max(3, Math.round(minCount / 2))
    return {
      before,
      after,
      keys: changes(before.keys, after.keys, min),
      bigrams: changes(before.bigrams, after.bigrams, min),
      trigrams: changes(before.trigrams, after.trigrams, min),
    }
  }, [target, minCount])
  const spelled = useMemo(
    () =>
      spellings(target)
        .filter((r) => r.count >= minCount)
        .filter((r) => r.variants.filter((v) => v.count > 0).length > 1 || r.shorter !== null)
        .slice(0, 20),
    [target, minCount],
  )

  if (sessions.length === 0) {
    return (
      <main className="page">
        <header className="page-head">
          <h2>分析 ({label})</h2>
          <button onClick={onBack}>戻る</button>
        </header>
        <p className="note">このモードの記録がまだありません。まず1回プレイしてください。</p>
      </main>
    )
  }

  const speeds = target.map(kps)
  const totalCorrect = target.reduce((n, s) => n + s.correct, 0)
  const totalMisses = target.reduce((n, s) => n + s.misses, 0)
  const halfNote = moved
    ? `前半比は、対象の前半 ${target.length >> 1} 回から後半 ${target.length - (target.length >> 1)} 回への時間の変化`
    : ''
  const faster = moved
    ? moved.bigrams.filter((c) => c.gain > 0).sort((x, y) => y.gain - x.gain).slice(0, CHANGE_LIMIT)
    : []
  const slower = moved
    ? moved.bigrams.filter((c) => c.gain < 0).sort((x, y) => x.gain - y.gain).slice(0, CHANGE_LIMIT)
    : []

  return (
    <main className="page">
      <header className="page-head">
        <h2>分析 ({label})</h2>
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r.label} className={r.size === size ? 'on' : ''} onClick={() => setSize(r.size)}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={onBack}>戻る</button>
      </header>

      <section className="tiles">
        <div className="tile">
          <span className="tile-label">対象</span>
          <span className="tile-value">{target.length} 回</span>
        </div>
        <div className="tile">
          <span className="tile-label">平均速度</span>
          <span className="tile-value">{rate(speeds.reduce((x, y) => x + y, 0) / speeds.length)}</span>
        </div>
        <div className="tile">
          <span className="tile-label">最高速度</span>
          <span className="tile-value">{rate(Math.max(...speeds))}</span>
        </div>
        <div className="tile">
          <span className="tile-label">正答率</span>
          <span className="tile-value">{((totalCorrect / (totalCorrect + totalMisses)) * 100).toFixed(1)}%</span>
        </div>
        <div className="tile">
          <span className="tile-label">打鍵間隔の中央値</span>
          <span className="tile-value">{ms(a.medianInterval)}</span>
        </div>
      </section>

      <section className="charts">
        <LineChart
          title="速度 (打/秒)"
          points={a.trend.map((t) => ({ label: date(t.startedAt), value: t.kps }))}
          format={(v) => v.toFixed(2)}
        />
        <LineChart
          title="正答率 (%)"
          points={a.trend.map((t) => ({ label: date(t.startedAt), value: t.accuracy * 100 }))}
          format={(v) => v.toFixed(2)}
        />
      </section>

      <div className="grid-2">
        <section className="panel">
          <h3>流れ</h3>
          <table>
            <tbody>
              <tr>
                <th>通常の打鍵間隔</th>
                <td>{ms(a.medianInterval)}</td>
              </tr>
              <tr>
                <th>ミス直後 3 打の打鍵間隔</th>
                <td>{ms(a.flow.afterMiss)}</td>
              </tr>
              <tr>
                <th>文の切り替わりでの間</th>
                <td>{ms(a.flow.sentenceStart)}</td>
              </tr>
              <tr>
                <th>前半の速度</th>
                <td>{rate(a.flow.firstHalfKps)}</td>
              </tr>
              <tr>
                <th>後半の速度</th>
                <td>{rate(a.flow.secondHalfKps)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <StatTable
          title="遅い 2 連"
          note={`${minCount} 回以上出たものを、損失時間の大きい順に表示。${halfNote}`}
          rows={worst(a.bigrams, minCount, 15)}
          changes={moved ? byLabel(moved.bigrams) : undefined}
        />
        <StatTable
          title="遅い 3 連"
          note="時間は 2 打目と 3 打目の合計"
          rows={worst(a.trigrams, minCount, 15)}
          changes={moved ? byLabel(moved.trigrams) : undefined}
        />
        {moved ? (
          <>
            <ChangeTable
              title="速くなった 2 連"
              note={`縮んだ時間 × 回数の大きい順。全体の打鍵間隔は ${ms(moved.before.medianInterval)} → ${ms(moved.after.medianInterval)}`}
              rows={faster}
            />
            <ChangeTable title="遅くなった 2 連" note="延びた時間 × 回数の大きい順" rows={slower} />
          </>
        ) : (
          <section className="panel">
            <h3>2 連の変化</h3>
            <p className="note">対象の記録が 2 回以上あると、前半と後半を比べて表示します</p>
          </section>
        )}
        <StatTable title="ミスしやすい 2 連" rows={byMissRate(a.bigrams, minCount, 15)} />
        <StatTable
          title="キー別"
          note="損失時間の大きい順"
          rows={worst(a.keys, minCount, 40)}
          changes={moved ? byLabel(moved.keys) : undefined}
        />

        <SpellingTable rows={spelled} />

        <MissPanel
          stats={missed}
          durationMs={target.reduce((n, s) => n + s.durationMs, 0)}
          intervals={target.reduce((n, s) => n + Math.max(0, s.correct - 1), 0)}
        />

        <section className="panel">
          <h3>打ち間違い</h3>
          {a.confusions.length === 0 ? (
            <p className="note">ミスの記録がありません</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>打つべきキー</th>
                  <th>打ったキー</th>
                  <th>回数</th>
                </tr>
              </thead>
              <tbody>
                {a.confusions.slice(0, 20).map((c) => (
                  <tr key={c.expected + c.typed}>
                    <td className="keys">{c.expected}</td>
                    <td className="keys">{c.typed === ' ' ? 'Space' : c.typed}</td>
                    <td>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  )
}
