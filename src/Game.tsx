import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { Typist } from './romaji/engine'
import type { SentenceKps } from './settings'
import type { Sentence } from './texts/sentences'
import type { Keystroke, Mode, Session } from './types'

type Props = {
  mode: Mode
  // 長文モードの文章の題
  title?: string
  sentences: Sentence[]
  // エンドレスモード: この回数ミスしたら終わり
  missLimit?: number
  // エンドレスモード: 文が尽きる前に呼んで続きをもらう。last は今ある最後の文
  more?: (last: Sentence) => Sentence[]
  // 開始前のカウントダウン秒数。0 ならすぐ打てる
  countdownSec: number
  sentenceKps: SentenceKps
  // まだ打っていないローマ字を隠す
  hideGuide: boolean
  onFinish: (session: Session) => void
  onAbort: () => void
}

type Run = {
  // エンドレスでは打ち進むにつれて継ぎ足す
  sentences: Sentence[]
  typists: Typist[]
  index: number
  startedAt: string
  // 1打鍵目の KeyboardEvent.timeStamp
  origin: number | null
  keystrokes: Keystroke[]
  correct: number
  misses: number
  kanaDone: number
  // いまの文の最初の正打鍵の時刻と、正打鍵の数
  sentenceOrigin: number | null
  sentenceCorrect: number
  // 直前に打ち終えた文の速度 (打/秒)。review.ts と同じく文頭の打鍵を除く
  lastKps: number | null
}

function newRun(sentences: Sentence[]): Run {
  return {
    sentences: [...sentences],
    typists: sentences.map((s) => new Typist(s.reading)),
    index: 0,
    startedAt: '',
    origin: null,
    keystrokes: [],
    correct: 0,
    misses: 0,
    kanaDone: 0,
    sentenceOrigin: null,
    sentenceCorrect: 0,
    lastKps: null,
  }
}

