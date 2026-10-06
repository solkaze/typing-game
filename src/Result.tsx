import { useEffect, useMemo } from 'react'
import { analyze, worst } from './analysis'
import SessionReview from './SessionReview'
import StatTable from './StatTable'
import { accuracy, kps, modeLabel, modeOf, type Session } from './types'

type Props = {
  session: Session
  // 保存済みの全記録。この回より前の回との比較に使う
  sessions: Session[]
  saveError: string | null
  onRetry: () => void
  onHome: () => void
  // 保存されている記録だけ削除できる
  onDelete?: () => void
  onAnalysis: () => void
}

const RECENT = 10

const signed = (v: number, digits: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length

const date = (iso: string) => new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })

export default function Result({ session, sessions, saveError, onRetry, onHome, onDelete, onAnalysis }: Props) {
  const a = useMemo(() => analyze([session]), [session])
  const mode = modeOf(session)
  const endless = mode === 'endless'
  // 同じモードの、この回より前の直近の記録。長文は文章ごとに長さが違うので、かな数は揃えない。
  // エンドレスはかな数が記録そのものなので、代わりにミスの上限を揃える
  const recent = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            modeOf(s) === mode &&
            (mode === 'long' || (endless ? s.missLimit === session.missLimit : s.kanaCount === session.kanaCount)) &&
            s.startedAt < session.startedAt,
        )
        .slice(-RECENT),
    [sessions, session, mode, endless],
  )
  const kpsDiff = recent.length ? kps(session) - mean(recent.map(kps)) : null
  const kanaDiff = recent.length ? session.kanaCount - mean(recent.map((s) => s.kanaCount)) : null
  const accDiff = recent.length ? (accuracy(session) - mean(recent.map(accuracy))) * 100 : null

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'Enter') onRetry()
      // Space は既定だとスクロールやフォーカス中ボタンの押下になるので止める
      if (e.key === ' ') {
        e.preventDefault()
        onRetry()
      }
      if (e.key === 'Escape') onHome()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRetry, onHome])

  // 下までスクロールしなくても押せるよう、上下の両方に置く
  const actions = (
    <>
      <button className="primary" onClick={onRetry}>
        もう一度 (Space / Enter)
      </button>
      <button onClick={onAnalysis}>分析を見る</button>
      <button onClick={onHome}>ホーム (Esc)</button>
      {onDelete && (
        <button className="quiet" onClick={onDelete}>
          この記録を削除
        </button>
      )}
    </>
  )

  return (
    <main className="page">
      <header className="page-head">
        <h2>結果</h2>
        <span className="note">
          {modeLabel(mode)}
          {endless && ` (ミス ${session.missLimit} 回まで)`}
          {session.title && `「${session.title}」`}　{date(session.startedAt)}
        </span>
      </header>

      <div className="actions">{actions}</div>

      <section className="tiles">
        {/* エンドレスは打てた量が記録なので先頭に出す */}
        {endless && (
          <>
            <div className="tile">
              <span className="tile-label">かな</span>
              <span className="tile-value">{session.kanaCount} 字</span>
              {kanaDiff !== null && (
                <span className="tile-note">
                  直近 {recent.length} 回の平均比 {signed(kanaDiff, 1)}
                </span>
              )}
            </div>
            <div className="tile">
              <span className="tile-label">打ち切った文</span>
              <span className="tile-value">{session.completed ?? 0} 文</span>
            </div>
          </>
        )}
        <div className="tile">
          <span className="tile-label">タイム</span>
          <span className="tile-value">{(session.durationMs / 1000).toFixed(2)} 秒</span>
        </div>
        <div className="tile">
          <span className="tile-label">速度</span>
          <span className="tile-value">{kps(session).toFixed(2)} 打/秒</span>
          {kpsDiff !== null && (
            <span className="tile-note">
              直近 {recent.length} 回の平均比 {signed(kpsDiff, 2)}
            </span>
          )}
        </div>
        <div className="tile">
          <span className="tile-label">正答率</span>
          <span className="tile-value">{(accuracy(session) * 100).toFixed(1)}%</span>
          {accDiff !== null && (
            <span className="tile-note">
              直近 {recent.length} 回の平均比 {signed(accDiff, 1)}
            </span>
          )}
        </div>
        <div className="tile">
          <span className="tile-label">打鍵 / ミス</span>
          <span className="tile-value">
            {session.correct} / {session.misses}
          </span>
        </div>
        {!endless && (
          <div className="tile">
            <span className="tile-label">かな</span>
            <span className="tile-value">{session.kanaCount} 字</span>
          </div>
        )}
      </section>

      {saveError && <p className="error">記録を保存できませんでした: {saveError}</p>}

      <div className="result-body">
        <SessionReview session={session} />

        <div className="grid-2">
          <StatTable title="今回遅かった 2 連" note="2 回以上出たもの" rows={worst(a.bigrams, 2, 8)} />
          <StatTable
            title="今回ミスした 2 連"
            rows={a.bigrams
              .filter((r) => r.missRate > 0)
              .sort((x, y) => y.missRate * y.count - x.missRate * x.count)
              .slice(0, 8)}
          />
        </div>
      </div>

      <footer className="actions">{actions}</footer>
    </main>
  )
}
