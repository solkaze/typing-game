import { useMemo } from 'react'
import { normalizeKana } from './romaji/engine'
import { SLOW_RATIO, STALL_RATIO, review, type ReviewKey, type ReviewSentence } from './review'
import { readingOf } from './texts/lookup'
import { kps, type Session } from './types'

type Props = { session: Session }

const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`)
const sec = (v: number) => `${(v / 1000).toFixed(2)} 秒`
const shown = (key: string) => (key === ' ' ? '␣' : key)

type Cell = { kana: string; keys: ReviewKey[] }

// 同じかなを打っている打鍵をまとめる。読みは文面から引くので、文が差し替わった古い記録ではローマ字だけになる
function cells(s: ReviewSentence): Cell[] {
  const reading = readingOf(s.text)
  const kana = reading ? normalizeKana(reading) : null
  const groups: { pos: number; keys: ReviewKey[] }[] = []
  for (const k of s.keys) {
    const last = groups[groups.length - 1]
    if (last && last.pos === k.kanaPos) last.keys.push(k)
    else groups.push({ pos: k.kanaPos, keys: [k] })
  }
  return groups.map((g, i) => ({
    kana: kana ? kana.slice(g.pos, groups[i + 1]?.pos ?? kana.length) : '',
    keys: g.keys,
  }))
}

function tip(k: ReviewKey, baseline: number | null): string | undefined {
  if (k.dt === null) return undefined
  const parts = [`${Math.round(k.dt)} ms`]
  if (baseline) parts.push(`×${(k.dt / baseline).toFixed(1)}`)
  if (k.wrong.length) parts.push(`誤打: ${k.wrong.map(shown).join(' ')}`)
  return parts.join('　')
}

export default function SessionReview({ session }: Props) {
  const r = useMemo(() => review(session), [session])
  const lost = r.loss.miss.ms + r.loss.slow.ms

  return (
    <>
      <section className="panel">
        <h3>どこで時間を失ったか</h3>
        <p className="note">
          この回の打鍵間隔の中央値 ({ms(r.baseline)}) で打てていた場合との差
        </p>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>箇所</th>
              <th>余計にかかった時間</th>
              <th>全体に占める割合</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'ミスして打ち直した箇所', loss: r.loss.miss },
              { label: `ミスなしで遅かった箇所 (${SLOW_RATIO} 倍以上)`, loss: r.loss.slow },
              { label: '文の切り替わり', loss: r.loss.lead },
            ].map(({ label, loss }) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{loss.count}</td>
                <td>{sec(loss.ms)}</td>
                <td>{session.durationMs > 0 ? ((loss.ms / session.durationMs) * 100).toFixed(1) : '0.0'}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.potentialKps !== null && lost > 0 && (
          <p className="note">
            ミスと遅れが無ければ {sec(session.durationMs - lost)}・{r.potentialKps.toFixed(2)} 打/秒 (実際は{' '}
            {kps(session).toFixed(2)} 打/秒)
          </p>
        )}
      </section>

      <section className="panel review-replay">
        <h3>打鍵のふり返り</h3>
        <p className="replay-legend note">
          <span className="replay-keys">
            <span className="slow">遅い</span>
          </span>
          {SLOW_RATIO} 倍以上
          <span className="replay-keys">
            <span className="stall">詰まり</span>
          </span>
          {STALL_RATIO} 倍以上
          <span className="replay-keys">
            <span className="miss">ミス</span>
          </span>
          打ち直した箇所　キーにカーソルを置くと時間と誤打を表示
        </p>
        {r.sentences.map((s, i) => (
          <div key={i} className="replay">
            <div className="replay-head">
              <span className="replay-text">{s.text}</span>
              <span className="replay-stats">
                {s.kps === null ? '-' : `${s.kps.toFixed(2)} 打/秒`}
                {s.misses > 0 && <span className="replay-miss">　ミス {s.misses}</span>}
                {s.lead !== null && `　打ち始めまで ${ms(s.lead)}`}
              </span>
            </div>
            <div className="replay-line">
              {cells(s).map((c, j) => (
                <span key={j} className="replay-cell">
                  {c.kana && <span className="replay-kana">{c.kana}</span>}
                  <span className="replay-keys">
                    {c.keys.map((k, n) => (
                      <span key={n} className={k.level} title={tip(k, r.baseline)}>
                        {shown(k.key)}
                      </span>
                    ))}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>遅かった箇所</h3>
        <p className="note">ミスなしで時間がかかった打鍵を長い順に表示。太字が遅れたキー</p>
        {r.spots.length === 0 ? (
          <p className="note">目立って遅い箇所はありません</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>キー</th>
                <th className="spot-text">文</th>
                <th>時間</th>
                <th>中央値比</th>
              </tr>
            </thead>
            <tbody>
              {r.spots.map((p) => (
                <tr key={`${p.sentence}-${p.index}`}>
                  <td className="keys">
                    <span className="spot-before">{p.before}</span>
                    <strong>{shown(p.key)}</strong>
                  </td>
                  <td className="spot-text">{r.sentences[p.sentence].text}</td>
                  <td>{ms(p.dt)}</td>
                  <td>×{p.ratio.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