export default function Game({
  mode,
  title,
  sentences: initial,
  missLimit,
  more,
  countdownSec,
  sentenceKps,
  hideGuide,
  onFinish,
  onAbort,
}: Props) {
  const run = useRef<Run>(null)
  if (run.current === null) run.current = newRun(initial)
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [elapsed, setElapsed] = useState(0)
  const [imeOn, setImeOn] = useState(false)
  const [missTick, setMissTick] = useState(0)
  const [count, setCount] = useState(countdownSec)

  useEffect(() => {
    if (count <= 0) return
    const id = setTimeout(() => setCount((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [count])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const r = run.current!
      if (e.key === 'Escape') {
        onAbort()
        return
      }
      if (e.isComposing || e.key === 'Process') {
        setImeOn(true)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.repeat) return
      e.preventDefault()
      setImeOn(false)
      // カウントダウン中の打鍵は記録にも残さない
      if (count > 0) return

      if (r.origin === null) {
        r.origin = e.timeStamp
        r.startedAt = new Date().toISOString()
      }
      const t = e.timeStamp - r.origin
      const typist = r.typists[r.index]
      const expected = typist.guide[0]
      const kanaPos = typist.kanaPos
      const ok = typist.input(e.key)
      r.keystrokes.push({ t, key: e.key, code: e.code, ok, expected, sentence: r.index, kanaPos })

      const finish = () =>
        onFinish({
          mode,
          title,
          missLimit,
          completed: missLimit === undefined ? undefined : r.index,
          startedAt: r.startedAt,
          // エンドレスは文の途中で終わるので、そこまでに打てたかなも数える
          kanaCount: r.kanaDone + (typist.done ? 0 : typist.kanaPos),
          durationMs: t,
          correct: r.correct,
          misses: r.misses,
          // 継ぎ足して先読みしただけの文は残さない
          texts: r.sentences.slice(0, r.index + 1).map((s) => s.text),
          keystrokes: r.keystrokes,
        })

      if (!ok) {
        r.misses++
        if (missLimit !== undefined && r.misses >= missLimit) {
          finish()
          return
        }
        setMissTick((n) => n + 1)
        return
      }
      r.correct++
      r.sentenceOrigin ??= t
      r.sentenceCorrect++
      if (typist.done) {
        const inner = t - r.sentenceOrigin
        r.lastKps = inner > 0 ? ((r.sentenceCorrect - 1) / inner) * 1000 : null
        r.sentenceOrigin = null
        r.sentenceCorrect = 0
        r.kanaDone += typist.kana.length
        r.index++
        // 次の文の予告まで出せるよう、1文先まで用意しておく
        if (more && r.index + 1 >= r.sentences.length) {
          const added = more(r.sentences[r.sentences.length - 1])
          r.sentences.push(...added)
          r.typists.push(...added.map((s) => new Typist(s.reading)))
        }
      }
      if (r.index === r.typists.length) {
        finish()
        return
      }
      redraw()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, title, missLimit, more, count, onFinish, onAbort])

  useEffect(() => {
    const id = setInterval(() => {
      const origin = run.current!.origin
      if (origin !== null) setElapsed(performance.now() - origin)
    }, 100)
    return () => clearInterval(id)
  }, [])

  const r = run.current
  const sentences = r.sentences
  const index = Math.min(r.index, sentences.length - 1)
  const typist = r.typists[index]
  const kanaTotal = r.typists.reduce((n, t) => n + t.kana.length, 0)
  const kanaNow = r.kanaDone + (typist.done ? 0 : typist.kanaPos)
  const next = sentences[index + 1]
  const long = mode === 'long'
  const endless = missLimit !== undefined

  // 長文では、いま打っている文が枠の中ほどに来るよう送る。行が上下で切れないよう行の高さ単位で止める
  const passage = useRef<HTMLElement>(null)
  const current = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = passage.current
    const now = current.current
    if (!box || !now) return
    const line = parseFloat(getComputedStyle(box).lineHeight)
    const top = now.offsetTop - (box.clientHeight - now.offsetHeight) / 2
    box.scrollTop = Math.round(top / line) * line
  }, [index])

  return (
    <main className={long ? 'game long' : 'game'}>
      <header className="game-status">
        <span>{endless ? `${kanaNow} かな・${r.index} 文` : `${kanaNow} / ${kanaTotal} かな`}</span>
        <span>{(elapsed / 1000).toFixed(1)} 秒</span>
        <span>{endless ? `ミス ${r.misses} / ${missLimit}` : `ミス ${r.misses}`}</span>
      </header>

      {/* エンドレスには終わりの位置が無いので、残りのミス回数を出す */}
      {endless ? (
        <progress value={missLimit - r.misses} max={missLimit} />
      ) : (
        <progress value={kanaNow} max={kanaTotal} />
      )}

      <p className="game-banner">
        {count > 0 ? (
          <strong key={count} className="countdown">
            {count}
          </strong>
        ) : sentenceKps === 'banner' && r.lastKps !== null ? (
          `前の文 ${r.lastKps.toFixed(2)} 打/秒`
        ) : (
          ' '
        )}
      </p>

      {long && (
        <section ref={passage} className={count > 0 ? 'passage waiting' : 'passage'}>
          {sentences.map((s, i) => (
            <span
              key={i}
              ref={i === index ? current : undefined}
              className={i < index ? 'done' : i === index ? 'now' : undefined}
            >
              {s.text}
            </span>
          ))}
        </section>
      )}

      <section className={count > 0 ? 'sentence waiting' : 'sentence'}>
        {!long && <p className="sentence-text">{sentences[index].text}</p>}
        <p className="sentence-kana">
          <span className="done">{typist.kana.slice(0, typist.kanaPos)}</span>
          {typist.kana.slice(typist.kanaPos)}
        </p>
        <p key={missTick} className={`sentence-romaji${hideGuide ? ' blind' : ''}${missTick > 0 ? ' miss' : ''}`}>
          <span className="done">{typist.typed}</span>
          {/* 隠すときも場所は取っておき、打った文字の位置がずれないようにする */}
          {hideGuide ? <span className="hidden">{typist.guide}</span> : typist.guide}
        </p>
      </section>

      {/* 文が替わるたびに作り直して、出て消える動きをやり直す。出し入れで下が動かないよう場所は常に取る */}
      {sentenceKps === 'pop' && (
        <p className="sentence-pop">
          {r.lastKps !== null && (
            <strong key={r.index}>
              {r.lastKps.toFixed(2)}
              <small> 打/秒</small>
            </strong>
          )}
        </p>
      )}

      {!long && <p className="sentence-next">{next ? next.text : ' '}</p>}

      <footer className="hint">
        {imeOn ? (
          <strong>日本語入力 (IME) をオフにしてください</strong>
        ) : count > 0 ? (
          'まもなく始まります　Esc: やめる'
        ) : r.origin === null ? (
          '最初のキーを打つと計測が始まります　Esc: やめる'
        ) : (
          'Esc: やめる'
        )}
      </footer>
    </main>
  )
}
