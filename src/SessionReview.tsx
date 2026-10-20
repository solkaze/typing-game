import { useMemo, useState } from 'react'
import BarList from './BarList'
import { normalizeKana } from './romaji/engine'
import { SLOW_RATIO, STALL_RATIO, review, type Loss, type ReviewKey, type ReviewSentence } from './review'
import SentenceChart from './SentenceChart'
import StackBar, { type Segment } from './StackBar'
import { readingOf } from './texts/lookup'
import { TipRows } from './Tip'
import { kps, typingMs, type Session } from './types'

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
  // グラフや一覧で選んだ文。ふり返りの中のその文へ移って目立たせる
  const [selected, setSelected] = useState<number | null>(null)
  const lost = r.loss.miss.ms + r.loss.slow.ms
  const actual = kps(session)
  // 速度と同じく、各文の1打鍵目から打ち終えるまでの時間の合計
  const total = typingMs(session)
  const share = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : '0.0%')
  const base = Math.max(0, total - lost)

  const select = (i: number) => {
    setSelected(i)
    document.getElementById(`replay-${i}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const segment = (id: string, label: string, loss: Loss, tone: Segment['tone']): Segment => ({
    id,
    label: `${label} (${loss.count} 箇所)`,
    value: loss.ms,
    text: `${sec(loss.ms)}　${share(loss.ms)}`,
    tone,
    tip: (
      <TipRows
        title={label}
        rows={[
          ['箇所', loss.count],
          ['余計にかかった時間', sec(loss.ms)],
          ['全体に占める割合', share(loss.ms)],
        ]}
      />
    ),
  })

  return (
    <>
      <section className="panel">
        <h3>どこで時間を失ったか</h3>
        <p className="note">
          各文の1打鍵目から打ち終えるまでの時間 (合計 {sec(total)}) の内訳。この回の打鍵間隔の中央値 ({ms(r.baseline)}) で打てていた場合との差
        </p>
        <StackBar
          label="かかった時間の内訳"
          // 赤と黄は暗い配色で隣り合うと見分けにくいので、灰色の「打てた分」を間に挟む
          segments={[
            segment('miss', 'ミスして打ち直した箇所', r.loss.miss, 'miss'),
            { id: 'base', label: '中央値のペースで打てた分', value: base, text: `${sec(base)}　${share(base)}`, tone: 'base' },
            segment('slow', `ミスなしで遅かった箇所 (${SLOW_RATIO} 倍以上)`, r.loss.slow, 'slow'),
          ]}
        />
        {r.potentialKps !== null && lost > 0 && (
          <>
            <h4>ミスと遅れが無ければ</h4>
            <BarList
              max={Math.max(actual, r.potentialKps)}
              bars={[
                { id: 'actual', label: '実際', value: actual, text: `${actual.toFixed(2)} 打/秒` },
                {
                  id: 'potential',
                  label: 'ミスと遅れなし',
                  value: r.potentialKps,
                  text: `${r.potentialKps.toFixed(2)} 打/秒`,
                  extra: sec(total - lost),
                  tone: 'quiet',
                },
              ]}
            />
          </>
        )}
      </section>

      <section className="panel">
        <h3>文ごとの速度</h3>
        <SentenceChart sentences={r.sentences} average={actual} selected={selected} onSelect={select} />
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
          <div key={i} id={`replay-${i}`} className={`replay${i === selected ? ' on' : ''}`}>
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
        <p className="note">ミスなしで時間がかかった打鍵を長い順に表示。太字が遅れたキー。押すとその文のふり返りへ移ります</p>
        {r.spots.length === 0 ? (
          <p className="note">目立って遅い箇所はありません</p>
        ) : (
          <BarList
            mono
            bars={r.spots.map((p) => ({
              id: `${p.sentence}-${p.index}`,
              label: (
                <>
                  <span className="spot-before">{p.before}</span>
                  <strong>{shown(p.key)}</strong>
                </>
              ),
              value: p.dt,
              text: ms(p.dt),
              extra: `×${p.ratio.toFixed(1)}`,
              sub: r.sentences[p.sentence].text,
              tone: p.ratio >= STALL_RATIO ? ('slow' as const) : ('slow-soft' as const),
              onClick: () => select(p.sentence),
            }))}
          />
        )}
      </section>
    </>
  )
}
